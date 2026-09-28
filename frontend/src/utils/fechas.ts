/**
 * La API entrega instantes en UTC 'YYYY-MM-DD HH:MM:SS'; aquí se muestran en hora
 * de Bogotá (regla 10 de CLAUDE.md).
 */

const ZONA = 'America/Bogota';

export function desdeUtc(valor: string): Date {
  return new Date(`${valor.replace(' ', 'T')}Z`);
}

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const formatoDia = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// en-CA da 'YYYY-MM-DD', que es el formato del filtro `dia` de la API.
const formatoIso = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function hora(valor: string): string {
  return formatoHora.format(desdeUtc(valor));
}

/** Día local de Bogotá ('YYYY-MM-DD') de un instante. */
export function diaBogota(valor: string | Date): string {
  return formatoIso.format(typeof valor === 'string' ? desdeUtc(valor) : valor);
}

/** 'jueves, 15 de octubre' a partir de un día local 'YYYY-MM-DD'. */
export function nombreDia(dia: string): string {
  // Mediodía de Bogotá: cae en el mismo día sin importar la zona del navegador.
  const texto = formatoDia.format(new Date(`${dia}T17:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function rangoHoras(inicio: string, fin: string): string {
  return `${hora(inicio)} – ${hora(fin)}`;
}

export function fechaHora(valor: string): string {
  return `${nombreDia(diaBogota(valor))}, ${hora(valor)}`;
}

/** Instante ISO-8601 con la zona de Bogotá, como lo acepta la API: '2026-10-15T08:00:00-05:00'. */
export function isoBogota(dia: string, horaMinuto: string): string {
  return `${dia}T${horaMinuto}:00-05:00`;
}
