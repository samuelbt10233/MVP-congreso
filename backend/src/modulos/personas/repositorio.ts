import type { BaseDatos } from '../../db/conexion.js';
import type { DatosAltaPersona, DatosEdicionPersona } from './esquemas.js';

export type FilaPersona = {
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
  rol_id: number;
  rol: string;
  activo: number;
  creado_en: string;
};

const SELECT_PERSONA = `
  SELECT p.id, p.tipo_documento, p.numero_documento, p.nombres, p.apellidos, p.correo,
         p.telefono, p.organizacion, p.nacionalidad, p.descripcion, p.rol_id,
         r.nombre AS rol, p.activo, p.creado_en
  FROM persona p
  JOIN rol r ON r.id = p.rol_id`;

// Búsqueda por nombre, apellido o documento. LOWER() en ambos lados para que la
// comparación no dependa de la sensibilidad a mayúsculas del motor (regla 14).
const FILTRO_BUSQUEDA = `
  WHERE (:q IS NULL
     OR LOWER(p.nombres || ' ' || p.apellidos) LIKE LOWER(:q)
     OR p.numero_documento LIKE :q)`;

export function contarPersonas(bd: BaseDatos, q: string | null): number {
  const { total } = bd
    .prepare(`SELECT COUNT(*) AS total FROM persona p ${FILTRO_BUSQUEDA}`)
    .get({ q }) as { total: number };
  return total;
}

export function listarPersonas(
  bd: BaseDatos,
  q: string | null,
  limite: number,
  desplazamiento: number,
): FilaPersona[] {
  return bd
    .prepare(
      `${SELECT_PERSONA} ${FILTRO_BUSQUEDA}
       ORDER BY p.apellidos, p.nombres, p.id
       LIMIT :limite OFFSET :desplazamiento`,
    )
    .all({ q, limite, desplazamiento }) as FilaPersona[];
}

export function buscarPersona(bd: BaseDatos, id: number): FilaPersona | undefined {
  return bd.prepare(`${SELECT_PERSONA} WHERE p.id = ?`).get(id) as FilaPersona | undefined;
}

export function existeDocumento(bd: BaseDatos, numeroDocumento: string, excluirId = -1): boolean {
  return (
    bd
      .prepare('SELECT 1 FROM persona WHERE numero_documento = ? AND id != ?')
      .get(numeroDocumento, excluirId) !== undefined
  );
}

export function nombreRol(bd: BaseDatos, rolId: number): string | undefined {
  const fila = bd.prepare('SELECT nombre FROM rol WHERE id = ?').get(rolId) as
    { nombre: string } | undefined;
  return fila?.nombre;
}

export function idRol(bd: BaseDatos, nombre: string): number | undefined {
  const fila = bd.prepare('SELECT id FROM rol WHERE nombre = ?').get(nombre) as
    { id: number } | undefined;
  return fila?.id;
}

export function insertarPersona(
  bd: BaseDatos,
  datos: DatosAltaPersona & { rol_id: number },
): number {
  const resultado = bd
    .prepare(
      `INSERT INTO persona (tipo_documento, numero_documento, nombres, apellidos, correo,
                            telefono, organizacion, nacionalidad, descripcion, rol_id)
       VALUES (@tipo_documento, @numero_documento, @nombres, @apellidos, @correo,
               @telefono, @organizacion, @nacionalidad, @descripcion, @rol_id)`,
    )
    .run({
      correo: null,
      telefono: null,
      organizacion: null,
      nacionalidad: null,
      descripcion: null,
      ...datos,
    });
  return Number(resultado.lastInsertRowid);
}

const COLUMNAS_EDITABLES = [
  'tipo_documento',
  'numero_documento',
  'nombres',
  'apellidos',
  'correo',
  'telefono',
  'organizacion',
  'nacionalidad',
  'descripcion',
  'rol_id',
  'activo',
] as const;

export function actualizarPersona(bd: BaseDatos, id: number, cambios: DatosEdicionPersona): void {
  const columnas = COLUMNAS_EDITABLES.filter((c) => cambios[c] !== undefined);
  if (columnas.length === 0) return;
  const valores = Object.fromEntries(
    columnas.map((c) => [c, typeof cambios[c] === 'boolean' ? Number(cambios[c]) : cambios[c]]),
  );
  bd.prepare(
    `UPDATE persona SET ${columnas.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`,
  ).run({ ...valores, id });
}

export function permisosDePersona(bd: BaseDatos, personaId: number): string[] {
  const filas = bd
    .prepare(
      `SELECT p.codigo FROM autorizacion a JOIN permiso p ON p.id = a.permiso_id
       WHERE a.persona_id = ? ORDER BY p.codigo`,
    )
    .all(personaId) as { codigo: string }[];
  return filas.map((f) => f.codigo);
}

export function otorgarPermisos(
  bd: BaseDatos,
  personaId: number,
  codigos: readonly string[],
  otorgadoPor: number,
): void {
  const insertar = bd.prepare(
    `INSERT INTO autorizacion (persona_id, permiso_id, otorgado_por)
     SELECT ?, id, ? FROM permiso WHERE codigo = ?
     ON CONFLICT (persona_id, permiso_id) DO NOTHING`,
  );
  for (const codigo of codigos) insertar.run(personaId, otorgadoPor, codigo);
}

export function revocarPermisosSalvo(
  bd: BaseDatos,
  personaId: number,
  conservar: readonly string[],
): void {
  const marcadores = conservar.map(() => '?').join(', ');
  bd.prepare(
    `DELETE FROM autorizacion
     WHERE persona_id = ?
       ${conservar.length ? `AND permiso_id NOT IN (SELECT id FROM permiso WHERE codigo IN (${marcadores}))` : ''}`,
  ).run(personaId, ...conservar);
}

export function tieneUsuario(bd: BaseDatos, personaId: number): boolean {
  return bd.prepare('SELECT 1 FROM usuario WHERE persona_id = ?').get(personaId) !== undefined;
}

/** Crea el usuario o reemplaza su código (§5, POST /personas/{id}/codigo). */
export function guardarCodigo(
  bd: BaseDatos,
  personaId: number,
  codigoHash: string,
  fechaHora: string,
): void {
  bd.prepare(
    `INSERT INTO usuario (persona_id, codigo_hash, codigo_rotado_en)
     VALUES (?, ?, ?)
     ON CONFLICT (persona_id) DO UPDATE
       SET codigo_hash = excluded.codigo_hash, codigo_rotado_en = excluded.codigo_rotado_en`,
  ).run(personaId, codigoHash, fechaHora);
}
