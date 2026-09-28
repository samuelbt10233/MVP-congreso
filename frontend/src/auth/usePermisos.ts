import type { CodigoPermiso } from '../api/tipos';
import { useSesion } from './sesion';

/**
 * Evaluación de permisos para la interfaz (§9.2). Nunca se decide por rol
 * (regla 8): el rol solo se muestra.
 */
export function usePermisos() {
  const { sesion } = useSesion();
  const permisos: readonly CodigoPermiso[] = sesion.estado === 'activa' ? sesion.permisos : [];
  return {
    puede: (permiso: CodigoPermiso) => permisos.includes(permiso),
    puedeAlguno: (...lista: CodigoPermiso[]) => lista.some((p) => permisos.includes(p)),
  };
}
