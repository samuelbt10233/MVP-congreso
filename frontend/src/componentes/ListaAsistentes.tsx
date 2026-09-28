import { api } from '../api/recursos';
import { useCarga } from '../api/useCarga';
import { hora } from '../utils/fechas';
import { Cargando, MensajeError } from './Estado';

/** Asistentes de una actividad: con `registro.leer` o siendo su responsable (§9.4). */
export function ListaAsistentes({ actividadId }: { actividadId: number }) {
  const { datos, error, cargando } = useCarga(
    () => api.actividades.asistentes(actividadId),
    [actividadId],
  );
  if (cargando) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!datos || datos.total === 0) return <p>Aún no hay asistentes registrados.</p>;
  return (
    <figure>
      <table className="striped">
        <caption>{datos.total} asistentes</caption>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Organización</th>
            <th>Hora</th>
          </tr>
        </thead>
        <tbody>
          {datos.asistentes.map((r) => (
            <tr key={r.persona.id}>
              <td>
                {r.persona.nombres} {r.persona.apellidos}
              </td>
              <td>{r.persona.organizacion ?? '—'}</td>
              <td>{hora(r.fecha_hora)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
