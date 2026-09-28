import type { Contexto } from '../../contexto.js';
import type { SesionActiva } from '../../middleware/autenticacion.js';
import { ErrorApi } from '../../middleware/errores.js';
import { generarCodigoAcceso } from '../../utils/codigo.js';
import { aUtcSql } from '../../utils/fechas.js';
import { hashCodigo } from '../../utils/hash.js';
import { PLANTILLAS_ROL, type CodigoPermiso, type NombreRol } from '../permisos/catalogo.js';
import type { DatosAltaPersona, DatosEdicionPersona } from './esquemas.js';
import {
  actualizarPersona,
  buscarPersona,
  contarPersonas,
  existeDocumento,
  guardarCodigo,
  idRol,
  insertarPersona,
  listarPersonas,
  nombreRol,
  otorgarPermisos,
  permisosDePersona,
  revocarPermisosSalvo,
  tieneUsuario,
  type FilaPersona,
} from './repositorio.js';

export const POR_PAGINA = 20;

/** Rol con el que da de alta quien no puede gestionar permisos (I12). */
const ROL_SIN_PERMISOS: NombreRol = 'visitante';

export type PersonaPublica = {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  organizacion: string | null;
  nacionalidad: string | null;
  descripcion: string | null;
  rol_id: number;
  rol: string;
  activo: boolean;
  correo?: string | null;
  telefono?: string | null;
};

export function enmascararDocumento(numero: string): string {
  return `****${numero.length > 4 ? numero.slice(-4) : ''}`;
}

/**
 * Lo que ve del directorio quien consulta (§9.6): con `persona.editar`, documento
 * completo, correo y teléfono; sin él, documento enmascarado y sin contacto.
 */
function proyectar(fila: FilaPersona, sesion: SesionActiva): PersonaPublica {
  const completa = sesion.permisos.has('persona.editar');
  const persona: PersonaPublica = {
    id: fila.id,
    tipo_documento: fila.tipo_documento,
    numero_documento: completa ? fila.numero_documento : enmascararDocumento(fila.numero_documento),
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    organizacion: fila.organizacion,
    nacionalidad: fila.nacionalidad,
    descripcion: fila.descripcion,
    rol_id: fila.rol_id,
    rol: fila.rol,
    activo: fila.activo === 1,
  };
  if (completa) {
    persona.correo = fila.correo;
    persona.telefono = fila.telefono;
  }
  return persona;
}

function personaNoEncontrada(id: number): ErrorApi {
  return new ErrorApi(404, 'PERSONA_NO_ENCONTRADA', 'La persona no existe.', { persona_id: id });
}

function documentoDuplicado(numero: string): ErrorApi {
  return new ErrorApi(
    409,
    'DOCUMENTO_DUPLICADO',
    'Ya existe una persona registrada con ese número de documento.',
    { numero_documento: numero },
  );
}

function exigirPersona(ctx: Contexto, id: number): FilaPersona {
  const fila = buscarPersona(ctx.bd, id);
  if (!fila) throw personaNoEncontrada(id);
  return fila;
}

function exigirRol(ctx: Contexto, rolId: number): NombreRol {
  const nombre = nombreRol(ctx.bd, rolId);
  if (!nombre) {
    throw new ErrorApi(422, 'REFERENCIA_INVALIDA', 'El rol indicado no existe.', {
      campo: 'rol_id',
    });
  }
  return nombre as NombreRol;
}

export function listar(
  ctx: Contexto,
  sesion: SesionActiva,
  filtros: { q?: string; pagina: number },
) {
  const q = filtros.q ? `%${filtros.q}%` : null;
  const total = contarPersonas(ctx.bd, q);
  const filas = listarPersonas(ctx.bd, q, POR_PAGINA, (filtros.pagina - 1) * POR_PAGINA);
  return {
    items: filas.map((f) => proyectar(f, sesion)),
    pagina: filtros.pagina,
    por_pagina: POR_PAGINA,
    total,
  };
}

export function obtener(ctx: Contexto, sesion: SesionActiva, id: number): PersonaPublica {
  return proyectar(exigirPersona(ctx, id), sesion);
}

