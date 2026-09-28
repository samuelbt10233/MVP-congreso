import type { RequestHandler } from 'express';
import type { CodigoPermiso } from '../modulos/permisos/catalogo.js';
import { sesionDe } from './autenticacion.js';
import { ErrorApi } from './errores.js';

/**
 * Exige un permiso a la persona autenticada (reglas 7 y 8). Se evalúa el permiso,
 * nunca el rol.
 */
export function exigePermiso(permiso: CodigoPermiso): RequestHandler {
  return (_req, res, next) => {
    if (!sesionDe(res).permisos.has(permiso)) {
      throw new ErrorApi(403, 'SIN_PERMISO', 'No tienes permiso para realizar esta acción.', {
        permiso,
      });
    }
    next();
  };
}
