import { Link } from 'react-router';

export function AccesoDenegado() {
  return (
    <article>
      <h1>Acceso denegado</h1>
      <p>No tienes permiso para ver esta pantalla.</p>
      <Link to="/">Volver al inicio</Link>
    </article>
  );
}
