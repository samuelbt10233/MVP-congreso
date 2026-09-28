import { consulta, pedir } from './cliente';
import type {
  Actividad,
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
  },

  asistencia: {
    registrar: (codigo: string) =>
      pedir<AsistenciaRegistrada>('POST', '/registros/asistencia', { codigo }),
    mias: () => pedir<AsistenciaPropia[]>('GET', '/registros/asistencia/mias'),
  },

  estadisticas: () => pedir<Estadisticas>('GET', '/estadisticas'),
};
