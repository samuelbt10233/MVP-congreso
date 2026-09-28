import type { BaseDatos } from '../../db/conexion.js';

export type CredencialAlmacenada = {
  persona_id: number;
  codigo_hash: string;
  persona_activa: number;
  usuario_activo: number;
};

export type PersonaSesion = {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  organizacion: string | null;
  nacionalidad: string | null;
  descripcion: string | null;
  rol: string;
};

export function buscarCredencial(
  bd: BaseDatos,
  numeroDocumento: string,
): CredencialAlmacenada | undefined {
  return bd
    .prepare(
      `SELECT u.persona_id, u.codigo_hash, p.activo AS persona_activa, u.activo AS usuario_activo
       FROM usuario u
       JOIN persona p ON p.id = u.persona_id
       WHERE p.numero_documento = ?`,
    )
    .get(numeroDocumento) as CredencialAlmacenada | undefined;
}

export function registrarAcceso(bd: BaseDatos, personaId: number, fechaHora: string): void {
  bd.prepare('UPDATE usuario SET ultimo_acceso = ? WHERE persona_id = ?').run(fechaHora, personaId);
}

/** Persona con acceso vigente: persona y usuario activos. */
export function buscarPersonaConAcceso(
  bd: BaseDatos,
  personaId: number,
): PersonaSesion | undefined {
  return bd
    .prepare(
      `SELECT p.id, p.tipo_documento, p.numero_documento, p.nombres, p.apellidos, p.correo,
              p.telefono, p.organizacion, p.nacionalidad, p.descripcion, r.nombre AS rol
       FROM persona p
       JOIN rol r ON r.id = p.rol_id
       JOIN usuario u ON u.persona_id = p.id
       WHERE p.id = ? AND p.activo = 1 AND u.activo = 1`,
    )
    .get(personaId) as PersonaSesion | undefined;
}

export function permisosDe(bd: BaseDatos, personaId: number): string[] {
  const filas = bd
    .prepare(
      `SELECT p.codigo
       FROM autorizacion a
       JOIN permiso p ON p.id = a.permiso_id
       WHERE a.persona_id = ?
       ORDER BY p.codigo`,
    )
    .all(personaId) as { codigo: string }[];
  return filas.map((f) => f.codigo);
}
