import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import type { Catalogos, DatosPersona, Persona } from '../api/tipos';

const TIPOS_DOCUMENTO = [
  ['CC', 'Cédula de ciudadanía'],
  ['CE', 'Cédula de extranjería'],
  ['TI', 'Tarjeta de identidad'],
  ['PAS', 'Pasaporte'],
] as const;

type Campos = {
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  organizacion: string;
  nacionalidad: string;
  rol_id: string;
  activo: boolean;
};

const opcional = (valor: string) => (valor.trim() === '' ? null : valor.trim());

/**
 * Alta o edición de una persona. El selector de rol solo aparece si se pasan
 * `roles`; quien no puede gestionar permisos da de alta visitantes (I12).
 */
export function FormularioPersona({
  inicial,
  roles,
  modo,
  alGuardar,
  alCancelar,
}: {
  inicial?: Partial<Persona>;
  roles?: Catalogos['roles'];
  modo: 'alta' | 'edicion';
  alGuardar: (datos: DatosPersona) => Promise<void>;
  alCancelar?: () => void;
}) {
  const [campos, setCampos] = useState<Campos>({
    tipo_documento: inicial?.tipo_documento ?? 'CC',
    numero_documento: inicial?.numero_documento ?? '',
    nombres: inicial?.nombres ?? '',
    apellidos: inicial?.apellidos ?? '',
    correo: inicial?.correo ?? '',
    telefono: inicial?.telefono ?? '',
    organizacion: inicial?.organizacion ?? '',
    nacionalidad: inicial?.nacionalidad ?? (modo === 'alta' ? 'Colombia' : ''),
    rol_id: String(inicial?.rol_id ?? roles?.find((r) => r.nombre === 'visitante')?.id ?? ''),
    activo: inicial?.activo ?? true,
  });
  const [error, setError] = useState<ErrorApi>();
  const [guardando, setGuardando] = useState(false);

  const cambiar =
    (campo: keyof Campos) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
      setCampos((c) => ({
        ...c,
        [campo]: e.target.type === 'checkbox' ? Boolean(e.target.checked) : e.target.value,
      }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(undefined);
    const datos: DatosPersona = {
      tipo_documento: campos.tipo_documento,
      numero_documento: campos.numero_documento.trim(),
      nombres: campos.nombres.trim(),
      apellidos: campos.apellidos.trim(),
      correo: opcional(campos.correo),
      telefono: opcional(campos.telefono),
      organizacion: opcional(campos.organizacion),
      nacionalidad: opcional(campos.nacionalidad),
      ...(roles && campos.rol_id && { rol_id: Number(campos.rol_id) }),
      ...(modo === 'edicion' && { activo: campos.activo }),
    };
    try {
      await alGuardar(datos);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  }

  const invalido = (campo: string) =>
    (error?.detalle.campos as { campo: string }[] | undefined)?.some((c) => c.campo === campo) ||
    (error?.codigo === 'DOCUMENTO_DUPLICADO' && campo === 'numero_documento')
      ? true
      : undefined;

  return (
    <form onSubmit={enviar}>
      <div className="grid">
        <label>
          Tipo de documento
          <select value={campos.tipo_documento} onChange={cambiar('tipo_documento')}>
            {TIPOS_DOCUMENTO.map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Número de documento
          <input
            name="numero_documento"
            value={campos.numero_documento}
            onChange={cambiar('numero_documento')}
            aria-invalid={invalido('numero_documento')}
            required
          />
        </label>
      </div>
      <div className="grid">
        <label>
          Nombres
          <input
            name="nombres"
            value={campos.nombres}
            onChange={cambiar('nombres')}
            aria-invalid={invalido('nombres')}
            required
          />
        </label>
        <label>
          Apellidos
          <input
            name="apellidos"
            value={campos.apellidos}
            onChange={cambiar('apellidos')}
            aria-invalid={invalido('apellidos')}
            required
          />
        </label>
      </div>
      <div className="grid">
        <label>
          Correo
          <input
            name="correo"
            type="email"
            value={campos.correo}
            onChange={cambiar('correo')}
            aria-invalid={invalido('correo')}
          />
        </label>
        <label>
          Teléfono
          <input name="telefono" value={campos.telefono} onChange={cambiar('telefono')} />
        </label>
      </div>
      <div className="grid">
        <label>
          Organización
          <input
            name="organizacion"
            value={campos.organizacion}
            onChange={cambiar('organizacion')}
          />
        </label>
        <label>
          Nacionalidad
          <input
            name="nacionalidad"
            value={campos.nacionalidad}
            onChange={cambiar('nacionalidad')}
          />
        </label>
      </div>
      {roles ? (
        <label>
          Rol
          <select name="rol" value={campos.rol_id} onChange={cambiar('rol_id')}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          {modo === 'alta' && <small>Se le otorgarán los permisos de la plantilla del rol.</small>}
        </label>
      ) : (
        modo === 'alta' && (
          <p>
            <small>Se dará de alta como visitante, sin permisos.</small>
          </p>
        )
      )}
      {modo === 'edicion' && (
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={campos.activo}
            onChange={cambiar('activo')}
          />
          Activa (puede iniciar sesión)
        </label>
      )}
      {error && (
        <p role="alert" className="mensaje mensaje--error">
          {error.message}
        </p>
      )}
      <div className="acciones">
        <button type="submit" aria-busy={guardando} disabled={guardando}>
          {modo === 'alta' ? 'Dar de alta' : 'Guardar cambios'}
        </button>
        {alCancelar && (
          <button type="button" className="secondary outline" onClick={alCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
