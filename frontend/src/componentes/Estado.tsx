import type { ErrorApi } from '../api/cliente';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p aria-busy="true">{texto}</p>;
}

export function MensajeError({ error }: { error: ErrorApi | undefined }) {
  if (!error) return null;
  return (
    <p role="alert" className="mensaje mensaje--error">
      {error.message}
    </p>
  );
}
