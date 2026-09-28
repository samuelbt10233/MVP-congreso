import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorApi } from '../api/cliente';
import { api } from '../api/recursos';
import type { AsistenciaRegistrada } from '../api/tipos';
import { PANTALLAS } from '../rutas/pantallas';
import { normalizarCodigo } from '../utils/codigo';
import { hora } from '../utils/fechas';

/** Texto adicional para los rechazos de negocio (§6.2); el mensaje base lo da el servidor. */
function explicacion(error: ErrorApi): string | undefined {
  if (error.codigo === 'FUERA_DE_VENTANA') {
    const { abre, cierra } = error.detalle as { abre?: string; cierra?: string };
    if (abre && cierra) return `El registro está abierto de ${hora(abre)} a ${hora(cierra)}.`;
  }
  if (error.codigo === 'CODIGO_ACTIVIDAD_INVALIDO') {
    return 'Revisa el código que se muestra en el salón.';
  }
  return undefined;
}

/** P4: registro de asistencia por autoservicio con el código de la actividad. */
export function RegistrarAsistencia() {
  const [codigo, setCodigo] = useState('');
  const [registrada, setRegistrada] = useState<AsistenciaRegistrada>();
  const [error, setError] = useState<ErrorApi>();
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(undefined);
    setRegistrada(undefined);
    try {
      setRegistrada(await api.asistencia.registrar(codigo));
      setCodigo('');
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo registrar.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <hgroup>
        <h1>Registrar asistencia</h1>
        <p>Escribe el código que se muestra en el salón de la actividad.</p>
      </hgroup>

      <article className="registro-asistencia">
        <form onSubmit={enviar}>
          <label>
            Código de la actividad
            <input
              name="codigo-actividad"
              className="campo-codigo campo-codigo--grande"
              value={codigo}
              onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              autoFocus
              required
              aria-invalid={error ? true : undefined}
            />
          </label>
          <button type="submit" aria-busy={enviando} disabled={enviando || codigo === ''}>
            Registrar
          </button>
        </form>

        {registrada && (
          <p role="status" className="mensaje mensaje--exito">
            Asistencia registrada en <strong>{registrada.actividad.nombre}</strong> (
            {registrada.actividad.zona}) a las {hora(registrada.fecha_hora)}.
          </p>
        )}
        {error && (
          <p role="alert" className="mensaje mensaje--error">
            {error.message} {explicacion(error)}
          </p>
        )}
      </article>

      <Link to={PANTALLAS.misAsistencias.ruta}>Ver mis asistencias</Link>
    </>
  );
}
