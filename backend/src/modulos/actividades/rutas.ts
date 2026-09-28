import { Router } from 'express';
import type { Contexto } from '../../contexto.js';
import { sesionDe } from '../../middleware/autenticacion.js';
import { exigePermiso } from '../../middleware/permisos.js';
import { idDeRuta, leerParametros } from '../../utils/validacion.js';
import {
  esquemaAltaActividad,
  esquemaEdicionActividad,
  esquemaListadoActividades,
} from './esquemas.js';
import * as servicio from './servicio.js';

export function rutasActividades(ctx: Contexto): Router {
  const rutas = Router();

  rutas.get('/actividades', (req, res) => {
    const filtros = leerParametros(esquemaListadoActividades, req.query);
    res.json(servicio.listar(ctx, sesionDe(res), filtros));
  });

  rutas.post('/actividades', exigePermiso('actividad.gestionar'), (req, res) => {
    const datos = esquemaAltaActividad.parse(req.body);
    res.status(201).json(servicio.crear(ctx, sesionDe(res), datos));
  });

  rutas.get('/actividades/:id', (req, res) => {
    res.json(servicio.obtener(ctx, sesionDe(res), idDeRuta(req.params.id)));
  });

  rutas.patch('/actividades/:id', exigePermiso('actividad.gestionar'), (req, res) => {
    const id = idDeRuta(req.params.id);
    const cambios = esquemaEdicionActividad.parse(req.body);
    res.json(servicio.editar(ctx, sesionDe(res), id, cambios));
  });

  rutas.post('/actividades/:id/cancelar', exigePermiso('actividad.gestionar'), (req, res) => {
    res.json(servicio.cancelar(ctx, sesionDe(res), idDeRuta(req.params.id)));
  });

  return rutas;
}
