import { Router } from 'express';
import type { Contexto } from '../../contexto.js';
import { exigePermiso } from '../../middleware/permisos.js';
import { resumen } from './servicio.js';

export function rutasEstadisticas(ctx: Contexto): Router {
  const rutas = Router();

  rutas.get('/estadisticas', exigePermiso('estadistica.leer'), (_req, res) => {
    res.json(resumen(ctx));
  });

  return rutas;
}
