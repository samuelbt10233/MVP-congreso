import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { cuenta, crearEntorno } from './apoyo.js';

type Entorno = Awaited<ReturnType<typeof crearEntorno>>;

let entorno: Entorno;
let zonaId: number;
let otraZonaId: number;
let tipoId: number;

beforeEach(async () => {
  entorno = await crearEntorno();
  zonaId = entorno.idDe('zona', 'nombre', 'Salón B301');
  otraZonaId = entorno.idDe('zona', 'nombre', 'Salón A201');
  tipoId = entorno.idDe('tipo_actividad', 'nombre', 'Ponencia');
});

// Un día lejano, sin actividades de la semilla. Horas en UTC.
const DIA = '2030-01-10';
const hora = (hhmm: string) => `${DIA} ${hhmm}:00`;

const actividad = (inicio: string, fin: string, extra: object = {}) => ({
  nombre: `Ponencia ${inicio}–${fin}`,
  tipo_actividad_id: tipoId,
  zona_id: zonaId,
  inicio: hora(inicio),
  fin: hora(fin),
  ...extra,
});

async function crear(inicio: string, fin: string, extra: object = {}) {
  const organizador = await entorno.como('organizador');
  return organizador.post('/api/v1/actividades', actividad(inicio, fin, extra));
}

describe('POST /actividades', () => {
  it('crea la actividad y genera un código de 4 caracteres', async () => {
    const res = await crear('14:00', '15:00');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      inicio: hora('14:00'),
      fin: hora('15:00'),
      cancelada: false,
      zona: { id: zonaId, nombre: 'Salón B301' },
      tipo: { id: tipoId, nombre: 'Ponencia' },
    });
    expect(res.body.codigo).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });

  it('normaliza una hora con zona horaria de Bogotá a UTC', async () => {
    const organizador = await entorno.como('organizador');
    const res = await organizador.post('/api/v1/actividades', {
      ...actividad('14:00', '15:00'),
      inicio: '2030-01-10T08:00:00-05:00',
      fin: '2030-01-10T09:30:00-05:00',
    });
    expect(res.status).toBe(201);
    expect(res.body.inicio).toBe('2030-01-10 13:00:00');
    expect(res.body.fin).toBe('2030-01-10 14:30:00');
  });

  it('rechaza una fecha sin zona horaria', async () => {
    const res = await crear('14:00', '15:00', { inicio: '2030-01-10T08:00:00' });
    expect(res.status).toBe(400);
  });

  it('I2: inicio igual o posterior al fin responde 422', async () => {
    expect((await crear('15:00', '15:00')).body.error.codigo).toBe('HORARIO_INVALIDO');
    expect((await crear('16:00', '15:00')).status).toBe(422);
  });

  it.each([
    ['tipo_actividad_id', { tipo_actividad_id: 999 }],
    ['categoria_id', { categoria_id: 999 }],
    ['zona_id', { zona_id: 999 }],
    ['responsable_id', { responsable_id: 999 }],
  ])('una referencia inexistente en %s responde 422', async (campo, extra) => {
    const res = await crear('14:00', '15:00', extra);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      codigo: 'REFERENCIA_INVALIDA',
      detalle: { campo },
    });
  });

  it('sin actividad.gestionar responde 403', async () => {
    const visitante = await entorno.como('visitante');
    const res = await visitante.post('/api/v1/actividades', actividad('14:00', '15:00'));
    expect(res.status).toBe(403);
  });
});

