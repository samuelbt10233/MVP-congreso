import type { BaseDatos } from '../../db/conexion.js';

export type PersonaRecepcion = {
  id: number;
  nombres: string;
  apellidos: string;
  rol: string;
  activo: number;
};

/** Solo lo que necesita la entrada: nombre, rol y estado (§6.1). */
export function buscarPersonaPorDocumento(
  bd: BaseDatos,
  numeroDocumento: string,
): PersonaRecepcion | undefined {
  return bd
    .prepare(
      `SELECT p.id, p.nombres, p.apellidos, r.nombre AS rol, p.activo
       FROM persona p JOIN rol r ON r.id = p.rol_id
       WHERE p.numero_documento = ?`,
    )
    .get(numeroDocumento) as PersonaRecepcion | undefined;
}

/**
 * Llegada de una persona dentro de un rango UTC. El día local se traduce a rango
 * en el servicio para no depender de funciones de fecha del motor (regla 14).
 */
export function buscarLlegadaEnRango(
  bd: BaseDatos,
  personaId: number,
  desde: string,
  hasta: string,
): { id: number; fecha_hora: string } | undefined {
  return bd
    .prepare(
      `SELECT id, fecha_hora FROM registro_llegada
       WHERE persona_id = ? AND fecha_hora >= ? AND fecha_hora < ?`,
    )
    .get(personaId, desde, hasta) as { id: number; fecha_hora: string } | undefined;
}

export function insertarLlegada(
  bd: BaseDatos,
  personaId: number,
  registradoPor: number,
  fechaHora: string,
): number {
  const resultado = bd
    .prepare(
      'INSERT INTO registro_llegada (persona_id, registrado_por, fecha_hora) VALUES (?, ?, ?)',
    )
    .run(personaId, registradoPor, fechaHora);
  return Number(resultado.lastInsertRowid);
}

export type FilaLlegada = {
  id: number;
  fecha_hora: string;
  persona_id: number;
  nombres: string;
  apellidos: string;
  rol: string;
  registrador_id: number;
  registrador_nombres: string;
  registrador_apellidos: string;
};

export function listarLlegadas(bd: BaseDatos, desde: string, hasta: string): FilaLlegada[] {
  return bd
    .prepare(
      `SELECT l.id, l.fecha_hora,
              p.id AS persona_id, p.nombres, p.apellidos, r.nombre AS rol,
              g.id AS registrador_id, g.nombres AS registrador_nombres,
              g.apellidos AS registrador_apellidos
       FROM registro_llegada l
       JOIN persona p ON p.id = l.persona_id
       JOIN rol r ON r.id = p.rol_id
       JOIN persona g ON g.id = l.registrado_por
       WHERE l.fecha_hora >= ? AND l.fecha_hora < ?
       ORDER BY l.fecha_hora DESC, l.id DESC`,
    )
    .all(desde, hasta) as FilaLlegada[];
}

export type ActividadAsistencia = {
  id: number;
  nombre: string;
  inicio: string;
  fin: string;
  cancelada: number;
  responsable_id: number | null;
  zona: string;
};

export function buscarActividadPorCodigo(
  bd: BaseDatos,
  codigo: string,
): ActividadAsistencia | undefined {
  return bd
    .prepare(
      `SELECT a.id, a.nombre, a.inicio, a.fin, a.cancelada, a.responsable_id, z.nombre AS zona
       FROM actividad a JOIN zona z ON z.id = a.zona_id
       WHERE a.codigo = ?`,
    )
    .get(codigo) as ActividadAsistencia | undefined;
}

export function buscarActividadPorId(bd: BaseDatos, id: number): ActividadAsistencia | undefined {
  return bd
    .prepare(
      `SELECT a.id, a.nombre, a.inicio, a.fin, a.cancelada, a.responsable_id, z.nombre AS zona
       FROM actividad a JOIN zona z ON z.id = a.zona_id
       WHERE a.id = ?`,
    )
    .get(id) as ActividadAsistencia | undefined;
}

export function buscarAsistencia(
  bd: BaseDatos,
  personaId: number,
  actividadId: number,
): { fecha_hora: string } | undefined {
  return bd
    .prepare('SELECT fecha_hora FROM registro_actividad WHERE persona_id = ? AND actividad_id = ?')
    .get(personaId, actividadId) as { fecha_hora: string } | undefined;
}

export function insertarAsistencia(
  bd: BaseDatos,
  personaId: number,
  actividadId: number,
  fechaHora: string,
): void {
  bd.prepare(
    'INSERT INTO registro_actividad (persona_id, actividad_id, fecha_hora) VALUES (?, ?, ?)',
  ).run(personaId, actividadId, fechaHora);
}

export type FilaAsistenciaPropia = {
  fecha_hora: string;
  actividad_id: number;
  nombre: string;
  inicio: string;
  fin: string;
  zona: string;
};

export function listarAsistenciasDe(bd: BaseDatos, personaId: number): FilaAsistenciaPropia[] {
  return bd
    .prepare(
      `SELECT r.fecha_hora, a.id AS actividad_id, a.nombre, a.inicio, a.fin, z.nombre AS zona
       FROM registro_actividad r
       JOIN actividad a ON a.id = r.actividad_id
       JOIN zona z ON z.id = a.zona_id
       WHERE r.persona_id = ?
       ORDER BY r.fecha_hora DESC`,
    )
    .all(personaId) as FilaAsistenciaPropia[];
}

export type FilaAsistente = {
  fecha_hora: string;
  persona_id: number;
  nombres: string;
  apellidos: string;
  rol: string;
  organizacion: string | null;
};

export function listarAsistentes(bd: BaseDatos, actividadId: number): FilaAsistente[] {
  return bd
    .prepare(
      `SELECT r.fecha_hora, p.id AS persona_id, p.nombres, p.apellidos, ro.nombre AS rol,
              p.organizacion
       FROM registro_actividad r
       JOIN persona p ON p.id = r.persona_id
       JOIN rol ro ON ro.id = p.rol_id
       WHERE r.actividad_id = ?
       ORDER BY r.fecha_hora, p.apellidos`,
    )
    .all(actividadId) as FilaAsistente[];
}
