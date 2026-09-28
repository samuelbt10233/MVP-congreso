import { consulta, pedir } from './cliente';
import type {
  Actividad,
  AltaPersona,
  CodigoPermiso,
  DatosActividad,
  DatosPersona,
  LlegadaRegistrada,
  LlegadasDelDia,
  PaginaPersonas,
  Persona,
  PersonaRecepcion,
  AsistenciaPropia,
  AsistenciaRegistrada,
  Asistentes,
  Catalogos,
  Estadisticas,
  Perfil,
} from './tipos';

export const api = {
  auth: {
    iniciarSesion: (numero_documento: string, codigo: string) =>
      pedir<Perfil & { token: string }>('POST', '/auth/login', { numero_documento, codigo }),
    yo: () => pedir<Perfil>('GET', '/auth/yo'),
    salir: () => pedir<void>('POST', '/auth/salir'),
  },

  catalogos: () => pedir<Catalogos>('GET', '/catalogos'),

  actividades: {
    listar: (
      filtros: { dia?: string; zona_id?: number; tipo_id?: number; categoria_id?: number } = {},
    ) => pedir<Actividad[]>('GET', `/actividades${consulta(filtros)}`),
    asistentes: (id: number) => pedir<Asistentes>('GET', `/actividades/${id}/asistentes`),
    crear: (datos: DatosActividad) => pedir<Actividad>('POST', '/actividades', datos),
    editar: (id: number, datos: Partial<DatosActividad>) =>
      pedir<Actividad>('PATCH', `/actividades/${id}`, datos),
    cancelar: (id: number) => pedir<Actividad>('POST', `/actividades/${id}/cancelar`),
  },

  personas: {
    listar: (filtros: { q?: string; pagina?: number } = {}) =>
      pedir<PaginaPersonas>('GET', `/personas${consulta(filtros)}`),
    obtener: (id: number) => pedir<Persona>('GET', `/personas/${id}`),
    crear: (datos: DatosPersona) => pedir<AltaPersona>('POST', '/personas', datos),
    editar: (id: number, datos: Partial<DatosPersona>) =>
      pedir<Persona>('PATCH', `/personas/${id}`, datos),
    permisos: (id: number) =>
      pedir<{ permisos: CodigoPermiso[] }>('GET', `/personas/${id}/permisos`),
    guardarPermisos: (id: number, permisos: CodigoPermiso[]) =>
      pedir<{ permisos: CodigoPermiso[] }>('PUT', `/personas/${id}/permisos`, { permisos }),
    generarCodigo: (id: number) =>
      pedir<{ codigo_acceso: string }>('POST', `/personas/${id}/codigo`),
  },

  recepcion: {
    buscar: (documento: string) =>
      pedir<PersonaRecepcion>('GET', `/recepcion/buscar${consulta({ documento })}`),
    resumen: () => pedir<{ dia: string; llegadas: number }>('GET', '/recepcion/resumen'),
    registrarLlegada: (numero_documento: string) =>
      pedir<LlegadaRegistrada>('POST', '/registros/llegada', { numero_documento }),
  },

  llegadas: (dia?: string) =>
    pedir<LlegadasDelDia>('GET', `/registros/llegada${consulta({ dia })}`),

  asistencia: {
    registrar: (codigo: string) =>
      pedir<AsistenciaRegistrada>('POST', '/registros/asistencia', { codigo }),
    mias: () => pedir<AsistenciaPropia[]>('GET', '/registros/asistencia/mias'),
  },

  estadisticas: () => pedir<Estadisticas>('GET', '/estadisticas'),
};
