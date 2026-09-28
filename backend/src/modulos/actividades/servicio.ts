import type { Contexto } from '../../contexto.js';
import type { SesionActiva } from '../../middleware/autenticacion.js';
import { ErrorApi } from '../../middleware/errores.js';
import { generarCodigoActividad } from '../../utils/codigo.js';
import { rangoUtcDeDia } from '../../utils/fechas.js';
import type { DatosAltaActividad, DatosEdicionActividad, FiltrosActividades } from './esquemas.js';
import {
  actualizarActividad,
  buscarActividad,
  buscarSolapamiento,
  existeCategoria,
  existeCodigoActividad,
  existePersonaActiva,
  existeTipoActividad,
  existeZonaActiva,
  insertarActividad,
  listarActividades,
  marcarCancelada,
  type ActividadGuardable,
  type FilaActividad,
} from './repositorio.js';

export type ActividadPublica = {
  id: number;
  codigo?: string;
  nombre: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  cancelada: boolean;
  tipo: { id: number; nombre: string };
  categoria: { id: number; nombre: string } | null;
  zona: {
    id: number;
    nombre: string;
    piso: number | null;
    capacidad: number | null;
    edificio: { id: number; nombre: string };
  };
  responsable: { id: number; nombres: string; apellidos: string } | null;
};

/**
 * El código de la actividad solo sale del servidor para quien la gestiona; con él
 * cualquiera podría marcar asistencia sin estar presente (regla 9).
 */
function proyectar(fila: FilaActividad, sesion: SesionActiva): ActividadPublica {
  return {
    id: fila.id,
    ...(sesion.permisos.has('actividad.gestionar') && { codigo: fila.codigo }),
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    inicio: fila.inicio,
    fin: fila.fin,
    cancelada: fila.cancelada === 1,
    tipo: { id: fila.tipo_actividad_id, nombre: fila.tipo },
    categoria:
      fila.categoria_id === null ? null : { id: fila.categoria_id, nombre: fila.categoria! },
    zona: {
      id: fila.zona_id,
      nombre: fila.zona,
      piso: fila.piso,
      capacidad: fila.capacidad,
      edificio: { id: fila.edificio_id, nombre: fila.edificio },
    },
    responsable:
      fila.responsable_id === null
        ? null
        : {
            id: fila.responsable_id,
            nombres: fila.responsable_nombres!,
            apellidos: fila.responsable_apellidos!,
          },
  };
}

function exigirActividad(ctx: Contexto, id: number): FilaActividad {
  const fila = buscarActividad(ctx.bd, id);
  if (!fila) {
    throw new ErrorApi(404, 'ACTIVIDAD_NO_ENCONTRADA', 'La actividad no existe.', {
      actividad_id: id,
    });
  }
  return fila;
}

function referenciaInvalida(campo: string, mensaje: string): ErrorApi {
  return new ErrorApi(422, 'REFERENCIA_INVALIDA', mensaje, { campo });
}

function validar(ctx: Contexto, actividad: ActividadGuardable): void {
  if (!existeTipoActividad(ctx.bd, actividad.tipo_actividad_id)) {
    throw referenciaInvalida('tipo_actividad_id', 'El tipo de actividad no existe.');
  }
  if (actividad.categoria_id !== null && !existeCategoria(ctx.bd, actividad.categoria_id)) {
    throw referenciaInvalida('categoria_id', 'La categoría no existe.');
  }
  if (!existeZonaActiva(ctx.bd, actividad.zona_id)) {
    throw referenciaInvalida('zona_id', 'La zona no existe o no está habilitada.');
  }
  if (actividad.responsable_id !== null && !existePersonaActiva(ctx.bd, actividad.responsable_id)) {
    throw referenciaInvalida('responsable_id', 'El responsable no existe o está inactivo.');
  }
  // I2: el CHECK de la base lo garantiza; aquí se responde con un error legible.
  // La comparación de texto es válida porque ambos valores están en el mismo formato UTC.
  if (actividad.inicio >= actividad.fin) {
    throw new ErrorApi(422, 'HORARIO_INVALIDO', 'El inicio debe ser anterior al fin.', {
      inicio: actividad.inicio,
      fin: actividad.fin,
    });
  }
}

