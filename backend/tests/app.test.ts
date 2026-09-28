import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearEntorno } from './apoyo.js';

let app: Awaited<ReturnType<typeof crearEntorno>>['app'];
beforeAll(async () => {
  ({ app } = await crearEntorno());
});

describe('andamiaje de la API', () => {
  it('GET /api/v1/salud responde ok sin sesión', async () => {
    const res = await request(app).get('/api/v1/salud');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: 'ok' });
  });

  it('una ruta inexistente responde 404 con la forma única de error', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        codigo: 'RUTA_NO_ENCONTRADA',
        mensaje: expect.any(String),
        detalle: {},
      },
    });
  });

  it('un cuerpo JSON mal formado responde 400 con la forma única de error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ mal formado');
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('CUERPO_INVALIDO');
  });
});