describe('I1: solapamiento en la misma zona', () => {
  beforeEach(async () => {
    expect((await crear('10:00', '12:00')).status).toBe(201);
  });

  it.each([
    ['empieza dentro de otra', '11:00', '13:00'],
    ['termina dentro de otra', '09:00', '11:00'],
    ['contiene por completo a otra', '09:00', '13:00'],
    ['está contenida en otra', '10:30', '11:30'],
    ['coincide exactamente', '10:00', '12:00'],
  ])('rechaza con 409 una actividad que %s', async (_caso, inicio, fin) => {
    const res = await crear(inicio, fin);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      codigo: 'HORARIO_OCUPADO',
      detalle: { actividad: { inicio: hora('10:00'), fin: hora('12:00') } },
    });
  });

  it.each([
    ['termina justo cuando empieza la otra', '09:00', '10:00'],
    ['empieza justo cuando termina la otra', '12:00', '13:00'],
  ])('permite una actividad contigua que %s', async (_caso, inicio, fin) => {
    expect((await crear(inicio, fin)).status).toBe(201);
  });

  it('permite el mismo horario en otra zona', async () => {
    expect((await crear('10:00', '12:00', { zona_id: otraZonaId })).status).toBe(201);
  });

  it('una actividad cancelada deja libre su horario', async () => {
    const organizador = await entorno.como('organizador');
    const [existente] = (await organizador.get(`/api/v1/actividades?dia=${DIA}`)).body;
    await organizador.post(`/api/v1/actividades/${existente.id}/cancelar`);
    expect((await crear('10:00', '12:00')).status).toBe(201);
  });

  it('el choque no deja nada escrito', async () => {
    const antes = entorno.bd.prepare('SELECT COUNT(*) AS n FROM actividad').get();
    await crear('11:00', '13:00');
    expect(entorno.bd.prepare('SELECT COUNT(*) AS n FROM actividad').get()).toEqual(antes);
  });
});

describe('PATCH /actividades/:id', () => {
  it('editar solo el nombre no choca consigo misma', async () => {
    const creada = (await crear('10:00', '12:00')).body;
    const organizador = await entorno.como('organizador');
    const res = await organizador.patch(`/api/v1/actividades/${creada.id}`, {
      nombre: 'Nuevo nombre',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: 'Nuevo nombre', inicio: hora('10:00') });
  });

  it('reprogramar sobre otra actividad responde 409 y no cambia nada', async () => {
    await crear('10:00', '12:00');
    const segunda = (await crear('13:00', '14:00')).body;
    const organizador = await entorno.como('organizador');
    const res = await organizador.patch(`/api/v1/actividades/${segunda.id}`, {
      inicio: hora('11:30'),
    });
    expect(res.status).toBe(409);
    expect((await organizador.get(`/api/v1/actividades/${segunda.id}`)).body.inicio).toBe(
      hora('13:00'),
    );
  });

  it('mover a otra zona ocupada responde 409', async () => {
    await crear('10:00', '12:00', { zona_id: otraZonaId });
    const propia = (await crear('10:00', '12:00')).body;
    const organizador = await entorno.como('organizador');
    const res = await organizador.patch(`/api/v1/actividades/${propia.id}`, {
      zona_id: otraZonaId,
    });
    expect(res.status).toBe(409);
  });

  it('el fin nuevo no puede quedar antes del inicio actual (I2)', async () => {
    const creada = (await crear('10:00', '12:00')).body;
    const organizador = await entorno.como('organizador');
    const res = await organizador.patch(`/api/v1/actividades/${creada.id}`, {
      fin: hora('09:00'),
    });
    expect(res.status).toBe(422);
  });
});

describe('POST /actividades/:id/cancelar', () => {
  it('cancela y una segunda vez responde 409', async () => {
    const creada = (await crear('10:00', '12:00')).body;
    const organizador = await entorno.como('organizador');
    const primera = await organizador.post(`/api/v1/actividades/${creada.id}/cancelar`);
    expect(primera.status).toBe(200);
    expect(primera.body.cancelada).toBe(true);
    const segunda = await organizador.post(`/api/v1/actividades/${creada.id}/cancelar`);
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.codigo).toBe('ACTIVIDAD_YA_CANCELADA');
  });

  it('sin actividad.gestionar responde 403', async () => {
    const creada = (await crear('10:00', '12:00')).body;
    const participante = await entorno.como('participante');
    expect((await participante.post(`/api/v1/actividades/${creada.id}/cancelar`)).status).toBe(403);
  });
});

