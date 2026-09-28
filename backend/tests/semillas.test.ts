import { describe, expect, it } from 'vitest';
import { CUENTAS_DEMO } from '../database/semillas/demo.js';
import { abrirBase, type BaseDatos } from '../src/db/conexion.js';
import { poblarBase } from '../src/db/reset.js';
import { PAQUETE_RECEPCION, PERMISOS, PLANTILLAS_ROL } from '../src/modulos/permisos/catalogo.js';
import { esUtcSql, instanteBogota } from '../src/utils/fechas.js';
import { verificarCodigo } from '../src/utils/hash.js';

async function baseDemo(ahora: Date) {
  const bd = abrirBase(':memory:');
  const resumen = (await poblarBase(bd, { ahora }))!;
  return { bd, resumen };
}

function filas<T>(bd: BaseDatos, sql: string, ...parametros: unknown[]): T[] {
  return bd.prepare(sql).all(...parametros) as T[];
}

function permisosDe(bd: BaseDatos, numeroDocumento: string): string[] {
  return filas<{ codigo: string }>(
    bd,
    `SELECT p.codigo FROM autorizacion a
     JOIN permiso p ON p.id = a.permiso_id
     JOIN persona pe ON pe.id = a.persona_id
     WHERE pe.numero_documento = ? ORDER BY p.codigo`,
    numeroDocumento,
  ).map((f) => f.codigo);
}

const documento = (clave: string) => CUENTAS_DEMO.find((c) => c.clave === clave)!.numeroDocumento;

// La semilla depende de la hora; se prueba a media mañana y en los bordes del día local.
const MOMENTOS = {
  'media mañana': instanteBogota('2026-10-15', '10:47'),
  'justo después de medianoche': instanteBogota('2026-10-15', '00:10'),
  'justo antes de medianoche': instanteBogota('2026-10-15', '23:50'),
};

describe.each(Object.entries(MOMENTOS))('semilla de demo generada a %s', (_momento, ahora) => {
  it('todas las fechas están en UTC con el formato del diseño', async () => {
    const { bd } = await baseDemo(ahora);
    const fechas = [
      ...filas<{ f: string }>(
        bd,
        'SELECT inicio AS f FROM actividad UNION ALL SELECT fin FROM actividad',
      ),
      ...filas<{ f: string }>(bd, 'SELECT fecha_hora AS f FROM registro_llegada'),
      ...filas<{ f: string }>(bd, 'SELECT fecha_hora AS f FROM registro_actividad'),
    ];
    expect(fechas.length).toBeGreaterThan(0);
    for (const { f } of fechas) expect(esUtcSql(f), f).toBe(true);
  });

  it('I1: ninguna zona tiene actividades solapadas', async () => {
    const { bd } = await baseDemo(ahora);
    const solapes = filas(
      bd,
      `SELECT a.id, b.id FROM actividad a
       JOIN actividad b ON a.zona_id = b.zona_id AND a.id < b.id
       WHERE a.cancelada = 0 AND b.cancelada = 0 AND a.inicio < b.fin AND a.fin > b.inicio`,
    );
    expect(solapes).toEqual([]);
  });

  it('I7 e I9: las asistencias caen en la ventana, antes de ahora y nunca en canceladas', async () => {
    const { bd } = await baseDemo(ahora);
    const fuera = filas(
      bd,
      `SELECT r.id FROM registro_actividad r JOIN actividad a ON a.id = r.actividad_id
       WHERE a.cancelada = 1
          OR r.fecha_hora < datetime(a.inicio, '-15 minutes')
          OR r.fecha_hora > a.fin
          OR r.fecha_hora > ?`,
      ahora.toISOString().slice(0, 19).replace('T', ' '),
    );
    expect(fuera).toEqual([]);
  });

  it('hay actividades en curso y próximas para la demo en vivo', async () => {
    const { resumen } = await baseDemo(ahora);
    expect(resumen.actividadesEnCurso.length).toBeGreaterThan(0);
    expect(resumen.totales.asistencias).toBeGreaterThan(0);
    expect(resumen.totales.llegadas).toBeGreaterThan(0);
  });
});

describe('semilla de demo: cuentas y permisos', () => {
  const ahora = MOMENTOS['media mañana'];

  it('el catálogo tiene los 4 roles y los 9 permisos del diseño', async () => {
    const { bd } = await baseDemo(ahora);
    expect(filas(bd, 'SELECT * FROM rol')).toHaveLength(4);
    expect(
      filas<{ codigo: string }>(bd, 'SELECT codigo FROM permiso ORDER BY id').map((p) => p.codigo),
    ).toEqual(PERMISOS.map((p) => p.codigo));
  });

  it('cada cuenta recibe la plantilla de su rol; recepción, además, su paquete', async () => {
    const { bd } = await baseDemo(ahora);
    for (const c of CUENTAS_DEMO) {
      const esperados = [...PLANTILLAS_ROL[c.rol], ...(c.permisosExtra ?? [])].sort();
      expect(permisosDe(bd, c.numeroDocumento), c.clave).toEqual(esperados);
    }
    expect(permisosDe(bd, documento('administrador'))).toHaveLength(PERMISOS.length);
    expect(permisosDe(bd, documento('recepcion'))).toEqual([...PAQUETE_RECEPCION].sort());
    expect(permisosDe(bd, documento('visitante'))).toEqual([]);
  });

  it('usuario.gestionar solo lo tiene el administrador (regla 6)', async () => {
    const { bd } = await baseDemo(ahora);
    const conPermiso = filas<{ numero_documento: string }>(
      bd,
      `SELECT pe.numero_documento FROM autorizacion a
       JOIN permiso p ON p.id = a.permiso_id JOIN persona pe ON pe.id = a.persona_id
       WHERE p.codigo = 'usuario.gestionar'`,
    );
    expect(conPermiso).toEqual([{ numero_documento: documento('administrador') }]);
  });

  it('los códigos de acceso se guardan con bcrypt y verifican (regla 1)', async () => {
    const { bd } = await baseDemo(ahora);
    for (const c of CUENTAS_DEMO) {
      const { codigo_hash } = bd
        .prepare(
          `SELECT u.codigo_hash FROM usuario u JOIN persona p ON p.id = u.persona_id
           WHERE p.numero_documento = ?`,
        )
        .get(c.numeroDocumento) as { codigo_hash: string };
      expect(codigo_hash).not.toContain(c.codigo);
      expect(await verificarCodigo(c.codigo, codigo_hash)).toBe(true);
    }
  });

  it('el visitante de demo empieza sin llegada ni asistencias, para el recorrido en vivo', async () => {
    const { bd } = await baseDemo(ahora);
    const registros = filas(
      bd,
      `SELECT 1 FROM persona p WHERE p.numero_documento = ? AND (
         EXISTS (SELECT 1 FROM registro_llegada WHERE persona_id = p.id) OR
         EXISTS (SELECT 1 FROM registro_actividad WHERE persona_id = p.id))`,
      documento('visitante'),
    );
    expect(registros).toEqual([]);
  });
});
