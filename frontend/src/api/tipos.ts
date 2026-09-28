/** Tipos de las respuestas de la API (docs/diseno-mvp.md §5). */

export const CODIGOS_PERMISO = [
  'persona.leer',
  'persona.crear',
  'persona.editar',
  'permiso.gestionar',
  'usuario.gestionar',
  'actividad.gestionar',
  'llegada.registrar',
  'registro.leer',
  'estadistica.leer',
] as const;

export type CodigoPermiso = (typeof CODIGOS_PERMISO)[number];

export type PersonaSesion = {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  organizacion: string | null;
  nacionalidad: string | null;
  descripcion: string | null;
  rol: string;
};

export type Perfil = { persona: PersonaSesion; permisos: CodigoPermiso[] };

export type Referencia = { id: number; nombre: string };

export type Actividad = {
  id: number;
  /** Solo llega a quien tiene `actividad.gestionar`. */
  codigo?: string;
  nombre: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  cancelada: boolean;
  tipo: Referencia;
  categoria: Referencia | null;
  zona: {
    id: number;
    nombre: string;
    piso: number | null;
    capacidad: number | null;
    edificio: Referencia;
  };
  responsable: { id: number; nombres: string; apellidos: string } | null;
};

export type Catalogos = {
  roles: { id: number; nombre: string; descripcion: string | null }[];
  permisos: { id: number; codigo: CodigoPermiso; nombre: string; descripcion: string | null }[];
  tipos_actividad: { id: number; nombre: string; descripcion: string | null }[];
  categorias: { id: number; nombre: string; descripcion: string | null }[];
  edificios: {
    id: number;
    nombre: string;
    descripcion: string | null;
    zonas: {
      id: number;
      nombre: string;
      piso: number | null;
      capacidad: number | null;
      descripcion: string | null;
      activa: boolean;
    }[];
  }[];
};

export type AsistenciaRegistrada = {
  actividad: { id: number; nombre: string; zona: string };
  fecha_hora: string;
};

export type AsistenciaPropia = {
  fecha_hora: string;
  actividad: { id: number; nombre: string; inicio: string; fin: string; zona: string };
};

export type Asistentes = {
  actividad: Referencia;
  total: number;
  asistentes: {
    fecha_hora: string;
    persona: {
      id: number;
      nombres: string;
      apellidos: string;
      rol: string;
      organizacion: string | null;
    };
  }[];
};

export type Estadisticas = {
  generado_en: string;
  totales: {
    personas: number;
    llegadas: number;
    asistencias: number;
    actividades: number;
    actividades_canceladas: number;
  };
  llegadas_por_dia: { dia: string; total: number }[];
  actividades_en_curso: ActividadEstadistica[];
  por_actividad: ActividadEstadistica[];
};

export type ActividadEstadistica = {
  id: number;
  nombre: string;
  inicio: string;
  fin: string;
  cancelada: boolean;
  zona: string;
  capacidad: number | null;
  asistentes: number;
  ocupacion: number | null;
  en_curso: boolean;
};
