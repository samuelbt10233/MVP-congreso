import { beforeEach, describe, expect, it } from 'vitest';
import { instanteBogota } from '../src/utils/fechas.js';
import { crearEntorno } from './apoyo.js';

type Entorno = Awaited<ReturnType<typeof crearEntorno>>;

const AHORA = instanteBogota('2026-10-15', '10:47');

let entorno: Entorno;
beforeEach(async () => {
  entorno = await crearEntorno({ ahora: AHORA });
});

const contar = (sql: string) => (entorno.bd.prepare(sql).get() as { n: number }).n;

describe('GET /estadisticas', () => {
  it('exige estadistica.leer', async () => {
    const visitante = await entorno.como('visitante');
    expect((await visitante.get('/api/v1/estadisticas')).status).toBe(403);
  });

  it('los totales cuadran contra consultas directas a la base', async () => {
    const organizador = await entorno.como('organizador');
    const { body } = await organizador.get('/api/v1/estadisticas');

    expect(body.totales).toEqual({
      personas: contar('SELECT COUNT(*) AS n FROM persona WHERE activo = 1'),
      llegadas: contar('SELECT COUNT(*) AS n FROM registro_llegada'),
      asistencias: contar('SELECT COUNT(*) AS n FROM registro_actividad'),
      actividades: contar('SELECT COUNT(*) AS n FROM actividad WHERE cancelada = 0'),
      actividades_canceladas: contar('SELECT COUNT(*) AS n FROM actividad WHERE cancelada = 1'),
    });
    expect(body.totales.asistencias).toBeGreaterThan(0);

    const sumaDias = body.llegadas_por_dia.reduce(
      (s: number, d: { total: number }) => s + d.total,
      0,
    );
    expect(sumaDias).toBe(body.totales.llegadas);
    expect(body.llegadas_por_dia).toEqual([{ dia: '2026-10-15', total: body.totales.llegadas }]);

    for (const a of body.por_actividad) {
      const enBase = entorno.bd
        .prepare('SELECT COUNT(*) AS n FROM registro_actividad WHERE actividad_id = ?')
        .get(a.id) as { n: number };
      expect(a.asistentes, a.nombre).toBe(enBase.n);
      expect(a.ocupacion).toBe(Math.round((a.asistentes / a.capacidad) * 1000) / 1000);
    }
    const sumaActividades = body.por_actividad.reduce(
      (s: number, a: { asistentes: number }) => s + a.asistentes,
      0,
    );
    expect(sumaActividades).toBe(body.totales.asistencias);
  });

  it('lista las actividades en curso sin incluir canceladas', async () => {
    const organizador = await entorno.como('organizador');
    const { body } = await organizador.get('/api/v1/estadisticas');
    const nombres = body.actividades_en_curso.map((a: { nombre: string }) => a.nombre);
    expect(nombres).toContain('Movilidad eléctrica en Bogotá');
    expect(nombres).not.toContain('Gestión del agua en zonas urbanas');
    for (const a of body.actividades_en_curso) expect(a.cancelada).toBe(false);
  });

  it('refleja al instante una asistencia nueva', async () => {
    const organizador = await entorno.como('organizador');
    const antes = (await organizador.get('/api/v1/estadisticas')).body.totales.asistencias;
    const { codigo } = entorno.bd
      .prepare("SELECT codigo FROM actividad WHERE nombre = 'Movilidad eléctrica en Bogotá'")
      .get() as { codigo: string };
    const visitante = await entorno.como('visitante');
    await visitante.post('/api/v1/registros/asistencia', { codigo });
    const despues = (await organizador.get('/api/v1/estadisticas')).body.totales.asistencias;
    expect(despues).toBe(antes + 1);
  });
});
