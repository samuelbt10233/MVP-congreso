import type { RequestHandler, Response } from 'express';
import type { Contexto } from '../contexto.js';
import {
  buscarPersonaConAcceso,
  permisosDe,
  type PersonaSesion,
} from '../modulos/auth/repositorio.js';
import { ErrorApi } from './errores.js';

export type SesionActiva = {
  token: string;
  persona: PersonaSesion;
  permisos: ReadonlySet<string>;
};

declare global {
  namespace Express {
    interface Locals {
      sesion?: SesionActiva;
    }
  }
}

function noAutenticado(): ErrorApi {
  return new ErrorApi(401, 'NO_AUTENTICADO', 'Inicia sesión para continuar.');
}

function extraerToken(cabecera: string | undefined): string | undefined {
  const [esquema, token] = cabecera?.split(' ') ?? [];
  return esquema === 'Bearer' && token ? token : undefined;
}

/**
 * Exige una sesión vigente. Persona y permisos se leen de la base en cada petición:
 * un cambio de permisos o una desactivación aplica de inmediato en el backend (§9.2).
 */
export function autenticacion(ctx: Contexto): RequestHandler {
  return (req, res, next) => {
    const token = extraerToken(req.get('authorization'));
    if (!token) throw noAutenticado();

    const personaId = ctx.sesiones.personaDe(token);
    const persona = personaId === undefined ? undefined : buscarPersonaConAcceso(ctx.bd, personaId);
    if (!persona) {
      ctx.sesiones.eliminar(token);
      throw noAutenticado();
    }

    res.locals.sesion = { token, persona, permisos: new Set(permisosDe(ctx.bd, persona.id)) };
    next();
  };
}

/** Sesión de la petición; solo se usa detrás de `autenticacion`. */
export function sesionDe(res: Response): SesionActiva {
  const sesion = res.locals.sesion;
  if (!sesion) throw new Error('sesionDe() usado en una ruta sin autenticacion()');
  return sesion;
}
