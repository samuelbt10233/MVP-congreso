import type { ReactNode } from 'react';
import type { CodigoPermiso } from '../api/tipos';
import { usePermisos } from './usePermisos';

/**
 * Muestra su contenido solo con el permiso. Es presentación, no protección: el
 * backend valida cada petición (§9.9).
 */
export function Puede({ permiso, children }: { permiso: CodigoPermiso; children: ReactNode }) {
  const { puede } = usePermisos();
  return puede(permiso) ? <>{children}</> : null;
}
