import type { Contexto } from '../../contexto.js';
import type { SesionActiva } from '../../middleware/autenticacion.js';
import { ErrorApi } from '../../middleware/errores.js';
import { normalizarCodigo } from '../../utils/codigo.js';
import {
  aUtcSql,
  desdeUtcSql,
  diaBogota,
  rangoUtcDeDia,
  sumarMinutos,
} from '../../utils/fechas.js';
import {
  buscarActividadPorCodigo,
  buscarActividadPorId,
  buscarAsistencia,
  buscarLlegadaEnRango,
  buscarPersonaPorDocumento,
  contarLlegadas,
  insertarAsistencia,
  insertarLlegada,
  listarAsistenciasDe,
  listarAsistentes,
  listarLlegadas,
  type PersonaRecepcion,
} from './repositorio.js';

function personaNoEncontrada(): ErrorApi {
  return new ErrorApi(
    404,
    'PERSONA_NO_ENCONTRADA',
    'No hay ninguna persona registrada con ese documento.',
  );
}

function resumenPersona(p: PersonaRecepcion) {
  return {
    id: p.id,
    nombres: p.nombres,
    apellidos: p.apellidos,
    rol: p.rol,
    activo: p.activo === 1,
  };
}

function llegadaDeHoy(ctx: Contexto, personaId: number) {
  const { desde, hasta } = rangoUtcDeDia(diaBogota(ctx.ahora()));
  return buscarLlegadaEnRango(ctx.bd, personaId, desde, hasta);
}

// ---------- Recepción (§6.1) ----------

/** Búsqueda reducida de la entrada: no expone el directorio (§3.3). */
export function buscarEnRecepcion(ctx: Contexto, numeroDocumento: string) {
  const persona = buscarPersonaPorDocumento(ctx.bd, numeroDocumento);
  if (!persona) throw personaNoEncontrada();
  const llegada = llegadaDeHoy(ctx, persona.id);
  return {
    persona: resumenPersona(persona),
    llegada_hoy: llegada ? { fecha_hora: llegada.fecha_hora } : null,
  };
}

/** Contador de la pantalla de recepción (§9.6): solo el total, sin nombres. */
export function resumenRecepcion(ctx: Contexto) {
  const dia = diaBogota(ctx.ahora());
  const { desde, hasta } = rangoUtcDeDia(dia);
  return { dia, llegadas: contarLlegadas(ctx.bd, desde, hasta) };
}

/** I4: una llegada por persona y día local de Bogotá. */
export function registrarLlegada(ctx: Contexto, sesion: SesionActiva, numeroDocumento: string) {
  const persona = buscarPersonaPorDocumento(ctx.bd, numeroDocumento);
  if (!persona) throw personaNoEncontrada();

  const fechaHora = aUtcSql(ctx.ahora());
  const id = ctx.bd
    .transaction(() => {
      const previa = llegadaDeHoy(ctx, persona.id);
      if (previa) {
        throw new ErrorApi(
          409,
          'LLEGADA_YA_REGISTRADA',
          'La llegada de esta persona ya se registró hoy.',
          { fecha_hora: previa.fecha_hora },
        );
      }
      // El índice único de la base es la garantía final; la consulta previa permite
      // responder con la hora del registro anterior.
      return insertarLlegada(ctx.bd, persona.id, sesion.persona.id, fechaHora);
    })
    .immediate();

  return { persona: resumenPersona(persona), llegada: { id, fecha_hora: fechaHora } };
}

export function listarLlegadasDelDia(ctx: Contexto, dia: string | undefined) {
  const diaConsultado = dia ?? diaBogota(ctx.ahora());
  const { desde, hasta } = rangoUtcDeDia(diaConsultado);
  const filas = listarLlegadas(ctx.bd, desde, hasta);
  return {
    dia: diaConsultado,
    total: filas.length,
    llegadas: filas.map((f) => ({
      id: f.id,
      fecha_hora: f.fecha_hora,
      persona: { id: f.persona_id, nombres: f.nombres, apellidos: f.apellidos, rol: f.rol },
      registrado_por: {
        id: f.registrador_id,
        nombres: f.registrador_nombres,
        apellidos: f.registrador_apellidos,
      },
    })),
  };
}

