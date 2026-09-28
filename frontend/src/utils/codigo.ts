/**
 * Normaliza lo que la persona teclea (§9.7): mayúsculas, sin espacios ni guiones.
 * El servidor aplica la misma normalización; aquí sirve para mostrar el texto en
 * mayúscula fija mientras se escribe.
 */
export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[\s-]/g, '');
}
