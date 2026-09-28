import { Router } from 'express';
import type { Contexto } from '../../contexto.js';
import { sesionDe } from '../../middleware/autenticacion.js';
import { exigePermiso } from '../../middleware/permisos.js';
import { idDeRuta, leerParametros } from '../../utils/validacion.js';
import {
  esquemaAltaPersona,
  esquemaEdicionPersona,
  esquemaListadoPersonas,
  esquemaPermisos,
} from './esquemas.js';
import * as servicio from './servicio.js';

export function rutasPersonas(ctx: Contexto): Router {
  const rutas = Router();

  rutas.get('/personas', exigePermiso('persona.leer'), (req, res) => {
    const filtros = leerParametros(esquemaListadoPersonas, req.query);
    res.json(servicio.listar(ctx, sesionDe(res), filtros));
  });

  rutas.post('/personas', exigePermiso('persona.crear'), async (req, res) => {
    const datos = esquemaAltaPersona.parse(req.body);
    res.status(201).json(await servicio.darDeAlta(ctx, sesionDe(res), datos));
  });

  rutas.get('/personas/:id', exigePermiso('persona.leer'), (req, res) => {
    res.json(servicio.obtener(ctx, sesionDe(res), idDeRuta(req.params.id)));
  });

  rutas.patch('/personas/:id', exigePermiso('persona.editar'), (req, res) => {
    const id = idDeRuta(req.params.id);
    const cambios = esquemaEdicionPersona.parse(req.body);
    res.json(servicio.editar(ctx, sesionDe(res), id, cambios));
  });

  rutas.get('/personas/:id/permisos', exigePermiso('permiso.gestionar'), (req, res) => {
    res.json({ permisos: servicio.permisosDe(ctx, idDeRuta(req.params.id)) });
  });

  rutas.put('/personas/:id/permisos', exigePermiso('permiso.gestionar'), (req, res) => {
    const id = idDeRuta(req.params.id);
    const { permisos } = esquemaPermisos.parse(req.body);
    res.json({ permisos: servicio.reemplazarPermisos(ctx, sesionDe(res), id, permisos) });
  });

  rutas.post('/personas/:id/codigo', exigePermiso('usuario.gestionar'), async (req, res) => {
    const { creado, codigo_acceso } = await servicio.generarCodigo(ctx, idDeRuta(req.params.id));
    res.status(creado ? 201 : 200).json({ codigo_acceso });
  });

  return rutas;
}
