import type { BaseDatos } from '../../src/db/conexion.js';
import { PERMISOS, ROLES } from '../../src/modulos/permisos/catalogo.js';

const TIPOS_ACTIVIDAD = [
  { nombre: 'Conferencia magistral', descripcion: 'Charla principal ante todo el congreso' },
  { nombre: 'Ponencia', descripcion: 'Presentación de un trabajo ante una sala' },
  { nombre: 'Póster', descripcion: 'Exposición de trabajos en formato póster' },
  { nombre: 'Taller', descripcion: 'Sesión práctica con cupo limitado' },
  { nombre: 'Panel', descripcion: 'Conversación entre varios invitados' },
];

// Ejes temáticos de ejemplo, pendientes de definir por los organizadores (§8).
const CATEGORIAS = [
  { nombre: 'Ingeniería y tecnología', descripcion: 'Dato de ejemplo' },
  { nombre: 'Desarrollo humano', descripcion: 'Dato de ejemplo' },
  { nombre: 'Sostenibilidad global', descripcion: 'Dato de ejemplo' },
  { nombre: 'Innovación y emprendimiento', descripcion: 'Dato de ejemplo' },
];

/** Catálogos que el sistema necesita para funcionar, con o sin datos de demo. */
export function sembrarCatalogo(bd: BaseDatos): void {
  const insertarRol = bd.prepare('INSERT INTO rol (nombre, descripcion) VALUES (?, ?)');
  const insertarPermiso = bd.prepare(
    'INSERT INTO permiso (codigo, nombre, descripcion) VALUES (?, ?, ?)',
  );
  const insertarTipo = bd.prepare('INSERT INTO tipo_actividad (nombre, descripcion) VALUES (?, ?)');
  const insertarCategoria = bd.prepare('INSERT INTO categoria (nombre, descripcion) VALUES (?, ?)');

  bd.transaction(() => {
    for (const r of ROLES) insertarRol.run(r.nombre, r.descripcion);
    for (const p of PERMISOS) insertarPermiso.run(p.codigo, p.nombre, p.descripcion);
    for (const t of TIPOS_ACTIVIDAD) insertarTipo.run(t.nombre, t.descripcion);
    for (const c of CATEGORIAS) insertarCategoria.run(c.nombre, c.descripcion);
  })();
}
