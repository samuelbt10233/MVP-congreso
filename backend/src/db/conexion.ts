import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

export type BaseDatos = Database.Database;

export const RUTA_BASE_POR_DEFECTO = fileURLToPath(
  new URL('../../database/congreso.db', import.meta.url),
);

export function rutaBase(): string {
  return process.env.RUTA_BD ?? RUTA_BASE_POR_DEFECTO;
}

/**
 * Abre una conexión. Toda conexión pasa por aquí para que las llaves foráneas
 * queden activas en cada una, no solo en la primera (regla 11).
 */
export function abrirBase(ruta: string): BaseDatos {
  const bd = new Database(ruta);
  bd.pragma('foreign_keys = ON');
  return bd;
}

let base: BaseDatos | undefined;

/** Conexión compartida del servidor. */
export function obtenerBase(): BaseDatos {
  base ??= abrirBase(rutaBase());
  return base;
}