/**
 * Alta de persona: aplica la plantilla de su rol, crea su usuario y devuelve el
 * código de acceso en claro por única vez (regla 3).
 */
export async function darDeAlta(ctx: Contexto, sesion: SesionActiva, datos: DatosAltaPersona) {
  const rolId = datos.rol_id ?? idRol(ctx.bd, ROL_SIN_PERMISOS)!;
  const rol = exigirRol(ctx, rolId);

  // I12: la plantilla del rol otorga permisos; sin permiso.gestionar solo se
  // admite un rol cuya plantilla no otorga ninguno.
  if (!sesion.permisos.has('permiso.gestionar') && rol !== ROL_SIN_PERMISOS) {
    throw new ErrorApi(
      403,
      'ALTA_ROL_NO_PERMITIDA',
      'Solo puedes dar de alta personas con rol de visitante.',
      { rol },
    );
  }

  // bcrypt es asíncrono: se calcula antes de la transacción, que es síncrona.
  const codigo = generarCodigoAcceso();
  const codigoHash = await hashCodigo(codigo);

  const personaId = ctx.bd.transaction(() => {
    if (existeDocumento(ctx.bd, datos.numero_documento)) {
      throw documentoDuplicado(datos.numero_documento);
    }
    const id = insertarPersona(ctx.bd, { ...datos, rol_id: rolId });
    otorgarPermisos(ctx.bd, id, PLANTILLAS_ROL[rol], sesion.persona.id);
    guardarCodigo(ctx.bd, id, codigoHash, aUtcSql(ctx.ahora()));
    return id;
  })();

  return {
    persona: obtener(ctx, sesion, personaId),
    permisos: permisosDePersona(ctx.bd, personaId),
    codigo_acceso: codigo,
  };
}

export function editar(
  ctx: Contexto,
  sesion: SesionActiva,
  id: number,
  cambios: DatosEdicionPersona,
): PersonaPublica {
  ctx.bd.transaction(() => {
    exigirPersona(ctx, id);
    if (cambios.rol_id !== undefined) exigirRol(ctx, cambios.rol_id);
    if (
      cambios.numero_documento !== undefined &&
      existeDocumento(ctx.bd, cambios.numero_documento, id)
    ) {
      throw documentoDuplicado(cambios.numero_documento);
    }
    actualizarPersona(ctx.bd, id, cambios);
  })();
  return obtener(ctx, sesion, id);
}

export function permisosDe(ctx: Contexto, id: number): string[] {
  exigirPersona(ctx, id);
  return permisosDePersona(ctx.bd, id);
}

export function reemplazarPermisos(
  ctx: Contexto,
  sesion: SesionActiva,
  id: number,
  permisos: readonly CodigoPermiso[],
): string[] {
  // I13: quien gestiona permisos no puede quitarse ese permiso a sí mismo; se
  // quedaría sin forma de devolvérselo.
  if (id === sesion.persona.id && !permisos.includes('permiso.gestionar')) {
    throw new ErrorApi(
      422,
      'AUTOREVOCACION_NO_PERMITIDA',
      'No puedes quitarte a ti mismo el permiso de gestionar permisos.',
      { permiso: 'permiso.gestionar' },
    );
  }

  ctx.bd.transaction(() => {
    exigirPersona(ctx, id);
    revocarPermisosSalvo(ctx.bd, id, permisos);
    otorgarPermisos(ctx.bd, id, permisos, sesion.persona.id);
  })();
  return permisosDePersona(ctx.bd, id);
}

/**
 * Genera un código de acceso nuevo, creando el usuario si no existía. La regla
 * I11 está pospuesta: `usuario.gestionar` solo lo tiene el administrador (regla 6).
 */
export async function generarCodigo(ctx: Contexto, id: number) {
  exigirPersona(ctx, id);
  const codigo = generarCodigoAcceso();
  const codigoHash = await hashCodigo(codigo);
  const creado = !tieneUsuario(ctx.bd, id);
  guardarCodigo(ctx.bd, id, codigoHash, aUtcSql(ctx.ahora()));
  return { creado, codigo_acceso: codigo };
}
