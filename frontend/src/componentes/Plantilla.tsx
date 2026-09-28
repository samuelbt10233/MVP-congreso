import { NavLink, Outlet } from 'react-router';
import { usePerfil, useSesion } from '../auth/sesion';
import { pantallasVisibles } from '../rutas/pantallas';

/** Encabezado con el menú construido desde los permisos (regla 8), nunca desde el rol. */
export function Plantilla() {
  const { persona, permisos } = usePerfil();
  const { cerrarSesion } = useSesion();

  return (
    <>
      <header className="encabezado">
        <div className="container encabezado__fila">
          <strong className="encabezado__marca">Congreso ETITC</strong>
          <div className="encabezado__usuario">
            <span>
              {persona.nombres} <small className="etiqueta">{persona.rol}</small>
            </span>
            <button type="button" className="secondary outline" onClick={() => void cerrarSesion()}>
              Salir
            </button>
          </div>
        </div>
        <nav className="container" aria-label="Menú principal">
          <ul className="menu">
            {pantallasVisibles(permisos).map((p) => (
              <li key={p.ruta}>
                <NavLink to={p.ruta} end={p.ruta === '/'}>
                  {p.titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
