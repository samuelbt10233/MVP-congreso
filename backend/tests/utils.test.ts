import { describe, expect, it } from 'vitest';
import {
  ALFABETO,
  esCodigoValido,
  generarCodigo,
  generarCodigoActividad,
  normalizarCodigo,
} from '../src/utils/codigo.js';
import {
  aUtcSql,
  desdeUtcSql,
  diaBogota,
  instanteBogota,
  rangoUtcDeDia,
} from '../src/utils/fechas.js';
import { hashCodigo, verificarCodigo } from '../src/utils/hash.js';

describe('códigos', () => {
  it('el alfabeto tiene 32 caracteres y excluye los ambiguos', () => {
    expect(new Set(ALFABETO).size).toBe(32);
    for (const ambiguo of ['0', 'O', '1', 'I']) expect(ALFABETO).not.toContain(ambiguo);
  });

  it('genera códigos de la longitud pedida usando solo el alfabeto', () => {
    for (let i = 0; i < 200; i++) {
      expect(esCodigoValido(generarCodigo(5), 5)).toBe(true);
    }
  });

  it('normaliza minúsculas, espacios y guiones', () => {
    expect(normalizarCodigo(' a5d-4s ')).toBe('A5D4S');
  });

  it('rechaza códigos con caracteres ambiguos o longitud distinta', () => {
    expect(esCodigoValido('ORGA3', 5)).toBe(false);
    expect(esCodigoValido('ABCD', 5)).toBe(false);
  });

  it('el código de actividad evita los ya usados', () => {
    const usados = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const codigo = generarCodigoActividad((c) => usados.has(c));
      expect(usados.has(codigo)).toBe(false);
      usados.add(codigo);
    }
  });
});

describe('fechas', () => {
  it('almacena en UTC con formato YYYY-MM-DD HH:MM:SS', () => {
    const fecha = new Date('2026-10-15T13:05:09.500Z');
    expect(aUtcSql(fecha)).toBe('2026-10-15 13:05:09');
    expect(desdeUtcSql('2026-10-15 13:05:09').toISOString()).toBe('2026-10-15T13:05:09.000Z');
  });

  it('las 19:30 de Bogotá son el día siguiente en UTC pero el mismo día local', () => {
    const instante = instanteBogota('2026-10-15', '19:30');
    expect(aUtcSql(instante)).toBe('2026-10-16 00:30:00');
    expect(diaBogota(instante)).toBe('2026-10-15');
  });

  it('el rango UTC de un día local va de 05:00 a 05:00', () => {
    expect(rangoUtcDeDia('2026-10-15')).toEqual({
      desde: '2026-10-15 05:00:00',
      hasta: '2026-10-16 05:00:00',
    });
  });
});

describe('hash de códigos', () => {
  it('guarda un hash bcrypt que verifica solo el código correcto', async () => {
    const hash = await hashCodigo('A5D4S');
    expect(hash).not.toContain('A5D4S');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verificarCodigo('A5D4S', hash)).toBe(true);
    expect(await verificarCodigo('A5D4T', hash)).toBe(false);
  });
});
