import { describe, expect, it } from 'vitest';
import { normalizarCodigo } from './codigo';
import { diaBogota, hora, nombreDia, rangoHoras } from './fechas';

describe('normalizarCodigo', () => {
  it('pasa a mayúsculas y quita espacios y guiones', () => {
    expect(normalizarCodigo(' a5d-4 s ')).toBe('A5D4S');
  });
});

describe('fechas en hora de Bogotá', () => {
  it('00:30 UTC del 16 son las 19:30 del 15 en Bogotá', () => {
    expect(hora('2026-10-16 00:30:00')).toBe('19:30');
    expect(diaBogota('2026-10-16 00:30:00')).toBe('2026-10-15');
  });

  it('nombra el día en español', () => {
    expect(nombreDia('2026-10-15')).toBe('Jueves, 15 de octubre');
  });

  it('muestra un rango de horas', () => {
    expect(rangoHoras('2026-10-15 13:00:00', '2026-10-15 14:30:00')).toBe('08:00 – 09:30');
  });
});
