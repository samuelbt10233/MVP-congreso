import type { z } from 'zod';
import { ErrorApi } from '../middleware/errores.js';

/**
 * Valida parámetros de ruta o de consulta. Los cuerpos se validan con `.parse()`
 * y el manejador central los traduce a 400 CUERPO_INVALIDO.
 */
export function leerParametros<E extends z.ZodType>(esquema: E, datos: unknown): z.infer<E> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorApi(400, 'PARAMETRO_INVALIDO', 'Parámetros de la petición inválidos.', {
      campos: resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }
  return resultado.data;
}

/** Identificador numérico de la ruta (`/recurso/:id`). */
export function idDeRuta(valor: string | string[] | undefined): number {
  const id = typeof valor === 'string' ? Number(valor) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErrorApi(400, 'PARAMETRO_INVALIDO', 'El identificador debe ser un entero positivo.', {
      campos: [{ campo: 'id', mensaje: 'Debe ser un entero positivo' }],
    });
  }
  return id;
}
