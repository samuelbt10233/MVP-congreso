import { Link } from 'react-router';

export function NoEncontrada() {
  return (
    <article>
      <h1>Página no encontrada</h1>
      <Link to="/">Volver al inicio</Link>
    </article>
  );
}
