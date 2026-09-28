import { usePerfil } from '../auth/sesion';
import { Escarapela } from '../componentes/Escarapela';

/** P3: datos propios y vista de escarapela. */
export function MiPerfil() {
  const { persona } = usePerfil();
  const datos: [string, string | null][] = [
    ['Documento', `${persona.tipo_documento} ${persona.numero_documento}`],
    ['Correo', persona.correo],
    ['Teléfono', persona.telefono],
    ['Organización', persona.organizacion],
    ['Nacionalidad', persona.nacionalidad],
    ['Rol en el congreso', persona.rol],
  ];

  return (
    <>
      <h1>Mi perfil</h1>
      <div className="perfil">
        <Escarapela persona={persona} />
        <article>
          <header>
            {persona.nombres} {persona.apellidos}
          </header>
          <dl className="datos">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <footer>
            <small>
              Tu código de acceso no aparece aquí ni en la escarapela. Si lo perdiste, pide uno
              nuevo en la entrada del congreso.
            </small>
          </footer>
        </article>
      </div>
    </>
  );
}
