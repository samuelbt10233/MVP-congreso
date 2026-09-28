import { Router } from 'express';
import type { Contexto } from '../../contexto.js';
import {
  listarCategorias,
  listarPermisos,
  listarRoles,
  listarTiposActividad,
  listarZonas,
} from './repositorio.js';

type Edificio = {
  id: number;
  nombre: string;
  descripcion: string | null;
  zonas: {
    id: number;
    nombre: string;
    piso: number | null;
    capacidad: number | null;
    descripcion: string | null;
    activa: boolean;
  }[];
};

/** Catálogos para filtros y formularios en una sola respuesta (§5). */
export function rutasCatalogos(ctx: Contexto): Router {
  const rutas = Router();

  rutas.get('/catalogos', (_req, res) => {
    const edificios = new Map<number, Edificio>();
    for (const z of listarZonas(ctx.bd)) {
      let edificio = edificios.get(z.edificio_id);
      if (!edificio) {
        edificio = {
          id: z.edificio_id,
          nombre: z.edificio,
          descripcion: z.edificio_descripcion,
          zonas: [],
        };
        edificios.set(z.edificio_id, edificio);
      }
      edificio.zonas.push({
        id: z.id,
        nombre: z.nombre,
        piso: z.piso,
        capacidad: z.capacidad,
        descripcion: z.descripcion,
        activa: z.activa === 1,
      });
    }

    res.json({
      roles: listarRoles(ctx.bd),
      permisos: listarPermisos(ctx.bd),
      tipos_actividad: listarTiposActividad(ctx.bd),
      categorias: listarCategorias(ctx.bd),
      edificios: [...edificios.values()],
    });
  });

  return rutas;
}
