import type { BaseDatos } from '../../db/conexion.js';

type Fila = Record<string, unknown>;

export function listarRoles(bd: BaseDatos) {
  return bd.prepare('SELECT id, nombre, descripcion FROM rol ORDER BY id').all() as Fila[];
}

export function listarPermisos(bd: BaseDatos) {
  return bd
    .prepare('SELECT id, codigo, nombre, descripcion FROM permiso ORDER BY id')
    .all() as Fila[];
}

export function listarTiposActividad(bd: BaseDatos) {
  return bd
    .prepare('SELECT id, nombre, descripcion FROM tipo_actividad ORDER BY nombre')
    .all() as Fila[];
}

export function listarCategorias(bd: BaseDatos) {
  return bd
    .prepare('SELECT id, nombre, descripcion FROM categoria ORDER BY nombre')
    .all() as Fila[];
}

export type FilaZona = {
  id: number;
  edificio_id: number;
  edificio: string;
  edificio_descripcion: string | null;
  nombre: string;
  piso: number | null;
  capacidad: number | null;
  descripcion: string | null;
  activa: number;
};

export function listarZonas(bd: BaseDatos): FilaZona[] {
  return bd
    .prepare(
      `SELECT z.id, z.edificio_id, e.nombre AS edificio, e.descripcion AS edificio_descripcion,
              z.nombre, z.piso, z.capacidad, z.descripcion, z.activa
       FROM zona z
       JOIN edificio e ON e.id = z.edificio_id
       ORDER BY e.nombre, z.piso, z.nombre`,
    )
    .all() as FilaZona[];
}
