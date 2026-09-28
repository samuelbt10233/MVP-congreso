import type { CodigoPermiso } from '../api/tipos';

/**
 * Mapa de pantallas (§9.3). Es la única fuente para el menú y para los guards de
 * ruta: una pantalla sin `permisos` es de toda persona autenticada; con `permisos`,
 * basta con tener alguno.
 */
export type Pantalla = {
  id: string;
  ruta: string;
  titulo: string;
  permisos?: readonly CodigoPermiso[];
};

export const PANTALLAS = {
  inicio: { id: 'P1', ruta: '/', titulo: 'Inicio' },
  cronograma: { id: 'P2', ruta: '/cronograma', titulo: 'Cronograma' },
  perfil: { id: 'P3', ruta: '/perfil', titulo: 'Mi perfil' },
  asistencia: { id: 'P4', ruta: '/asistencia', titulo: 'Registrar asistencia' },
  misAsistencias: { id: 'P5', ruta: '/mis-asistencias', titulo: 'Mis asistencias' },
  personas: { id: 'P6', ruta: '/personas', titulo: 'Personas', permisos: ['persona.leer'] },
  actividades: {
    id: 'P9',
    ruta: '/gestion/actividades',
    titulo: 'Gestión de actividades',
    permisos: ['actividad.gestionar'],
  },
  recepcion: {
    id: 'P11',
    ruta: '/recepcion',
    titulo: 'Recepción',
    permisos: ['llegada.registrar'],
  },
  panel: {
    id: 'P12',
    ruta: '/panel',
    titulo: 'Panel',
    permisos: ['estadistica.leer', 'registro.leer'],
  },
} as const satisfies Record<string, Pantalla>;

export type ClavePantalla = keyof typeof PANTALLAS;

/** Orden del menú. */
export const ORDEN_MENU: readonly ClavePantalla[] = [
  'inicio',
  'cronograma',
  'asistencia',
  'misAsistencias',
  'perfil',
  'recepcion',
  'personas',
  'actividades',
  'panel',
];

export function puedeVer(pantalla: Pantalla, permisos: readonly string[]): boolean {
  return !pantalla.permisos || pantalla.permisos.some((p) => permisos.includes(p));
}

/** Pantallas del menú para un arreglo de permisos. */
export function pantallasVisibles(permisos: readonly string[]): Pantalla[] {
  return ORDEN_MENU.map((clave) => PANTALLAS[clave]).filter((p) => puedeVer(p, permisos));
}
