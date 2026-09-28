import { useEffect, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { api } from '../api/recursos';
import type { CodigoPermiso, Persona } from '../api/tipos';
import { useCarga } from '../api/useCarga';
import { usePerfil } from '../auth/sesion';
import { Puede } from '../auth/Puede';
import { usePermisos } from '../auth/usePermisos';
import { CodigoUnaVez } from '../componentes/CodigoUnaVez';
import { Cargando, MensajeError } from '../componentes/Estado';
import { FormularioPersona } from '../componentes/FormularioPersona';

type Seleccion = { tipo: 'persona'; id: number } | { tipo: 'nueva' } | undefined;

/** P6: directorio con formulario lateral de alta, edición, permisos y código (§9.6). */
export function Personas() {
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<Seleccion>();
  const [version, setVersion] = useState(0);

  // Espera a que se deje de escribir antes de consultar.
  useEffect(() => {
    const espera = setTimeout(() => {
      setQ(busqueda.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [busqueda]);

  const listado = useCarga(() => api.personas.listar({ q, pagina }), [q, pagina, version]);
  const totalPaginas = listado.datos
    ? Math.max(1, Math.ceil(listado.datos.total / listado.datos.por_pagina))
    : 1;
  const refrescar = () => setVersion((v) => v + 1);

  return (
    <>
      <div className="titulo-con-accion">
        <h1>Personas</h1>
        <Puede permiso="persona.crear">
          <button type="button" onClick={() => setSeleccion({ tipo: 'nueva' })}>
            Nueva persona
          </button>
        </Puede>
      </div>

      <div className="directorio">
        <section>
          <input
            type="search"
            placeholder="Buscar por nombre o documento"
            aria-label="Buscar personas"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <MensajeError error={listado.error} />
          {listado.cargando && !listado.datos && <Cargando />}
          {listado.datos && (
            <>
              <figure>
                <table className="striped tabla-seleccionable">
                  <caption>{listado.datos.total} personas</caption>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Documento</th>
                      <th>Rol</th>
                      <th>Organización</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listado.datos.items.map((p) => (
                      <tr
                        key={p.id}
                        aria-selected={seleccion?.tipo === 'persona' && seleccion.id === p.id}
                      >
                        <td>
                          <button
                            type="button"
                            className="enlace"
                            onClick={() => setSeleccion({ tipo: 'persona', id: p.id })}
                          >
                            {p.apellidos}, {p.nombres}
                          </button>
                          {!p.activo && <span className="etiqueta etiqueta--alerta">Inactiva</span>}
                        </td>
                        <td>
                          <code>
                            {p.tipo_documento} {p.numero_documento}
                          </code>
                        </td>
                        <td>{p.rol}</td>
                        <td>{p.organizacion ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
              <div className="paginacion">
                <button
                  type="button"
                  className="secondary outline"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="secondary outline"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </section>

        {seleccion && (
          <aside className="panel-lateral">
            {seleccion.tipo === 'nueva' ? (
              <AltaPersona
                alTerminar={() => {
                  refrescar();
                }}
                alCerrar={() => setSeleccion(undefined)}
              />
            ) : (
              // `key` reinicia el panel al cambiar de persona: el código generado se descarta.
              <DetallePersona
                key={seleccion.id}
                id={seleccion.id}
                alCambiar={refrescar}
                alCerrar={() => setSeleccion(undefined)}
              />
            )}
          </aside>
        )}
      </div>
    </>
  );
}

function AltaPersona({ alTerminar, alCerrar }: { alTerminar: () => void; alCerrar: () => void }) {
  const { puede } = usePermisos();
  const catalogos = useCarga(() => api.catalogos(), []);
  const [creada, setCreada] = useState<{ nombre: string; codigo: string }>();

  if (creada) {
    return (
      <article>
        <header>Persona dada de alta</header>
        <CodigoUnaVez codigo={creada.codigo} para={creada.nombre} alCerrar={alCerrar} />
      </article>
    );
  }

  return (
    <article>
      <header className="titulo-con-accion">
        <strong>Nueva persona</strong>
        <button type="button" className="secondary outline cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      </header>
      {catalogos.cargando ? (
        <Cargando />
      ) : (
        <FormularioPersona
          modo="alta"
          // Elegir rol aplica su plantilla de permisos: solo con permiso.gestionar (I12).
          roles={puede('permiso.gestionar') ? catalogos.datos?.roles : undefined}
          alGuardar={async (datos) => {
            const alta = await api.personas.crear(datos);
            setCreada({
              nombre: `${alta.persona.nombres} ${alta.persona.apellidos}`,
              codigo: alta.codigo_acceso,
            });
            alTerminar();
          }}
        />
      )}
    </article>
  );
}

function DetallePersona({
  id,
  alCambiar,
  alCerrar,
}: {
  id: number;
  alCambiar: () => void;
  alCerrar: () => void;
}) {
  const { puede } = usePermisos();
  const [version, setVersion] = useState(0);
  const persona = useCarga(() => api.personas.obtener(id), [id, version]);
  const catalogos = useCarga(() => api.catalogos(), []);
  const [guardado, setGuardado] = useState(false);

  if (persona.cargando && !persona.datos) return <Cargando />;
  if (persona.error) return <MensajeError error={persona.error} />;
  const p = persona.datos!;

  return (
    <article>
      <header className="titulo-con-accion">
        <strong>
          {p.nombres} {p.apellidos}
        </strong>
        <button type="button" className="secondary outline cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      </header>

      {puede('persona.editar') && catalogos.datos ? (
        <>
          <FormularioPersona
            modo="edicion"
            inicial={p}
            roles={catalogos.datos.roles}
            alGuardar={async (datos) => {
              await api.personas.editar(id, datos);
              setGuardado(true);
              setVersion((v) => v + 1);
              alCambiar();
            }}
          />
          {guardado && (
            <p role="status" className="mensaje mensaje--exito">
              Cambios guardados.
            </p>
          )}
        </>
      ) : (
        <FichaPersona persona={p} />
      )}

      <Puede permiso="permiso.gestionar">
        <EditorPermisos personaId={id} />
      </Puede>

      <Puede permiso="usuario.gestionar">
        <GenerarCodigo persona={p} />
      </Puede>
    </article>
  );
}

function FichaPersona({ persona: p }: { persona: Persona }) {
  const datos: [string, string | null][] = [
    ['Documento', `${p.tipo_documento} ${p.numero_documento}`],
    ['Rol', p.rol],
    ['Organización', p.organizacion],
    ['Nacionalidad', p.nacionalidad],
    ['Estado', p.activo ? 'Activa' : 'Inactiva'],
  ];
  return (
    <dl className="datos">
      {datos.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditorPermisos({ personaId }: { personaId: number }) {
  const { persona: yo } = usePerfil();
  const catalogos = useCarga(() => api.catalogos(), []);
  const actuales = useCarga(() => api.personas.permisos(personaId), [personaId]);
  const [marcados, setMarcados] = useState<Set<CodigoPermiso>>();
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string }>();

  useEffect(() => {
    if (actuales.datos) setMarcados(new Set(actuales.datos.permisos));
  }, [actuales.datos]);

  if (!catalogos.datos || !marcados) return <Cargando texto="Cargando permisos…" />;

  async function guardar() {
    setMensaje(undefined);
    try {
      const { permisos } = await api.personas.guardarPermisos(personaId, [...marcados!]);
      setMarcados(new Set(permisos));
      setMensaje({ tipo: 'exito', texto: 'Permisos actualizados.' });
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof ErrorApi ? e.message : 'No se pudieron guardar los permisos.',
      });
    }
  }

  return (
    <details open>
      <summary>Permisos en el sistema</summary>
      <fieldset>
        {catalogos.datos.permisos.map((p) => (
          <label key={p.codigo} className="opcion-permiso">
            <input
              type="checkbox"
              checked={marcados.has(p.codigo)}
              onChange={(e) => {
                const nuevos = new Set(marcados);
                if (e.target.checked) nuevos.add(p.codigo);
                else nuevos.delete(p.codigo);
                setMarcados(nuevos);
              }}
            />
            <span>
              {p.nombre}
              <span className="opcion-permiso__descripcion">{p.descripcion}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {personaId === yo.id && (
        <p>
          <small>No puedes quitarte a ti mismo el permiso de gestionar permisos.</small>
        </p>
      )}
      <button type="button" className="secondary" onClick={() => void guardar()}>
        Guardar permisos
      </button>
      {mensaje && (
        <p
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={`mensaje mensaje--${mensaje.tipo}`}
        >
          {mensaje.texto}
        </p>
      )}
    </details>
  );
}

function GenerarCodigo({ persona }: { persona: Persona }) {
  const [codigo, setCodigo] = useState<string>();
  const [error, setError] = useState<ErrorApi>();

  async function generar() {
    if (
      !window.confirm(
        `¿Generar un código nuevo para ${persona.nombres}? El código anterior dejará de servir.`,
      )
    ) {
      return;
    }
    setError(undefined);
    try {
      setCodigo((await api.personas.generarCodigo(persona.id)).codigo_acceso);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo generar.'));
    }
  }

  return (
    <details>
      <summary>Código de acceso</summary>
      {codigo ? (
        <CodigoUnaVez
          codigo={codigo}
          para={`${persona.nombres} ${persona.apellidos}`}
          alCerrar={() => setCodigo(undefined)}
        />
      ) : (
        <>
          <p>
            <small>
              El código actual no se puede consultar: solo se guarda cifrado. Si la persona lo
              perdió, genera uno nuevo.
            </small>
          </p>
          <button type="button" className="secondary" onClick={() => void generar()}>
            Generar código nuevo
          </button>
        </>
      )}
      <MensajeError error={error} />
    </details>
  );
}
