import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/recursos';
import type { Actividad } from '../api/tipos';
import { useCarga } from '../api/useCarga';
import { usePerfil } from '../auth/sesion';
import { Puede } from '../auth/Puede';
import { usePermisos } from '../auth/usePermisos';
import { Cargando, MensajeError } from '../componentes/Estado';
import { ListaAsistentes } from '../componentes/ListaAsistentes';
import { diaBogota, nombreDia, rangoHoras } from '../utils/fechas';

const FILTROS = ['dia', 'zona_id', 'tipo_id', 'categoria_id'] as const;

const numero = (valor: string | null) => (valor ? Number(valor) : undefined);

/** P2: listado con filtros por día, zona, tipo y categoría; los filtros viven en la URL. */
export function Cronograma() {
  const [parametros, setParametros] = useSearchParams();
  const catalogos = useCarga(() => api.catalogos(), []);
  // Sin filtros, para saber qué días tiene el congreso.
  const todas = useCarga(() => api.actividades.listar(), []);

  const dias = [...new Set((todas.datos ?? []).map((a) => diaBogota(a.inicio)))].sort();
  const hoy = diaBogota(new Date());
  const dia = parametros.get('dia') ?? (dias.includes(hoy) ? hoy : dias[0]);
  const filtros = {
    dia,
    zona_id: numero(parametros.get('zona_id')),
    tipo_id: numero(parametros.get('tipo_id')),
    categoria_id: numero(parametros.get('categoria_id')),
  };

  const actividades = useCarga(
    () => (dia ? api.actividades.listar(filtros) : Promise.resolve([])),
    FILTROS.map((f) => filtros[f]),
  );

  function cambiarFiltro(nombre: (typeof FILTROS)[number], valor: string) {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(nombre, valor);
    else nuevos.delete(nombre);
    setParametros(nuevos, { replace: true });
  }

  return (
    <>
      <h1>Cronograma</h1>

      <div className="filtros" role="search">
        <label>
          Día
          <select value={dia ?? ''} onChange={(e) => cambiarFiltro('dia', e.target.value)}>
            {dias.map((d) => (
              <option key={d} value={d}>
                {nombreDia(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zona
          <select
            value={parametros.get('zona_id') ?? ''}
            onChange={(e) => cambiarFiltro('zona_id', e.target.value)}
          >
            <option value="">Todas</option>
            {catalogos.datos?.edificios.map((e) => (
              <optgroup key={e.id} label={e.nombre}>
                {e.zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select
            value={parametros.get('tipo_id') ?? ''}
            onChange={(e) => cambiarFiltro('tipo_id', e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos.datos?.tipos_actividad.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select
            value={parametros.get('categoria_id') ?? ''}
            onChange={(e) => cambiarFiltro('categoria_id', e.target.value)}
          >
            <option value="">Todas</option>
            {catalogos.datos?.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MensajeError error={todas.error ?? catalogos.error ?? actividades.error} />
      {(todas.cargando || actividades.cargando) && <Cargando />}
      {!actividades.cargando && actividades.datos?.length === 0 && (
        <p>No hay actividades con estos filtros.</p>
      )}

      <div className="actividades">
        {actividades.datos?.map((a) => (
          <TarjetaActividad key={a.id} actividad={a} />
        ))}
      </div>
    </>
  );
}

function TarjetaActividad({ actividad: a }: { actividad: Actividad }) {
  const { persona } = usePerfil();
  const { puede } = usePermisos();
  const [verAsistentes, setVerAsistentes] = useState(false);
  // Asistentes: con registro.leer, o siendo responsable de la actividad (§9.4).
  const puedeVerAsistentes = puede('registro.leer') || a.responsable?.id === persona.id;

  return (
    <details className={a.cancelada ? 'actividad actividad--cancelada' : 'actividad'}>
      <summary>
        <span className="actividad__hora">{rangoHoras(a.inicio, a.fin)}</span>
        <span className="actividad__nombre">
          {a.cancelada ? <del>{a.nombre}</del> : a.nombre}
          {a.cancelada && <span className="etiqueta etiqueta--alerta">Cancelada</span>}
        </span>
        <small className="actividad__lugar">
          {a.tipo.nombre} · {a.zona.nombre}
        </small>
      </summary>
      <div className="actividad__detalle">
        {a.descripcion && <p>{a.descripcion}</p>}
        <dl>
          <dt>Lugar</dt>
          <dd>
            {a.zona.nombre}, {a.zona.edificio.nombre}
            {a.zona.piso !== null && `, piso ${a.zona.piso}`}
          </dd>
          {a.categoria && (
            <>
              <dt>Categoría</dt>
              <dd>{a.categoria.nombre}</dd>
            </>
          )}
          {a.responsable && (
            <>
              <dt>Responsable</dt>
              <dd>
                {a.responsable.nombres} {a.responsable.apellidos}
              </dd>
            </>
          )}
          {/* El backend solo envía el código a quien gestiona actividades (regla 9). */}
          <Puede permiso="actividad.gestionar">
            {a.codigo && (
              <>
                <dt>Código de asistencia</dt>
                <dd>
                  <code className="codigo-actividad">{a.codigo}</code>
                </dd>
              </>
            )}
          </Puede>
        </dl>
        {puedeVerAsistentes && (
          <button
            type="button"
            className="secondary outline"
            onClick={() => setVerAsistentes((v) => !v)}
          >
            {verAsistentes ? 'Ocultar asistentes' : 'Ver asistentes'}
          </button>
        )}
        {verAsistentes && <ListaAsistentes actividadId={a.id} />}
      </div>
    </details>
  );
}
