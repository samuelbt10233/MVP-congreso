import express from 'express';
import { manejadorErrores, rutaNoEncontrada } from './middleware/errores.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const api = express.Router();
  api.get('/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });

  app.use('/api/v1', api);
  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}
