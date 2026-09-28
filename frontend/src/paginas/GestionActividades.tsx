import { useEffect, useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { api } from '../api/recursos';
import type { Actividad, Catalogos, DatosActividad } from '../api/tipos';
import { useCarga } from '../api/useCarga';
import { usePermisos } from '../auth/usePermisos';
import { Cargando, MensajeError } from '../componentes/Estado';
import { diaBogota, hora, isoBogota, nombreDia, rangoHoras } from '../utils/fechas';

type Edicion = { tipo: 'nueva' } | { tipo: 'editar'; actividad: Actividad } | undefined;

/** Explica los rechazos de la API con los datos que trae el detalle (§5). */
function describirError(error: ErrorApi): string {
  if (error.codigo === 'HORARIO_OCUPADO') {
    const ocupante = error.detalle.actividad as
      { nombre: string; inicio: string; fin: string } | undefined;
    if (ocupante) {
      return (
        `La zona ya está ocupada por «${ocupante.nombre}» de ${hora(ocupante.inicio)} a ` +
        `${hora(ocupante.fin)}. Elige otra zona u otro horario.`
      );
    }
  }
  return error.message;
}

/** P9: programación de actividades. Muestra los códigos para exhibirlos en cada salón. */
export function GestionActividades() {
  const [version, setVersion] = useState(0);
  const todas = useCarga(() => api.actividades.listar(), [version]);
  const catalogos = useCarga(() => api.catalogos(), []);
  const [dia, setDia] = useState<string>();
  const [edicion, setEdicion] = useState<Edicion>();
  const [aviso, setAviso] = useState<string>();
  const [error, setError] = useState<ErrorApi>();

  const dias = [...new Set((todas.datos ?? []).map((a) => diaBogota(a.inicio)))].sort();
  const hoy = diaBogota(new Date());
  const diaActivo = dia ?? (dias.includes(hoy) ? hoy : dias[0]);
  const delDia = (todas.datos ?? []).filter((a) => diaBogota(a.inicio) === diaActivo);

  async function cancelar(a: Actividad) {
    if (!window.confirm(`¿Cancelar «${a.nombre}»? Ya no se podrá registrar asistencia.`)) return;
    setError(undefined);
    try {
      await api.actividades.cancelar(a.id);
      setAviso(`«${a.nombre}» quedó cancelada.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : undefined);
    }
  }

  return (
    <>
      <div className="titulo-con-accion">
        <h1>Gestión de actividades</h1>
        <button type="button" onClick={() => setEdicion({ tipo: 'nueva' })}>
          Nueva actividad
        </button>
      </div>

      {edicion && catalogos.datos && (
        <FormularioActividad
          key={edicion.tipo === 'editar' ? edicion.actividad.id : 'nueva'}
          actividad={edicion.tipo === 'editar' ? edicion.actividad : undefined}
          diaSugerido={diaActivo ?? hoy}
          catalogos={catalogos.datos}
          alGuardar={(guardada) => {
            setAviso(
              edicion.tipo === 'nueva'
                ? `«${guardada.nombre}» quedó programada con el código ${guardada.codigo}.`
                : `«${guardada.nombre}» quedó actualizada.`,
            );
            setEdicion(undefined);
            setDia(diaBogota(guardada.inicio));
            setVersion((v) => v + 1);
          }}
          alCancelar={() => setEdicion(undefined)}
        />
      )}

      {aviso && (
        <p role="status" className="mensaje mensaje--exito">
          {aviso}
        </p>
      )}
      <MensajeError error={error ?? todas.error ?? catalogos.error} />

      <label className="selector-dia">
        Día
        <select value={diaActivo ?? ''} onChange={(e) => setDia(e.target.value)}>
          {dias.map((d) => (
            <option key={d} value={d}>
              {nombreDia(d)}
            </option>
          ))}
        </select>
      </label>

      {todas.cargando && !todas.datos && <Cargando />}
      <figure>
        <table className="striped">
          <thead>
            <tr>
              <th>Horario</th>
              <th>Actividad</th>
              <th className="ocultar-movil">Lugar</th>
              <th>Código</th>
              <th>
                <span className="visualmente-oculto">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {delDia.map((a) => (
              <tr key={a.id} className={a.cancelada ? 'fila--cancelada' : undefined}>
                <td className="numeros">{rangoHoras(a.inicio, a.fin)}</td>
                <td>
                  {a.cancelada ? <del>{a.nombre}</del> : a.nombre}
                  {a.cancelada && <span className="etiqueta etiqueta--alerta">Cancelada</span>}
                  <br />
                  <small className="texto-tenue">
                    {a.tipo.nombre}
                    {a.responsable && ` · ${a.responsable.nombres} ${a.responsable.apellidos}`}
                  </small>
                </td>
                <td className="ocultar-movil">{a.zona.nombre}</td>
                <td>
                  <code className="codigo-actividad">{a.codigo}</code>
                </td>
                <td className="acciones-fila">
                  <button
                    type="button"
                    className="secondary outline"
                    onClick={() => {
                      setAviso(undefined);
                      setEdicion({ tipo: 'editar', actividad: a });
                    }}
                  >
                    Editar
                  </button>
                  {!a.cancelada && (
                    <button
                      type="button"
                      className="secondary outline"
                      onClick={() => void cancelar(a)}
                    >
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </>
  );
}

function FormularioActividad({
  actividad,
  diaSugerido,
  catalogos,
  alGuardar,
  alCancelar,
}: {
  actividad?: Actividad;
  diaSugerido: string;
  catalogos: Catalogos;
  alGuardar: (a: Actividad) => void;
  alCancelar: () => void;
}) {
  const [campos, setCampos] = useState({
    nombre: actividad?.nombre ?? '',
    descripcion: actividad?.descripcion ?? '',
    tipo_actividad_id: String(actividad?.tipo.id ?? catalogos.tipos_actividad[0]?.id ?? ''),
    categoria_id: String(actividad?.categoria?.id ?? ''),
    zona_id: String(actividad?.zona.id ?? ''),
    responsable_id: String(actividad?.responsable?.id ?? ''),
    dia: actividad ? diaBogota(actividad.inicio) : diaSugerido,
    desde: actividad ? hora(actividad.inicio) : '08:00',
    hasta: actividad ? hora(actividad.fin) : '09:00',
  });
  const [error, setError] = useState<ErrorApi>();
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo: keyof typeof campos) => (e: { target: { value: string } }) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(undefined);
    const datos: DatosActividad = {
      nombre: campos.nombre.trim(),
      descripcion: campos.descripcion.trim() || null,
      tipo_actividad_id: Number(campos.tipo_actividad_id),
      categoria_id: campos.categoria_id ? Number(campos.categoria_id) : null,
      zona_id: Number(campos.zona_id),
      responsable_id: campos.responsable_id ? Number(campos.responsable_id) : null,
      inicio: isoBogota(campos.dia, campos.desde),
      fin: isoBogota(campos.dia, campos.hasta),
    };
    try {
      alGuardar(
        actividad
          ? await api.actividades.editar(actividad.id, datos)
          : await api.actividades.crear(datos),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  }

  const choque = error?.codigo === 'HORARIO_OCUPADO' ? true : undefined;

  return (
    <article className="formulario-actividad">
      <header>
        <strong>{actividad ? `Editar «${actividad.nombre}»` : 'Nueva actividad'}</strong>
      </header>
      <form onSubmit={enviar}>
        <label>
          Nombre
          <input name="nombre" value={campos.nombre} onChange={cambiar('nombre')} required />
        </label>
        <label>
          Descripción
          <textarea
            name="descripcion"
            rows={2}
            value={campos.descripcion}
            onChange={cambiar('descripcion')}
          />
        </label>
        <div className="grid">
          <label>
            Tipo
            <select value={campos.tipo_actividad_id} onChange={cambiar('tipo_actividad_id')}>
              {catalogos.tipos_actividad.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoría
            <select value={campos.categoria_id} onChange={cambiar('categoria_id')}>
              <option value="">Sin categoría</option>
              {catalogos.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Zona
          <select
            name="zona"
            value={campos.zona_id}
            onChange={cambiar('zona_id')}
            aria-invalid={choque}
            required
          >
            <option value="" disabled>
              Elige una zona
            </option>
            {catalogos.edificios.map((e) => (
              <optgroup key={e.id} label={e.nombre}>
                {e.zonas
                  .filter((z) => z.activa)
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                      {z.capacidad && ` (${z.capacidad} personas)`}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="grid">
          <label>
            Día
            <input name="dia" type="date" value={campos.dia} onChange={cambiar('dia')} required />
          </label>
          <label>
            Desde
            <input
              name="desde"
              type="time"
              value={campos.desde}
              onChange={cambiar('desde')}
              aria-invalid={choque}
              required
            />
          </label>
          <label>
            Hasta
            <input
              name="hasta"
              type="time"
              value={campos.hasta}
              onChange={cambiar('hasta')}
              aria-invalid={choque}
              required
            />
          </label>
        </div>
        <SelectorResponsable
          actual={actividad?.responsable ?? null}
          valor={campos.responsable_id}
          alCambiar={(id) => setCampos((c) => ({ ...c, responsable_id: id }))}
        />
        <p>
          <small className="texto-tenue">Horas en hora de Bogotá.</small>
        </p>
        {error && (
          <p role="alert" className="mensaje mensaje--error">
            {describirError(error)}
          </p>
        )}
        <div className="acciones">
          <button type="submit" aria-busy={guardando} disabled={guardando}>
            {actividad ? 'Guardar cambios' : 'Programar actividad'}
          </button>
          <button type="button" className="secondary outline" onClick={alCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </article>
  );
}

/**
 * Busca el responsable en el directorio. Buscar exige `persona.leer`; sin él solo se
 * conserva el responsable actual.
 */
function SelectorResponsable({
  actual,
  valor,
  alCambiar,
}: {
  actual: Actividad['responsable'];
  valor: string;
  alCambiar: (id: string) => void;
}) {
  const { puede } = usePermisos();
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const espera = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(espera);
  }, [busqueda]);
  const resultados = useCarga(
    () =>
      puede('persona.leer') && q.length >= 2
        ? api.personas.listar({ q }).then((r) => r.items)
        : Promise.resolve([]),
    [q],
  );

  if (!puede('persona.leer')) {
    return actual ? (
      <p>
        Responsable: {actual.nombres} {actual.apellidos}
      </p>
    ) : null;
  }

  const opciones = [
    ...(actual ? [{ id: actual.id, nombre: `${actual.nombres} ${actual.apellidos}` }] : []),
    ...(resultados.datos ?? [])
      .filter((p) => p.id !== actual?.id && p.activo)
      .map((p) => ({ id: p.id, nombre: `${p.nombres} ${p.apellidos} (${p.rol})` })),
  ];

  return (
    <fieldset className="grid">
      <label>
        Buscar responsable
        <input
          type="search"
          placeholder="Nombre o documento"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>
      <label>
        Responsable
        <select name="responsable" value={valor} onChange={(e) => alCambiar(e.target.value)}>
          <option value="">Sin responsable</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
