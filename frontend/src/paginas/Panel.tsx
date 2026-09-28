import { Fragment, useState } from 'react';
import { api } from '../api/recursos';
import { useCarga } from '../api/useCarga';
import { Puede } from '../auth/Puede';
import { usePermisos } from '../auth/usePermisos';
import { Cargando, MensajeError } from '../componentes/Estado';
import { ListaAsistentes } from '../componentes/ListaAsistentes';
import { Medidor } from '../componentes/Medidor';
import { diaBogota, hora, nombreDia, rangoHoras } from '../utils/fechas';

const cifra = new Intl.NumberFormat('es-CO');

/** P12: estadísticas (estadistica.leer) y registros de llegada (registro.leer). */
export function Panel() {
  return (
    <>
      <h1>Panel</h1>
      <Puede permiso="estadistica.leer">
        <Estadisticas />
      </Puede>
      <Puede permiso="registro.leer">
        <LlegadasDelDia />
      </Puede>
    </>
  );
}

function Estadisticas() {
  const { puede } = usePermisos();
  const { datos, error, cargando } = useCarga(() => api.estadisticas(), []);
  const [dia, setDia] = useState<string>();
  const [abierta, setAbierta] = useState<number>();

  if (cargando) return <Cargando />;
  if (error || !datos) return <MensajeError error={error} />;

  const hoy = diaBogota(new Date());
  const llegadasHoy = datos.llegadas_por_dia.find((d) => d.dia === hoy)?.total ?? 0;
  const dias = [...new Set(datos.por_actividad.map((a) => diaBogota(a.inicio)))].sort();
  const diaActivo = dia ?? (dias.includes(hoy) ? hoy : dias[0]);
  const actividades = datos.por_actividad.filter((a) => diaBogota(a.inicio) === diaActivo);

  const indicadores = [
    { etiqueta: 'Llegadas hoy', valor: llegadasHoy },
    { etiqueta: 'Asistencias registradas', valor: datos.totales.asistencias },
    { etiqueta: 'Actividades en curso', valor: datos.actividades_en_curso.length },
    { etiqueta: 'Personas inscritas', valor: datos.totales.personas },
  ];

  return (
    <>
      <section className="indicadores" aria-label="Indicadores del congreso">
        {indicadores.map((i) => (
          <article key={i.etiqueta} className="indicador">
            <span className="indicador__etiqueta">{i.etiqueta}</span>
            <span className="indicador__valor">{cifra.format(i.valor)}</span>
          </article>
        ))}
      </section>

      {datos.llegadas_por_dia.length > 0 && (
        <p className="texto-tenue">
          Llegadas por día:{' '}
          {datos.llegadas_por_dia
            .map((d) => `${nombreDia(d.dia)}: ${cifra.format(d.total)}`)
            .join(' · ')}
        </p>
      )}

      <section>
        <div className="titulo-con-accion">
          <h2>Ocupación por actividad</h2>
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
        </div>
        <figure>
          <table className="striped">
            <caption className="texto-tenue">
              Asistentes registrados frente a la capacidad de la zona
            </caption>
            <thead>
              <tr>
                <th>Horario</th>
                <th>Actividad</th>
                <th className="ocultar-movil">Lugar</th>
                <th className="numeros">Asistentes</th>
                <th>Ocupación</th>
              </tr>
            </thead>
            <tbody>
              {actividades.map((a) => (
                <Fragment key={a.id}>
                  <tr className={a.cancelada ? 'fila--cancelada' : undefined}>
                    <td className="numeros">{rangoHoras(a.inicio, a.fin)}</td>
                    <td>
                      {a.cancelada ? <del>{a.nombre}</del> : a.nombre}
                      {a.en_curso && <span className="etiqueta etiqueta--en-curso">En curso</span>}
                      {a.cancelada && <span className="etiqueta etiqueta--alerta">Cancelada</span>}
                      {puede('registro.leer') && a.asistentes > 0 && (
                        <>
                          <br />
                          <button
                            type="button"
                            className="enlace"
                            onClick={() => setAbierta(abierta === a.id ? undefined : a.id)}
                          >
                            {abierta === a.id ? 'Ocultar asistentes' : 'Ver asistentes'}
                          </button>
                        </>
                      )}
                    </td>
                    <td className="ocultar-movil">{a.zona}</td>
                    <td className="numeros">
                      {cifra.format(a.asistentes)}
                      {a.capacidad !== null && (
                        <span className="texto-tenue"> / {cifra.format(a.capacidad)}</span>
                      )}
                    </td>
                    <td>
                      {a.cancelada ? '—' : <Medidor valor={a.ocupacion} etiqueta={a.nombre} />}
                    </td>
                  </tr>
                  {abierta === a.id && (
                    <tr>
                      <td colSpan={5}>
                        <ListaAsistentes actividadId={a.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </figure>
      </section>
    </>
  );
}

function LlegadasDelDia() {
  const [dia, setDia] = useState(diaBogota(new Date()));
  const { datos, error, cargando } = useCarga(() => api.llegadas(dia), [dia]);

  return (
    <section>
      <div className="titulo-con-accion">
        <h2>Llegadas del día</h2>
        <label className="selector-dia">
          Día
          <input
            type="date"
            value={dia}
            onChange={(e) => e.target.value && setDia(e.target.value)}
          />
        </label>
      </div>
      {cargando && <Cargando />}
      <MensajeError error={error} />
      {datos && datos.total === 0 && <p>No hay llegadas registradas ese día.</p>}
      {datos && datos.total > 0 && (
        <figure>
          <table className="striped">
            <caption className="texto-tenue">{cifra.format(datos.total)} llegadas</caption>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Persona</th>
                <th className="ocultar-movil">Rol</th>
                <th>Registró</th>
              </tr>
            </thead>
            <tbody>
              {datos.llegadas.map((l) => (
                <tr key={l.id}>
                  <td className="numeros">{hora(l.fecha_hora)}</td>
                  <td>
                    {l.persona.nombres} {l.persona.apellidos}
                  </td>
                  <td className="ocultar-movil">{l.persona.rol}</td>
                  <td>
                    {l.registrado_por.nombres} {l.registrado_por.apellidos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </section>
  );
}
