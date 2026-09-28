import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sembrarCatalogo } from '../../database/semillas/catalogo.js';
import { sembrarDemo, type ResumenDemo } from '../../database/semillas/demo.js';
import { abrirBase, type BaseDatos } from './conexion.js';

const RUTA_ESQUEMA = fileURLToPath(new URL('../../database/esquema.sql', import.meta.url));

/** Crea las tablas sobre una base vacía (D11: el esquema es un solo archivo). */
export function aplicarEsquema(bd: BaseDatos): void {
  bd.exec(readFileSync(RUTA_ESQUEMA, 'utf8'));
}

/** Esquema y catálogos; con `demo`, además los datos de demostración. */
export async function poblarBase(
  bd: BaseDatos,
  opciones: { demo?: boolean; ahora?: Date } = {},
): Promise<ResumenDemo | undefined> {
  aplicarEsquema(bd);
  sembrarCatalogo(bd);
  return opciones.demo === false ? undefined : sembrarDemo(bd, opciones.ahora);
}

/** Borra el archivo de base (con sus auxiliares) y lo recrea desde cero. */
export async function resetearArchivo(ruta: string, ahora = new Date()): Promise<ResumenDemo> {
  for (const sufijo of ['', '-wal', '-shm', '-journal']) {
    rmSync(`${ruta}${sufijo}`, { force: true });
  }
  const bd = abrirBase(ruta);
  try {
    return (await poblarBase(bd, { ahora }))!;
  } finally {
    bd.close();
  }
}
