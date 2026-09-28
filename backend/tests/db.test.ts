import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { abrirBase, type BaseDatos } from '../src/db/conexion.js';
import { poblarBase, resetearArchivo } from '../src/db/reset.js';
import { aUtcSql, instanteBogota } from '../src/utils/fechas.js';

const dirTemporal = mkdtempSync(join(tmpdir(), 'congreso-'));
afterAll(() => rmSync(dirTemporal, { recursive: true, force: true }));

function tablas(bd: BaseDatos): string[] {
  return (
    bd
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
  ).map((t) => t.name);
}

describe('esquema', () => {
  let bd: BaseDatos;
  beforeEach(async () => {
    bd = abrirBase(':memory:');
    await poblarBase(bd, { demo: false });
  });

  it('crea las 12 tablas del diseño', () => {
    expect(tablas(bd).sort()).toEqual(
      [
        'actividad',
        'autorizacion',
        'categoria',
        'edificio',
        'permiso',
        'persona',
        'registro_actividad',
        'registro_llegada',
        'rol',
        'tipo_actividad',
        'usuario',
        'zona',
      ].sort(),
    );
  });

  it('rechaza llaves foráneas inexistentes', () => {
    expect(() =>
      bd
        .prepare(
          `INSERT INTO persona (tipo_documento, numero_documento, nombres, apellidos, rol_id)
           VALUES ('CC', '1', 'A', 'B', 999)`,
        )
        .run(),
    ).toThrow(expect.objectContaining({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }));
  });

  it('activa las llaves foráneas en cada conexión nueva', () => {
    const ruta = join(dirTemporal, 'conexiones.db');
    abrirBase(ruta).close();
    const segunda = abrirBase(ruta);
    expect(segunda.pragma('foreign_keys', { simple: true })).toBe(1);
    segunda.close();
  });

  describe('I4: una llegada por persona y día local de Bogotá', () => {
    function llegada(personaId: number, instante: Date) {
      bd.prepare(
        'INSERT INTO registro_llegada (persona_id, registrado_por, fecha_hora) VALUES (?, ?, ?)',
      ).run(personaId, personaId, aUtcSql(instante));
    }

    beforeEach(() => {
      bd.prepare(
        `INSERT INTO persona (id, tipo_documento, numero_documento, nombres, apellidos, rol_id)
         VALUES (1, 'CC', '123', 'Ana', 'Pérez', 1)`,
      ).run();
    });

    it('rechaza una segunda llegada a las 19:30 tras una a las 08:00 del mismo día', () => {
      llegada(1, instanteBogota('2026-10-15', '08:00'));
      expect(() => llegada(1, instanteBogota('2026-10-15', '19:30'))).toThrow(
        expect.objectContaining({ code: 'SQLITE_CONSTRAINT_UNIQUE' }),
      );
    });

    it('permite llegadas en días locales distintos aunque estén a minutos', () => {
      llegada(1, instanteBogota('2026-10-15', '23:59'));
      expect(() => llegada(1, instanteBogota('2026-10-16', '00:01'))).not.toThrow();
    });
  });
});

describe('npm run reset', () => {
  it('se puede ejecutar dos veces seguidas sobre el mismo archivo', async () => {
    const ruta = join(dirTemporal, 'reset.db');
    const primera = await resetearArchivo(ruta);
    const segunda = await resetearArchivo(ruta);
    expect(segunda.totales).toEqual(primera.totales);

    const bd = abrirBase(ruta);
    expect(tablas(bd)).toHaveLength(12);
    const { total } = bd.prepare('SELECT COUNT(*) AS total FROM persona').get() as {
      total: number;
    };
    expect(total).toBe(primera.totales.personas);
    bd.close();
  });
});
