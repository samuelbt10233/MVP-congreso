import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';

const app = crearApp();

describe('andamiaje de la API', () => {
  it('GET /api/v1/salud responde ok', async () => {
    const res = await request(app).get('/api/v1/salud');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: 'ok' });
  });

  it('una ruta inexistente responde 404 con la forma única de error', async () => {
    const res = await request(app).get('/api/v1/no-existe');
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
      .post('/api/v1/salud')
      .set('Content-Type', 'application/json')
      .send('{ mal formado');
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('CUERPO_INVALIDO');
  });
});
