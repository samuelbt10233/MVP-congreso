import type { BaseDatos } from '../../db/conexion.js';

function contar(bd: BaseDatos, sql: string): number {
  return (bd.prepare(sql).get() as { total: number }).total;
}

export function contarTotales(bd: BaseDatos) {
  return {
    personas: contar(bd, 'SELECT COUNT(*) AS total FROM persona WHERE activo = 1'),
    llegadas: contar(bd, 'SELECT COUNT(*) AS total FROM registro_llegada'),
    asistencias: contar(bd, 'SELECT COUNT(*) AS total FROM registro_actividad'),
    actividades: contar(bd, 'SELECT COUNT(*) AS total FROM actividad WHERE cancelada = 0'),
    actividades_canceladas: contar(
      bd,
      'SELECT COUNT(*) AS total FROM actividad WHERE cancelada = 1',
    ),
  };
}

/** Instantes de llegada; el servicio los agrupa por día local de Bogotá. */
export function instantesDeLlegada(bd: BaseDatos): string[] {
  const filas = bd.prepare('SELECT fecha_hora FROM registro_llegada').all() as {
    fecha_hora: string;
  }[];
  return filas.map((f) => f.fecha_hora);
}

export type FilaAsistenciaActividad = {
  id: number;
  nombre: string;
  inicio: string;
  fin: string;
  cancelada: number;
  zona: string;
  capacidad: number | null;
  asistentes: number;
};

export function asistenciaPorActividad(bd: BaseDatos): FilaAsistenciaActividad[] {
  return bd
    .prepare(
      `SELECT a.id, a.nombre, a.inicio, a.fin, a.cancelada, z.nombre AS zona, z.capacidad,
              COUNT(r.id) AS asistentes
       FROM actividad a
       JOIN zona z ON z.id = a.zona_id
       LEFT JOIN registro_actividad r ON r.actividad_id = a.id
       GROUP BY a.id, a.nombre, a.inicio, a.fin, a.cancelada, z.nombre, z.capacidad
       ORDER BY a.inicio, z.nombre, a.id`,
    )
    .all() as FilaAsistenciaActividad[];
}