describe('GET /actividades', () => {
  it('regla 9: el visitante no recibe el código ni en el listado ni en el detalle', async () => {
    const visitante = await entorno.como('visitante');
    const listado = await visitante.get('/api/v1/actividades');
    expect(listado.status).toBe(200);
    expect(listado.body.length).toBeGreaterThan(0);
    for (const a of listado.body) expect(a).not.toHaveProperty('codigo');

    const detalle = await visitante.get(`/api/v1/actividades/${listado.body[0].id}`);
    expect(detalle.body).not.toHaveProperty('codigo');

    const codigos = entorno.bd.prepare('SELECT codigo FROM actividad').all() as {
      codigo: string;
    }[];
    for (const { codigo } of codigos) {
      expect(listado.text).not.toContain(`"${codigo}"`);
    }
  });

  it('quien gestiona actividades sí recibe el código', async () => {
    const organizador = await entorno.como('organizador');
    const listado = await organizador.get('/api/v1/actividades');
    for (const a of listado.body) expect(a.codigo).toMatch(/^[A-Z2-9]{4}$/);
  });

  it('filtra por día local de Bogotá', async () => {
    // 23:30 de Bogotá del 10 es 04:30 UTC del 11: pertenece al día 10.
    await crear('10:00', '11:00');
    await crear('04:30', '05:00', { inicio: '2030-01-11 04:30:00', fin: '2030-01-11 05:00:00' });
    await crear('05:00', '06:00', { inicio: '2030-01-11 05:00:00', fin: '2030-01-11 06:00:00' });
    const visitante = await entorno.como('visitante');
    const dia10 = await visitante.get('/api/v1/actividades?dia=2030-01-10');
    expect(dia10.body.map((a: { inicio: string }) => a.inicio)).toEqual([
      '2030-01-10 10:00:00',
      '2030-01-11 04:30:00',
    ]);
    const dia11 = await visitante.get('/api/v1/actividades?dia=2030-01-11');
    expect(dia11.body.map((a: { inicio: string }) => a.inicio)).toEqual(['2030-01-11 05:00:00']);
  });

  it('filtra por zona, tipo y categoría', async () => {
    const visitante = await entorno.como('visitante');
    const hall = entorno.idDe('zona', 'nombre', 'Hall de pósters');
    const porZona = await visitante.get(`/api/v1/actividades?zona_id=${hall}`);
    expect(porZona.body.length).toBeGreaterThan(0);
    for (const a of porZona.body) expect(a.zona.id).toBe(hall);

    const taller = entorno.idDe('tipo_actividad', 'nombre', 'Taller');
    const porTipo = await visitante.get(`/api/v1/actividades?tipo_id=${taller}`);
    for (const a of porTipo.body) expect(a.tipo.nombre).toBe('Taller');

    const categoria = entorno.idDe('categoria', 'nombre', 'Desarrollo humano');
    const porCategoria = await visitante.get(`/api/v1/actividades?categoria_id=${categoria}`);
    for (const a of porCategoria.body) expect(a.categoria.nombre).toBe('Desarrollo humano');
  });

  it('un día con formato inválido responde 400', async () => {
    const visitante = await entorno.como('visitante');
    const res = await visitante.get('/api/v1/actividades?dia=10-01-2030');
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('PARAMETRO_INVALIDO');
  });

  it('incluye al responsable para que el frontend reconozca las propias', async () => {
    const participante = await entorno.como('participante');
    const listado = await participante.get('/api/v1/actividades');
    const propias = listado.body.filter(
      (a: { responsable: { nombres: string } | null }) =>
        a.responsable?.nombres === cuenta('participante').nombres,
    );
    expect(propias).toHaveLength(3);
  });

  it('una actividad inexistente responde 404', async () => {
    const visitante = await entorno.como('visitante');
    const res = await visitante.get('/api/v1/actividades/99999');
    expect(res.body.error.codigo).toBe('ACTIVIDAD_NO_ENCONTRADA');
  });
});

describe('GET /catalogos', () => {
  it('devuelve roles, permisos, tipos, categorías y edificios con zonas', async () => {
    const visitante = await entorno.como('visitante');
    const res = await visitante.get('/api/v1/catalogos');
    expect(res.status).toBe(200);
    expect(res.body.roles).toHaveLength(4);
    expect(res.body.permisos).toHaveLength(9);
    expect(res.body.tipos_actividad).toHaveLength(5);
    expect(res.body.categorias).toHaveLength(4);
    expect(res.body.edificios.map((e: { nombre: string }) => e.nombre)).toEqual([
      'Bloque A',
      'Bloque B',
      'Bloque C',
    ]);
    expect(res.body.edificios[0].zonas[0]).toMatchObject({
      nombre: 'Auditorio Central',
      piso: 1,
      capacidad: 180,
      activa: true,
    });
  });

  it('exige sesión', async () => {
    expect((await request(entorno.app).get('/api/v1/catalogos')).status).toBe(401);
  });
});