/** I1: debe llamarse dentro de la misma transacción que la escritura (regla 12). */
function exigirZonaLibre(ctx: Contexto, actividad: ActividadGuardable, excluirId: number | null) {
  const ocupante = buscarSolapamiento(
    ctx.bd,
    actividad.zona_id,
    actividad.inicio,
    actividad.fin,
    excluirId,
  );
  if (ocupante) {
    throw new ErrorApi(
      409,
      'HORARIO_OCUPADO',
      `La zona ya está ocupada por «${ocupante.nombre}» en ese horario.`,
      { actividad: ocupante },
    );
  }
}

export function listar(
  ctx: Contexto,
  sesion: SesionActiva,
  filtros: FiltrosActividades,
): ActividadPublica[] {
  const rango = filtros.dia ? rangoUtcDeDia(filtros.dia) : undefined;
  return listarActividades(ctx.bd, {
    desde: rango?.desde ?? null,
    hasta: rango?.hasta ?? null,
    zonaId: filtros.zona_id ?? null,
    tipoId: filtros.tipo_id ?? null,
    categoriaId: filtros.categoria_id ?? null,
  }).map((f) => proyectar(f, sesion));
}

export function obtener(ctx: Contexto, sesion: SesionActiva, id: number): ActividadPublica {
  return proyectar(exigirActividad(ctx, id), sesion);
}

export function crear(
  ctx: Contexto,
  sesion: SesionActiva,
  datos: DatosAltaActividad,
): ActividadPublica {
  const actividad: ActividadGuardable = {
    ...datos,
    descripcion: datos.descripcion ?? null,
    categoria_id: datos.categoria_id ?? null,
    responsable_id: datos.responsable_id ?? null,
  };

  // IMMEDIATE toma el bloqueo de escritura antes de consultar el solapamiento.
  const id = ctx.bd
    .transaction(() => {
      validar(ctx, actividad);
      exigirZonaLibre(ctx, actividad, null);
      const codigo = generarCodigoActividad((c) => existeCodigoActividad(ctx.bd, c));
      return insertarActividad(ctx.bd, { ...actividad, codigo });
    })
    .immediate();

  return obtener(ctx, sesion, id);
}

export function editar(
  ctx: Contexto,
  sesion: SesionActiva,
  id: number,
  cambios: DatosEdicionActividad,
): ActividadPublica {
  ctx.bd
    .transaction(() => {
      const actual = exigirActividad(ctx, id);
      const actividad: ActividadGuardable = {
        nombre: cambios.nombre ?? actual.nombre,
        descripcion: cambios.descripcion !== undefined ? cambios.descripcion : actual.descripcion,
        tipo_actividad_id: cambios.tipo_actividad_id ?? actual.tipo_actividad_id,
        categoria_id:
          cambios.categoria_id !== undefined ? cambios.categoria_id : actual.categoria_id,
        zona_id: cambios.zona_id ?? actual.zona_id,
        responsable_id:
          cambios.responsable_id !== undefined ? cambios.responsable_id : actual.responsable_id,
        inicio: cambios.inicio ?? actual.inicio,
        fin: cambios.fin ?? actual.fin,
      };
      validar(ctx, actividad);
      // Una actividad cancelada no ocupa su zona, así que no puede chocar.
      if (actual.cancelada === 0) exigirZonaLibre(ctx, actividad, id);
      actualizarActividad(ctx.bd, id, actividad);
    })
    .immediate();

  return obtener(ctx, sesion, id);
}

export function cancelar(ctx: Contexto, sesion: SesionActiva, id: number): ActividadPublica {
  const actual = exigirActividad(ctx, id);
  if (actual.cancelada === 1) {
    throw new ErrorApi(409, 'ACTIVIDAD_YA_CANCELADA', 'La actividad ya estaba cancelada.', {
      actividad_id: id,
    });
  }
  marcarCancelada(ctx.bd, id);
  return obtener(ctx, sesion, id);
}
