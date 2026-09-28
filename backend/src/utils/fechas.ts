/**
 * Fechas del sistema (§7 del diseño, regla 10 de CLAUDE.md).
 *
 * En la base todo se guarda en UTC con formato 'YYYY-MM-DD HH:MM:SS'. Colombia no
 * aplica horario de verano, así que el día local de Bogotá se obtiene con un
 * offset fijo de −5 horas, igual que el índice único de registro_llegada.
 */

const OFFSET_BOGOTA_MS = -5 * 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;

const FORMATO_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte un instante al formato de almacenamiento: UTC 'YYYY-MM-DD HH:MM:SS'. */
export function aUtcSql(fecha: Date): string {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

/** Interpreta un valor almacenado ('YYYY-MM-DD HH:MM:SS', UTC) como instante. */
export function desdeUtcSql(valor: string): Date {
  if (!FORMATO_UTC.test(valor)) {
    throw new Error(`Fecha con formato inválido: ${valor}`);
  }
  return new Date(`${valor.replace(' ', 'T')}Z`);
}

export function esUtcSql(valor: string): boolean {
  return FORMATO_UTC.test(valor) && !Number.isNaN(desdeUtcSql(valor).getTime());
}

export function esDia(valor: string): boolean {
  return FORMATO_DIA.test(valor) && !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime());
}

/** Día local de Bogotá ('YYYY-MM-DD') al que pertenece un instante. */
export function diaBogota(fecha: Date): string {
  return new Date(fecha.getTime() + OFFSET_BOGOTA_MS).toISOString().slice(0, 10);
}

/** Instante que corresponde a una fecha y hora locales de Bogotá. */
export function instanteBogota(dia: string, hora = '00:00'): Date {
  const local = new Date(`${dia}T${hora}:00Z`);
  return new Date(local.getTime() - OFFSET_BOGOTA_MS);
}

/** Suma días a un día local ('YYYY-MM-DD'). */
export function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * MINUTO_MS);
}

/**
 * Rango UTC [desde, hasta) que cubre un día local de Bogotá. Es la única
 * conversión de zona horaria que hace el backend: la usa el filtro `dia`.
 */
export function rangoUtcDeDia(dia: string): { desde: string; hasta: string } {
  return {
    desde: aUtcSql(instanteBogota(dia)),
    hasta: aUtcSql(instanteBogota(sumarDias(dia, 1))),
  };
}
