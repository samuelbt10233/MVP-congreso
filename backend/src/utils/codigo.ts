import { randomInt } from 'node:crypto';

/**
 * Alfabeto de 32 caracteres sin 0, O, 1 ni I, que se confunden al dictarlos o
 * leerlos (D8). Se usa tanto para códigos de acceso como de actividad.
 */
export const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const LONGITUD_CODIGO_ACCESO = 5;
export const LONGITUD_CODIGO_ACTIVIDAD = 4;

export function generarCodigo(longitud: number): string {
  let codigo = '';
  for (let i = 0; i < longitud; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

export function generarCodigoAcceso(): string {
  return generarCodigo(LONGITUD_CODIGO_ACCESO);
}

/** Genera un código de actividad que no esté en uso según `existe` (I5). */
export function generarCodigoActividad(existe: (codigo: string) => boolean): string {
  for (let intento = 0; intento < 100; intento++) {
    const codigo = generarCodigo(LONGITUD_CODIGO_ACTIVIDAD);
    if (!existe(codigo)) return codigo;
  }
  throw new Error('No se pudo generar un código de actividad único');
}

/** Mayúsculas, sin espacios ni guiones (§9.7): así lo escribe la gente. */
export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[\s-]/g, '');
}

export function esCodigoValido(codigo: string, longitud: number): boolean {
  return codigo.length === longitud && [...codigo].every((c) => ALFABETO.includes(c));
}
