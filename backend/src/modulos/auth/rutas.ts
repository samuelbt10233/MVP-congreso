import { Router } from 'express';
import type { Contexto } from '../../contexto.js';
import { sesionDe } from '../../middleware/autenticacion.js';
import { esquemaLogin } from './esquemas.js';
import { iniciarSesion } from './servicio.js';

/** Rutas que no exigen sesión. */
export function rutasAuthPublicas(ctx: Contexto): Router {
  const rutas = Router();

  rutas.post('/auth/login', async (req, res) => {
    const datos = esquemaLogin.parse(req.body);
    res.json(await iniciarSesion(ctx, datos));
  });

  return rutas;
}

/** Rutas de la sesión en curso; se montan detrás de `autenticacion`. */
export function rutasAuth(ctx: Contexto): Router {
  const rutas = Router();

  rutas.get('/auth/yo', (_req, res) => {
    const { persona, permisos } = sesionDe(res);
    res.json({ persona, permisos: [...permisos].sort() });
  });

  rutas.post('/auth/salir', (_req, res) => {
    ctx.sesiones.eliminar(sesionDe(res).token);
    res.status(204).end();
  });

  return rutas;
}
