import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente';
import { useSesion } from '../auth/sesion';
import { normalizarCodigo } from '../utils/codigo';

/**
 * Acceso con documento y código (§9.7). El código solo vive en el estado del
 * formulario: no se guarda ni viaja en la URL, y el mensaje de error es el mismo
 * para documento inexistente y código incorrecto (lo decide el servidor).
 */
export function Acceso() {
  const { sesion, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [documento, setDocumento] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  if (sesion.estado === 'activa') return <Navigate to="/" replace />;

  const desde = (ubicacion.state as { desde?: string } | null)?.desde ?? '/';

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(undefined);
    try {
      await iniciarSesion(documento.trim(), codigo);
      navegar(desde, { replace: true });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo iniciar sesión.');
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="container acceso">
      <article>
        <header>
          <h1>Congreso ETITC</h1>
          <p>V Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global</p>
        </header>
        <form onSubmit={enviar}>
          <label>
            Número de documento
            <input
              name="documento"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Código de acceso
            <input
              name="codigo"
              className="campo-codigo"
              value={codigo}
              onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              required
            />
            <small>Lo recibiste al inscribirte. No aparece en tu escarapela.</small>
          </label>
          {error && (
            <p role="alert" className="mensaje mensaje--error">
              {error}
            </p>
          )}
          <button type="submit" aria-busy={enviando} disabled={enviando}>
            Ingresar
          </button>
        </form>
      </article>
    </main>
  );
}
