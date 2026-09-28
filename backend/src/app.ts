import express from 'express';
import { z } from 'zod';
import type { Contexto } from './contexto.js';
import { obtenerBase } from './db/conexion.js';
import { autenticacion } from './middleware/autenticacion.js';
import { manejadorErrores, rutaNoEncontrada } from './middleware/errores.js';
import { rutasActividades } from './modulos/actividades/rutas.js';
import { rutasAuth, rutasAuthPublicas } from './modulos/auth/rutas.js';
import { AlmacenSesiones } from './modulos/auth/sesiones.js';
import { rutasCatalogos } from './modulos/catalogos/rutas.js';
import { rutasPersonas } from './modulos/personas/rutas.js';

z.config(z.locales.es());

export function crearApp(contexto: Partial<Contexto> = {}) {
  const ctx: Contexto = {
    bd: contexto.bd ?? obtenerBase(),
    sesiones: contexto.sesiones ?? new AlmacenSesiones(),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const api = express.Router();

  // Públicas: todo lo demás exige sesión (§5).
  api.get('/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });
  api.use(rutasAuthPublicas(ctx));

  api.use(autenticacion(ctx));
  api.use(rutasAuth(ctx));
  api.use(rutasCatalogos(ctx));
  api.use(rutasPersonas(ctx));
  api.use(rutasActividades(ctx));

  app.use('/api/v1', api);
  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}
