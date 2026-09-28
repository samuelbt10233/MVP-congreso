import type { BaseDatos } from './db/conexion.js';
import type { AlmacenSesiones } from './modulos/auth/sesiones.js';

/** Dependencias compartidas por rutas y middleware; las pruebas inyectan las suyas. */
export type Contexto = {
  bd: BaseDatos;
  sesiones: AlmacenSesiones;
};
