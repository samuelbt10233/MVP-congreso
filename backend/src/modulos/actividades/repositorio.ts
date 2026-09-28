import type { BaseDatos } from '../../db/conexion.js';

export type FilaActividad = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  cancelada: number;
  tipo_actividad_id: number;
  tipo: string;
  categoria_id: number | null;
  categoria: string | null;
  zona_id: number;
  zona: string;
  piso: number | null;
  capacidad: number | null;
  edificio_id: number;
  edificio: string;
  responsable_id: number | null;
  responsable_nombres: string | null;
  responsable_apellidos: string | null;
};

export type ActividadGuardable = {
  nombre: string;
  descripcion: string | null;
  tipo_actividad_id: number;
  categoria_id: number | null;
  zona_id: number;
  responsable_id: number | null;
  inicio: string;
  fin: string;
};

const SELECT_ACTIVIDAD = `
  SELECT a.id, a.codigo, a.nombre, a.descripcion, a.inicio, a.fin, a.cancelada,
         a.tipo_actividad_id, t.nombre AS tipo,
         a.categoria_id, c.nombre AS categoria,
         a.zona_id, z.nombre AS zona, z.piso, z.capacidad,
         z.edificio_id, e.nombre AS edificio,
         a.responsable_id, r.nombres AS responsable_nombres, r.apellidos AS responsable_apellidos
  FROM actividad a
  JOIN tipo_actividad t ON t.id = a.tipo_actividad_id
  LEFT JOIN categoria c ON c.id = a.categoria_id
  JOIN zona z ON z.id = a.zona_id
  JOIN edificio e ON e.id = z.edificio_id
  LEFT JOIN persona r ON r.id = a.responsable_id`;

export function listarActividades(
  bd: BaseDatos,
  filtros: {
    desde: string | null;
    hasta: string | null;
    zonaId: number | null;
    tipoId: number | null;
    categoriaId: number | null;
  },
): FilaActividad[] {
  return bd
    .prepare(
      `${SELECT_ACTIVIDAD}
       WHERE (:desde IS NULL OR a.inicio >= :desde)
         AND (:hasta IS NULL OR a.inicio < :hasta)
         AND (:zonaId IS NULL OR a.zona_id = :zonaId)
         AND (:tipoId IS NULL OR a.tipo_actividad_id = :tipoId)
         AND (:categoriaId IS NULL OR a.categoria_id = :categoriaId)
       ORDER BY a.inicio, z.nombre, a.id`,
    )
    .all(filtros) as FilaActividad[];
}

export function buscarActividad(bd: BaseDatos, id: number): FilaActividad | undefined {
  return bd.prepare(`${SELECT_ACTIVIDAD} WHERE a.id = ?`).get(id) as FilaActividad | undefined;
}

export type ActividadOcupante = { id: number; nombre: string; inicio: string; fin: string };

/** Consulta de solapamiento de I1 (§4). Contiguas no chocan: la comparación es estricta. */
export function buscarSolapamiento(
  bd: BaseDatos,
  zonaId: number,
  inicio: string,
  fin: string,
  excluirId: number | null,
): ActividadOcupante | undefined {
  return bd
    .prepare(
      `SELECT id, nombre, inicio, fin FROM actividad
       WHERE zona_id = :zonaId
         AND cancelada = 0
         AND id != COALESCE(:excluirId, -1)
         AND inicio < :fin
         AND fin > :inicio
       LIMIT 1`,
    )
    .get({ zonaId, inicio, fin, excluirId }) as ActividadOcupante | undefined;
}

export function existeCodigoActividad(bd: BaseDatos, codigo: string): boolean {
  return bd.prepare('SELECT 1 FROM actividad WHERE codigo = ?').get(codigo) !== undefined;
}

export function insertarActividad(
  bd: BaseDatos,
  actividad: ActividadGuardable & { codigo: string },
): number {
  const resultado = bd
    .prepare(
      `INSERT INTO actividad (codigo, nombre, descripcion, tipo_actividad_id, categoria_id,
                              zona_id, responsable_id, inicio, fin)
       VALUES (@codigo, @nombre, @descripcion, @tipo_actividad_id, @categoria_id,
               @zona_id, @responsable_id, @inicio, @fin)`,
    )
    .run(actividad);
  return Number(resultado.lastInsertRowid);
}

export function actualizarActividad(
  bd: BaseDatos,
  id: number,
  actividad: ActividadGuardable,
): void {
  bd.prepare(
    `UPDATE actividad
     SET nombre = @nombre, descripcion = @descripcion, tipo_actividad_id = @tipo_actividad_id,
         categoria_id = @categoria_id, zona_id = @zona_id, responsable_id = @responsable_id,
         inicio = @inicio, fin = @fin
     WHERE id = @id`,
  ).run({ ...actividad, id });
}

export function marcarCancelada(bd: BaseDatos, id: number): void {
  bd.prepare('UPDATE actividad SET cancelada = 1 WHERE id = ?').run(id);
}

export function existeTipoActividad(bd: BaseDatos, id: number): boolean {
  return bd.prepare('SELECT 1 FROM tipo_actividad WHERE id = ?').get(id) !== undefined;
}

export function existeCategoria(bd: BaseDatos, id: number): boolean {
  return bd.prepare('SELECT 1 FROM categoria WHERE id = ?').get(id) !== undefined;
}

export function existeZonaActiva(bd: BaseDatos, id: number): boolean {
  return bd.prepare('SELECT 1 FROM zona WHERE id = ? AND activa = 1').get(id) !== undefined;
}

export function existePersonaActiva(bd: BaseDatos, id: number): boolean {
  return bd.prepare('SELECT 1 FROM persona WHERE id = ? AND activo = 1').get(id) !== undefined;
}
