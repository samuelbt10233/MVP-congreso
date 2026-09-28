import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from '../auth/sesion';
import { Cargando } from '../componentes/Estado';
import { Plantilla } from '../componentes/Plantilla';
import { AccesoDenegado } from '../paginas/AccesoDenegado';
import { puedeVer, type Pantalla } from './pantallas';

/** Sin sesión, lleva al acceso recordando a dónde se quería ir. */
export function RequiereSesion() {
  const { sesion } = useSesion();
  const ubicacion = useLocation();
  if (sesion.estado === 'cargando') {
    return (
      <main className="container">
        <Cargando />
      </main>
    );
  }
  if (sesion.estado === 'anonima') {
    return (
      <Navigate to="/acceso" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />
    );
  }
  return <Plantilla />;
}

/**
 * Bloquea el acceso directo por URL a una pantalla sin permiso (§9.9). Es
 * presentación: el backend rechaza igualmente cada petición.
 */
export function RequierePantalla({
  pantalla,
  children,
}: {
  pantalla: Pantalla;
  children: ReactNode;
}) {
  const { sesion } = useSesion();
  const permisos = sesion.estado === 'activa' ? sesion.permisos : [];
  return puedeVer(pantalla, permisos) ? <>{children}</> : <AccesoDenegado />;
}
