/**
 * Catálogo de permisos (§3.3) y plantillas de rol (§9.4).
 *
 * Es la fuente única: la semilla de catálogo inserta estos valores y el código
 * fuente se refiere a los permisos con el tipo `CodigoPermiso`.
 */

export const PERMISOS = [
  {
    codigo: 'persona.leer',
    nombre: 'Consultar personas',
    descripcion: 'Consultar el directorio completo de personas',
  },
  {
    codigo: 'persona.crear',
    nombre: 'Dar de alta personas',
    descripcion: 'Dar de alta una persona nueva',
  },
  {
    codigo: 'persona.editar',
    nombre: 'Editar personas',
    descripcion: 'Modificar los datos de una persona ya registrada',
  },
  {
    codigo: 'permiso.gestionar',
    nombre: 'Gestionar permisos',
    descripcion: 'Otorgar y revocar permisos a otras personas',
  },
  {
    codigo: 'usuario.gestionar',
    nombre: 'Gestionar códigos de acceso',
    descripcion: 'Generar o regenerar el código de acceso de una persona',
  },
  {
    codigo: 'actividad.gestionar',
    nombre: 'Gestionar actividades',
    descripcion: 'Crear, editar, reprogramar y cancelar actividades',
  },
  {
    codigo: 'llegada.registrar',
    nombre: 'Registrar llegadas',
    descripcion: 'Registrar la llegada de una persona al congreso',
  },
  {
    codigo: 'registro.leer',
    nombre: 'Consultar registros',
    descripcion: 'Consultar registros de llegada y asistencia de terceros',
  },
  {
    codigo: 'estadistica.leer',
    nombre: 'Ver estadísticas',
    descripcion: 'Ver estadísticas agregadas del congreso',
  },
] as const;

export type CodigoPermiso = (typeof PERMISOS)[number]['codigo'];

export const ROLES = [
  { nombre: 'administrador', descripcion: 'Administración del sistema' },
  { nombre: 'organizador', descripcion: 'Comité organizador del congreso' },
  { nombre: 'participante', descripcion: 'Ponente o expositor' },
  { nombre: 'visitante', descripcion: 'Asistente al congreso' },
] as const;

export type NombreRol = (typeof ROLES)[number]['nombre'];

/**
 * Permisos que recibe una persona al asignarle un rol. Después se ajustan por
 * persona. `usuario.gestionar` solo lo recibe el administrador mientras la regla
 * I11 esté pospuesta (regla 6 de CLAUDE.md).
 */
export const PLANTILLAS_ROL: Record<NombreRol, readonly CodigoPermiso[]> = {
  administrador: PERMISOS.map((p) => p.codigo),
  organizador: ['persona.leer', 'actividad.gestionar', 'registro.leer', 'estadistica.leer'],
  participante: [],
  visitante: [],
};

/** Recepción no es un rol: es un paquete que se otorga por persona (§9.4). */
export const PAQUETE_RECEPCION: readonly CodigoPermiso[] = ['llegada.registrar', 'persona.crear'];
