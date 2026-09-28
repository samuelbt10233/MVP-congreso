import { Router } from 'express';
import type { Contexto } from '../../contexto.js';
import { sesionDe } from '../../middleware/autenticacion.js';
import { exigePermiso } from '../../middleware/permisos.js';
import { idDeRuta, leerParametros } from '../../utils/validacion.js';
import {
  esquemaAsistencia,
  esquemaBusquedaRecepcion,
  esquemaListadoLlegadas,
  esquemaLlegada,
} from './esquemas.js';
import * as servicio from './servicio.js';

export function rutasRegistros(ctx: Contexto): Router {
  const rutas = Router();

  rutas.get('/recepcion/buscar', exigePermiso('llegada.registrar'), (req, res) => {
    const { documento } = leerParametros(esquemaBusquedaRecepcion, req.query);
    res.json(servicio.buscarEnRecepcion(ctx, documento));
  });

  rutas.post('/registros/llegada', exigePermiso('llegada.registrar'), (req, res) => {
    const { numero_documento } = esquemaLlegada.parse(req.body);
    res.status(201).json(servicio.registrarLlegada(ctx, sesionDe(res), numero_documento));
  });

  rutas.get('/registros/llegada', exigePermiso('registro.leer'), (req, res) => {
    const { dia } = leerParametros(esquemaListadoLlegadas, req.query);
    res.json(servicio.listarLlegadasDelDia(ctx, dia));
  });

  // Registrar la asistencia propia no exige permiso: basta con estar autenticado.
  rutas.post('/registros/asistencia', (req, res) => {
    const { codigo } = esquemaAsistencia.parse(req.body);
    res.status(201).json(servicio.registrarAsistencia(ctx, sesionDe(res), codigo));
  });

  rutas.get('/registros/asistencia/mias', (_req, res) => {
    res.json(servicio.asistenciasPropias(ctx, sesionDe(res)));
  });

  // Autoriza dentro del servicio: registro.leer o ser responsable de la actividad.
  rutas.get('/actividades/:id/asistentes', (req, res) => {
    res.json(servicio.asistentesDe(ctx, sesionDe(res), idDeRuta(req.params.id)));
  });

  return rutas;
}
