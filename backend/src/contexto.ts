import type { BaseDatos } from './db/conexion.js';
import type { AlmacenSesiones } from './modulos/auth/sesiones.js';

/** Dependencias compartidas por rutas y middleware; las pruebas inyectan las suyas. */
export type Contexto = {
  bd: BaseDatos;
  sesiones: AlmacenSesiones;
  /** Reloj del servidor; las reglas que dependen de la hora lo consultan aquí. */
  ahora: () => Date;
  /** Minutos antes del inicio en que abre el registro de asistencia (I7). */
  ventanaAsistenciaAntesMin: number;
};

export const VENTANA_ASISTENCIA_POR_DEFECTO_MIN = 15;

/** `VENTANA_ASISTENCIA_ANTES_MIN` del entorno, o el valor por defecto. */
export function ventanaDesdeEntorno(): number {
  const valor = process.env.VENTANA_ASISTENCIA_ANTES_MIN;
  if (valor === undefined || valor === '') return VENTANA_ASISTENCIA_POR_DEFECTO_MIN;
  const minutos = Number(valor);
  if (!Number.isInteger(minutos) || minutos < 0) {
    throw new Error(`VENTANA_ASISTENCIA_ANTES_MIN inválida: ${valor}`);
  }
  return minutos;
}
