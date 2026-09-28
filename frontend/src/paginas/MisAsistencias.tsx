import { Link } from 'react-router';
import { api } from '../api/recursos';
import { useCarga } from '../api/useCarga';
import { Cargando, MensajeError } from '../componentes/Estado';
import { PANTALLAS } from '../rutas/pantallas';
import { diaBogota, hora, nombreDia, rangoHoras } from '../utils/fechas';

/** P5: historial propio. */
export function MisAsistencias() {
  const { datos, error, cargando } = useCarga(() => api.asistencia.mias(), []);

  return (
    <>
      <h1>Mis asistencias</h1>
      {cargando && <Cargando />}
      <MensajeError error={error} />
      {datos?.length === 0 && (
        <p>
          Aún no registras asistencia a ninguna actividad.{' '}
          <Link to={PANTALLAS.asistencia.ruta}>Registrar asistencia</Link>
        </p>
      )}
      {datos && datos.length > 0 && (
        <figure>
          <table className="striped">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Día</th>
                <th>Horario</th>
                <th>Lugar</th>
                <th>Registrada</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((r) => (
                <tr key={r.actividad.id}>
                  <td>{r.actividad.nombre}</td>
                  <td>{nombreDia(diaBogota(r.actividad.inicio))}</td>
                  <td>{rangoHoras(r.actividad.inicio, r.actividad.fin)}</td>
                  <td>{r.actividad.zona}</td>
                  <td>{hora(r.fecha_hora)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </>
  );
}
