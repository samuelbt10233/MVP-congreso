import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { api } from '../api/recursos';
import type { PersonaRecepcion } from '../api/tipos';
import { useCarga } from '../api/useCarga';
import { usePermisos } from '../auth/usePermisos';
import { CodigoUnaVez } from '../componentes/CodigoUnaVez';
import { Cargando } from '../componentes/Estado';
import { FormularioPersona } from '../componentes/FormularioPersona';
import { hora } from '../utils/fechas';

type Estado =
  | { paso: 'buscar' }
  | {
      paso: 'encontrada';
      documento: string;
      resultado: PersonaRecepcion;
      llegadaRecienRegistrada?: string;
    }
  | { paso: 'no-encontrada'; documento: string }
  | { paso: 'alta'; documento: string };

/**
 * P11 (§6.1): busca por documento, registra la llegada y da de alta a quien llegó
 * sin inscribirse. No usa el directorio: la búsqueda devuelve solo nombre, rol y
 * estado de llegada.
 */
export function Recepcion() {
  const { puede } = usePermisos();
  const [documento, setDocumento] = useState('');
  const [estado, setEstado] = useState<Estado>({ paso: 'buscar' });
  const [codigoNuevo, setCodigoNuevo] = useState<{ codigo: string; para: string }>();
  const [error, setError] = useState<ErrorApi>();
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);
  const resumen = useCarga(() => api.recepcion.resumen(), [version]);

  async function buscar(numero: string) {
    setError(undefined);
    setOcupado(true);
    try {
      setEstado({
        paso: 'encontrada',
        documento: numero,
        resultado: await api.recepcion.buscar(numero),
      });
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'PERSONA_NO_ENCONTRADA') {
        setEstado({ paso: 'no-encontrada', documento: numero });
      } else {
        setError(e instanceof ErrorApi ? e : undefined);
      }
    } finally {
      setOcupado(false);
    }
  }

  async function registrarLlegada(numero: string) {
    setError(undefined);
    setOcupado(true);
    try {
      const { persona, llegada } = await api.recepcion.registrarLlegada(numero);
      setEstado({
        paso: 'encontrada',
        documento: numero,
        resultado: { persona, llegada_hoy: { fecha_hora: llegada.fecha_hora } },
        llegadaRecienRegistrada: llegada.fecha_hora,
      });
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : undefined);
    } finally {
      setOcupado(false);
    }
  }

  /** Limpia todo, incluido el código recién generado: no queda en la vista. */
  function siguientePersona() {
    setDocumento('');
    setEstado({ paso: 'buscar' });
    setCodigoNuevo(undefined);
    setError(undefined);
  }

  function enviarBusqueda(evento: FormEvent) {
    evento.preventDefault();
    setCodigoNuevo(undefined);
    if (documento.trim()) void buscar(documento.trim());
  }

  return (
    <>
      <div className="titulo-con-accion">
        <h1>Recepción</h1>
        <p className="contador" aria-live="polite">
          Llegadas hoy <strong>{resumen.datos?.llegadas ?? '…'}</strong>
        </p>
      </div>

      <article className="recepcion">
        <form onSubmit={enviarBusqueda} role="search">
          <label>
            Número de documento
            <fieldset role="group">
              <input
                name="documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                autoComplete="off"
                autoFocus
                required
              />
              <button type="submit" aria-busy={ocupado && estado.paso === 'buscar'}>
                Buscar
              </button>
            </fieldset>
          </label>
        </form>

        {estado.paso === 'encontrada' && (
          <section className="ficha-recepcion">
            <h2>
              {estado.resultado.persona.nombres} {estado.resultado.persona.apellidos}
            </h2>
            <p>
              <span className={`etiqueta etiqueta--rol-${estado.resultado.persona.rol}`}>
                {estado.resultado.persona.rol}
              </span>
              {!estado.resultado.persona.activo && (
                <span className="etiqueta etiqueta--alerta">Inactiva</span>
              )}
            </p>
            {estado.llegadaRecienRegistrada ? (
              <p role="status" className="mensaje mensaje--exito">
                Llegada registrada a las {hora(estado.llegadaRecienRegistrada)}. Entrega la
                escarapela de <strong>{estado.resultado.persona.rol}</strong>.
              </p>
            ) : estado.resultado.llegada_hoy ? (
              <p className="mensaje mensaje--aviso">
                Ya se registró su llegada hoy a las {hora(estado.resultado.llegada_hoy.fecha_hora)}.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void registrarLlegada(estado.documento)}
                aria-busy={ocupado}
              >
                Registrar llegada
              </button>
            )}
          </section>
        )}

        {estado.paso === 'no-encontrada' && (
          <section>
            <p className="mensaje mensaje--aviso">
              No hay ninguna persona registrada con el documento {estado.documento}.
            </p>
            {puede('persona.crear') && (
              <button
                type="button"
                onClick={() => setEstado({ paso: 'alta', documento: estado.documento })}
              >
                Dar de alta
              </button>
            )}
          </section>
        )}

        {estado.paso === 'alta' && (
          <section>
            <h2>Dar de alta</h2>
            <FormularioPersona
              modo="alta"
              inicial={{ numero_documento: estado.documento }}
              alGuardar={async (datos) => {
                const alta = await api.personas.crear(datos);
                // Recepción ve el documento enmascarado en la respuesta; se usa el tecleado.
                setDocumento(datos.numero_documento);
                setCodigoNuevo({
                  codigo: alta.codigo_acceso,
                  para: `${alta.persona.nombres} ${alta.persona.apellidos}`,
                });
                await buscar(datos.numero_documento);
              }}
              alCancelar={siguientePersona}
            />
          </section>
        )}

        {codigoNuevo && (
          <CodigoUnaVez
            codigo={codigoNuevo.codigo}
            para={codigoNuevo.para}
            alCerrar={() => setCodigoNuevo(undefined)}
          />
        )}

        {error && (
          <p role="alert" className="mensaje mensaje--error">
            {error.message}
          </p>
        )}

        {estado.paso !== 'buscar' && (
          <footer>
            <button type="button" className="secondary" onClick={siguientePersona}>
              Siguiente persona
            </button>
          </footer>
        )}
      </article>
      {resumen.cargando && !resumen.datos && <Cargando />}
    </>
  );
}