// ---------- Asistencia (§6.2) ----------

/**
 * Registro de asistencia por autoservicio. Las validaciones van en el orden del
 * diseño: código existente, no cancelada (I9), dentro de la ventana (I7) y sin
 * registro previo (I3).
 */
export function registrarAsistencia(ctx: Contexto, sesion: SesionActiva, codigoTecleado: string) {
  const codigo = normalizarCodigo(codigoTecleado);
  const ahora = ctx.ahora();
  const fechaHora = aUtcSql(ahora);

  return ctx.bd
    .transaction(() => {
      const actividad = codigo ? buscarActividadPorCodigo(ctx.bd, codigo) : undefined;
      if (!actividad) {
        throw new ErrorApi(
          422,
          'CODIGO_ACTIVIDAD_INVALIDO',
          'El código no corresponde a ninguna actividad.',
        );
      }

      if (actividad.cancelada === 1) {
        throw new ErrorApi(422, 'ACTIVIDAD_CANCELADA', 'Esta actividad fue cancelada.', {
          actividad_id: actividad.id,
        });
      }

      const abre = sumarMinutos(desdeUtcSql(actividad.inicio), -ctx.ventanaAsistenciaAntesMin);
      const cierra = desdeUtcSql(actividad.fin);
      if (ahora < abre || ahora > cierra) {
        throw new ErrorApi(
          422,
          'FUERA_DE_VENTANA',
          ahora < abre
            ? 'El registro de asistencia a esta actividad aún no ha abierto.'
            : 'La actividad ya terminó; el registro de asistencia está cerrado.',
          { actividad_id: actividad.id, abre: aUtcSql(abre), cierra: aUtcSql(cierra) },
        );
      }

      const previa = buscarAsistencia(ctx.bd, sesion.persona.id, actividad.id);
      if (previa) {
        throw new ErrorApi(
          409,
          'ASISTENCIA_YA_REGISTRADA',
          'Ya registraste tu asistencia a esta actividad.',
          { actividad_id: actividad.id, fecha_hora: previa.fecha_hora },
        );
      }

      insertarAsistencia(ctx.bd, sesion.persona.id, actividad.id, fechaHora);
      return {
        actividad: { id: actividad.id, nombre: actividad.nombre, zona: actividad.zona },
        fecha_hora: fechaHora,
      };
    })
    .immediate();
}

export function asistenciasPropias(ctx: Contexto, sesion: SesionActiva) {
  return listarAsistenciasDe(ctx.bd, sesion.persona.id).map((f) => ({
    fecha_hora: f.fecha_hora,
    actividad: {
      id: f.actividad_id,
      nombre: f.nombre,
      inicio: f.inicio,
      fin: f.fin,
      zona: f.zona,
    },
  }));
}

/**
 * Asistentes de una actividad: con `registro.leer`, o siendo su responsable
 * (§9.4). No es un permiso aparte sino una regla del endpoint.
 */
export function asistentesDe(ctx: Contexto, sesion: SesionActiva, actividadId: number) {
  const actividad = buscarActividadPorId(ctx.bd, actividadId);
  if (!actividad) {
    throw new ErrorApi(404, 'ACTIVIDAD_NO_ENCONTRADA', 'La actividad no existe.', {
      actividad_id: actividadId,
    });
  }
  const esResponsable = actividad.responsable_id === sesion.persona.id;
  if (!sesion.permisos.has('registro.leer') && !esResponsable) {
    throw new ErrorApi(403, 'SIN_PERMISO', 'No tienes permiso para realizar esta acción.', {
      permiso: 'registro.leer',
    });
  }

  const filas = listarAsistentes(ctx.bd, actividadId);
  return {
    actividad: { id: actividad.id, nombre: actividad.nombre },
    total: filas.length,
    asistentes: filas.map((f) => ({
      fecha_hora: f.fecha_hora,
      persona: {
        id: f.persona_id,
        nombres: f.nombres,
        apellidos: f.apellidos,
        rol: f.rol,
        organizacion: f.organizacion,
      },
    })),
  };
}
