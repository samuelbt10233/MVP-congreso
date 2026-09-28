import { Link } from 'react-router';
import { api } from '../api/recursos';
import type { Actividad } from '../api/tipos';
import { useCarga } from '../api/useCarga';
import { usePerfil } from '../auth/sesion';
import { Puede } from '../auth/Puede';
import { Cargando, MensajeError } from '../componentes/Estado';
import { PANTALLAS } from '../rutas/pantallas';
import { diaBogota, nombreDia, rangoHoras } from '../utils/fechas';

function ahoraUtc(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** P1: la misma ruta para todos; los bloques dependen de los permisos (§9.10). */
export function Inicio() {
  const { persona } = usePerfil();
  const actividades = useCarga(() => api.actividades.listar(), []);

  const ahora = ahoraUtc();
  const vigentes = (actividades.datos ?? []).filter((a) => !a.cancelada && a.fin > ahora);
  const enCurso = vigentes.filter((a) => a.inicio <= ahora);
  const proxima = vigentes.find((a) => a.inicio > ahora);
  const propias = (actividades.datos ?? []).filter((a) => a.responsable?.id === persona.id);

  return (
    <>
      <hgroup>
        <h1>Hola, {persona.nombres}</h1>
        <p>V Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global</p>
      </hgroup>

      <div className="grid-bloques">
        <article>
          <header>Ahora en el congreso</header>
          {actividades.cargando && <Cargando />}
          <MensajeError error={actividades.error} />
          {!actividades.cargando && enCurso.length === 0 && !proxima && (
            <p>No hay más actividades programadas.</p>
          )}
          {enCurso.length > 0 && (
            <>
              <p>
                <strong>En curso</strong>
              </p>
              <ul>
                {enCurso.map((a) => (
                  <li key={a.id}>
                    <ResumenActividad actividad={a} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {proxima && (
            <>
              <p>
                <strong>Próxima</strong>
              </p>
              <ResumenActividad actividad={proxima} conDia />
            </>
          )}
          <footer>
            <Link to={PANTALLAS.cronograma.ruta}>Ver cronograma completo</Link>
          </footer>
        </article>

        <article>
          <header>Accesos rápidos</header>
          <p>
            <Link role="button" to={PANTALLAS.asistencia.ruta}>
              Registrar asistencia
            </Link>
          </p>
          <p>
            <Link to={PANTALLAS.perfil.ruta}>Ver mi escarapela</Link>
          </p>
          <Puede permiso="llegada.registrar">
            <p>
              <Link to={PANTALLAS.recepcion.ruta}>Ir a recepción</Link>
            </p>
          </Puede>
          <Puede permiso="actividad.gestionar">
            <p>
              <Link to={PANTALLAS.actividades.ruta}>Gestionar actividades</Link>
            </p>
          </Puede>
        </article>

        <Puede permiso="estadistica.leer">
          <ResumenDelDia />
        </Puede>

        {propias.length > 0 && (
          <article>
            <header>Actividades que diriges</header>
            <ul>
              {propias.map((a) => (
                <li key={a.id}>
                  <ResumenActividad actividad={a} conDia />
                </li>
              ))}
            </ul>
            <footer>
              <small>Puedes ver sus asistentes desde el cronograma.</small>
            </footer>
          </article>
        )}
      </div>
    </>
  );
}

function ResumenActividad({ actividad, conDia }: { actividad: Actividad; conDia?: boolean }) {
  return (
    <span>
      {actividad.nombre}
      <br />
      <small>
        {conDia && `${nombreDia(diaBogota(actividad.inicio))} · `}
        {rangoHoras(actividad.inicio, actividad.fin)} · {actividad.zona.nombre}
        {actividad.cancelada && ' · cancelada'}
      </small>
    </span>
  );
}

/** Solo se monta con `estadistica.leer`, así que solo entonces se consulta. */
function ResumenDelDia() {
  const { datos, error, cargando } = useCarga(() => api.estadisticas(), []);
  const hoy = diaBogota(new Date());
  const llegadasHoy = datos?.llegadas_por_dia.find((d) => d.dia === hoy)?.total ?? 0;

  return (
    <article>
      <header>Resumen del día</header>
      {cargando && <Cargando />}
      <MensajeError error={error} />
      {datos && (
        <dl className="cifras">
          <div>
            <dt>Llegadas hoy</dt>
            <dd>{llegadasHoy}</dd>
          </div>
          <div>
            <dt>Asistencias registradas</dt>
            <dd>{datos.totales.asistencias}</dd>
          </div>
          <div>
            <dt>Actividades en curso</dt>
            <dd>{datos.actividades_en_curso.length}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}
