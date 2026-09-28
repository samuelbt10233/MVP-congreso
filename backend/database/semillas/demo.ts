/**
 * Datos de demostración (PLAN, incremento 2).
 *
 * El cronograma se genera alrededor de `ahora` para que la demo funcione a
 * cualquier hora (§4, I7): el primer día del congreso es el día en que se ejecuta
 * `npm run reset`, con actividades terminadas, en curso y próximas; el segundo es
 * el día siguiente. Los edificios, salones y personas son de ejemplo.
 *
 * Los códigos de acceso de las cuentas de demo viven en claro solo aquí y en
 * docs/demo.md; en la base se guardan con bcrypt (regla 1).
 */
import type { BaseDatos } from '../../src/db/conexion.js';
import {
  PAQUETE_RECEPCION,
  PLANTILLAS_ROL,
  type CodigoPermiso,
  type NombreRol,
} from '../../src/modulos/permisos/catalogo.js';
import {
  LONGITUD_CODIGO_ACCESO,
  esCodigoValido,
  generarCodigoActividad,
} from '../../src/utils/codigo.js';
import {
  aUtcSql,
  diaBogota,
  instanteBogota,
  sumarDias,
  sumarMinutos,
} from '../../src/utils/fechas.js';
import { hashCodigo } from '../../src/utils/hash.js';

// ---------- Cuentas de demo ----------

type Cuenta = {
  clave: 'administrador' | 'organizador' | 'participante' | 'visitante' | 'recepcion';
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  organizacion: string;
  rol: NombreRol;
  descripcion?: string;
  permisosExtra?: readonly CodigoPermiso[];
  codigo: string;
};

export const CUENTAS_DEMO: readonly Cuenta[] = [
  {
    clave: 'administrador',
    tipoDocumento: 'CC',
    numeroDocumento: '1010101010',
    nombres: 'Laura',
    apellidos: 'Gómez Rincón',
    correo: 'laura.gomez@ejemplo.edu.co',
    organizacion: 'ETITC',
    rol: 'administrador',
    codigo: 'ADMN2',
  },
  {
    clave: 'organizador',
    tipoDocumento: 'CC',
    numeroDocumento: '1020202020',
    nombres: 'Carlos Andrés',
    apellidos: 'Rodríguez Peña',
    correo: 'carlos.rodriguez@ejemplo.edu.co',
    organizacion: 'ETITC',
    rol: 'organizador',
    codigo: 'RGNZ3',
  },
  {
    clave: 'participante',
    tipoDocumento: 'CC',
    numeroDocumento: '1030303030',
    nombres: 'María Fernanda',
    apellidos: 'López Díaz',
    correo: 'maria.lopez@ejemplo.edu.co',
    organizacion: 'Universidad Nacional de Colombia',
    rol: 'participante',
    descripcion: 'Ponente',
    codigo: 'PART4',
  },
  {
    clave: 'visitante',
    tipoDocumento: 'CC',
    numeroDocumento: '1040404040',
    nombres: 'Andrés Felipe',
    apellidos: 'Castro Mora',
    correo: 'andres.castro@ejemplo.com',
    organizacion: 'Independiente',
    rol: 'visitante',
    codigo: 'VSTA5',
  },
  {
    clave: 'recepcion',
    tipoDocumento: 'CC',
    numeroDocumento: '1050505050',
    nombres: 'Valentina',
    apellidos: 'Ruiz Ortega',
    correo: 'valentina.ruiz@ejemplo.edu.co',
    organizacion: 'ETITC',
    rol: 'visitante',
    descripcion: 'Estudiante de apoyo, turno de entrada',
    permisosExtra: PAQUETE_RECEPCION,
    codigo: 'RECP6',
  },
];

// ---------- Personas sin cuenta (dan volumen a las estadísticas) ----------

const NOMBRES = [
  'Juan',
  'Camila',
  'Santiago',
  'Daniela',
  'Sebastián',
  'Natalia',
  'Mateo',
  'Sofía',
  'Nicolás',
  'Paula',
  'Alejandro',
  'Juliana',
  'Diego',
  'Isabella',
  'Felipe',
  'Mariana',
  'Tomás',
  'Laura Sofía',
  'Samuel',
  'Gabriela',
];
const APELLIDOS = [
  'García',
  'Martínez',
  'Hernández',
  'Rojas',
  'Torres',
  'Ramírez',
  'Vargas',
  'Moreno',
  'Jiménez',
  'Muñoz',
  'Suárez',
  'Parra',
  'Quintero',
  'Cárdenas',
  'Salazar',
  'Ospina',
];
const ORGANIZACIONES = [
  'ETITC',
  'Universidad Nacional de Colombia',
  'Universidad Distrital',
  'SENA',
  'Universidad de los Andes',
  'Pontificia Universidad Javeriana',
  'Ecopetrol',
  'Independiente',
];
const EXTRANJEROS = [
  { nacionalidad: 'México', organizacion: 'UNAM' },
  { nacionalidad: 'Perú', organizacion: 'Pontificia Universidad Católica del Perú' },
  { nacionalidad: 'España', organizacion: 'Universidad Politécnica de Madrid' },
];

const TOTAL_GENERADAS = 48;
const PONENTES_GENERADOS = 10;

// ---------- Inventario de ejemplo ----------

const EDIFICIOS = [
  {
    nombre: 'Bloque A',
    zonas: [
      { clave: 'aud', nombre: 'Auditorio Central', piso: 1, capacidad: 180 },
      { clave: 'a201', nombre: 'Salón A201', piso: 2, capacidad: 40 },
      { clave: 'a202', nombre: 'Salón A202', piso: 2, capacidad: 40 },
    ],
  },
  {
    nombre: 'Bloque B',
    zonas: [
      { clave: 'b101', nombre: 'Laboratorio B101', piso: 1, capacidad: 25 },
      { clave: 'b301', nombre: 'Salón B301', piso: 3, capacidad: 35 },
    ],
  },
  {
    nombre: 'Bloque C',
    zonas: [{ clave: 'hall', nombre: 'Hall de pósters', piso: 1, capacidad: 80 }],
  },
] as const;

type ClaveZona = (typeof EDIFICIOS)[number]['zonas'][number]['clave'];

// ---------- Cronograma ----------

type Tipo = 'Conferencia magistral' | 'Ponencia' | 'Póster' | 'Taller' | 'Panel';
type Categoria =
  | 'Ingeniería y tecnología'
  | 'Desarrollo humano'
  | 'Sostenibilidad global'
  | 'Innovación y emprendimiento';

/**
 * `responsable`: 'participante' es la cuenta de demo; un número es el índice de
 * un ponente generado.
 */
type PlanActividad = {
  nombre: string;
  tipo: Tipo;
  categoria: Categoria;
  zona: ClaveZona;
  responsable?: 'participante' | number;
  cancelada?: boolean;
} & (
  | { dia: 1; desdeMin: number; hastaMin: number } // minutos relativos a la media hora actual
  | { dia: 2; desde: string; hasta: string } // hora local de Bogotá
);

// Día 1, relativo a la media hora en curso. Ninguna zona se solapa (I1).
const CRONOGRAMA: readonly PlanActividad[] = [
  {
    dia: 1,
    desdeMin: -240,
    hastaMin: -180,
    zona: 'aud',
    tipo: 'Conferencia magistral',
    categoria: 'Sostenibilidad global',
    nombre: 'Conferencia inaugural: ingeniería para la sostenibilidad',
    responsable: 0,
  },
  {
    dia: 1,
    desdeMin: -180,
    hastaMin: -120,
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Gemelos digitales en la manufactura',
    responsable: 1,
  },
  {
    dia: 1,
    desdeMin: -180,
    hastaMin: -120,
    zona: 'a202',
    tipo: 'Ponencia',
    categoria: 'Sostenibilidad global',
    nombre: 'Economía circular en la construcción',
    responsable: 'participante',
  },
  {
    dia: 1,
    desdeMin: -150,
    hastaMin: -60,
    zona: 'b101',
    tipo: 'Taller',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Introducción al IoT con microcontroladores',
    responsable: 2,
  },
  {
    dia: 1,
    desdeMin: -120,
    hastaMin: -60,
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Desarrollo humano',
    nombre: 'Ética y bienestar en equipos de ingeniería',
    responsable: 3,
  },
  {
    dia: 1,
    desdeMin: -90,
    hastaMin: -30,
    zona: 'aud',
    tipo: 'Panel',
    categoria: 'Desarrollo humano',
    nombre: 'Mujeres en la ingeniería',
  },
  {
    dia: 1,
    desdeMin: -60,
    hastaMin: 60,
    zona: 'hall',
    tipo: 'Póster',
    categoria: 'Innovación y emprendimiento',
    nombre: 'Sesión de pósters I',
  },
  {
    dia: 1,
    desdeMin: -30,
    hastaMin: 30,
    zona: 'a202',
    tipo: 'Ponencia',
    categoria: 'Sostenibilidad global',
    nombre: 'Movilidad eléctrica en Bogotá',
    responsable: 'participante',
  },
  {
    dia: 1,
    desdeMin: 0,
    hastaMin: 60,
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Aprendizaje automático para la agricultura de precisión',
    responsable: 4,
  },
  {
    dia: 1,
    desdeMin: 0,
    hastaMin: 90,
    zona: 'aud',
    tipo: 'Conferencia magistral',
    categoria: 'Innovación y emprendimiento',
    nombre: 'Innovación social y emprendimiento de base tecnológica',
    responsable: 5,
  },
  {
    dia: 1,
    desdeMin: 60,
    hastaMin: 120,
    zona: 'a202',
    tipo: 'Ponencia',
    categoria: 'Sostenibilidad global',
    nombre: 'Gestión del agua en zonas urbanas',
    responsable: 6,
  },
  {
    dia: 1,
    desdeMin: 60,
    hastaMin: 150,
    zona: 'b101',
    tipo: 'Taller',
    categoria: 'Desarrollo humano',
    nombre: 'Diseño centrado en las personas',
  },
  {
    dia: 1,
    desdeMin: 90,
    hastaMin: 150,
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Blockchain para la trazabilidad de alimentos',
    responsable: 7,
    cancelada: true,
  },
  {
    dia: 1,
    desdeMin: 120,
    hastaMin: 180,
    zona: 'aud',
    tipo: 'Panel',
    categoria: 'Desarrollo humano',
    nombre: 'El futuro de la educación en ingeniería',
  },
  {
    dia: 1,
    desdeMin: 150,
    hastaMin: 210,
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Sostenibilidad global',
    nombre: 'Energía solar en comunidades rurales',
    responsable: 8,
  },
  {
    dia: 2,
    desde: '08:00',
    hasta: '09:00',
    zona: 'aud',
    tipo: 'Conferencia magistral',
    categoria: 'Sostenibilidad global',
    nombre: 'Transición energética en América Latina',
    responsable: 9,
  },
  {
    dia: 2,
    desde: '09:00',
    hasta: '10:00',
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Robótica colaborativa en la industria',
    responsable: 1,
  },
  {
    dia: 2,
    desde: '09:00',
    hasta: '10:00',
    zona: 'a202',
    tipo: 'Ponencia',
    categoria: 'Desarrollo humano',
    nombre: 'Salud mental en la vida universitaria',
    responsable: 3,
  },
  {
    dia: 2,
    desde: '09:00',
    hasta: '10:00',
    zona: 'b301',
    tipo: 'Ponencia',
    categoria: 'Sostenibilidad global',
    nombre: 'Materiales biodegradables para empaques',
    responsable: 'participante',
  },
  {
    dia: 2,
    desde: '09:00',
    hasta: '11:00',
    zona: 'hall',
    tipo: 'Póster',
    categoria: 'Innovación y emprendimiento',
    nombre: 'Sesión de pósters II',
  },
  {
    dia: 2,
    desde: '10:00',
    hasta: '12:00',
    zona: 'b101',
    tipo: 'Taller',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Análisis de datos con Python',
    responsable: 2,
  },
  {
    dia: 2,
    desde: '10:30',
    hasta: '11:30',
    zona: 'aud',
    tipo: 'Panel',
    categoria: 'Innovación y emprendimiento',
    nombre: 'Industria y academia: agenda común',
  },
  {
    dia: 2,
    desde: '14:00',
    hasta: '15:00',
    zona: 'a201',
    tipo: 'Ponencia',
    categoria: 'Ingeniería y tecnología',
    nombre: 'Ciudades inteligentes y datos abiertos',
    responsable: 4,
  },
  {
    dia: 2,
    desde: '14:00',
    hasta: '15:00',
    zona: 'a202',
    tipo: 'Ponencia',
    categoria: 'Desarrollo humano',
    nombre: 'Liderazgo y desarrollo humano en la ingeniería',
    responsable: 6,
  },
  {
    dia: 2,
    desde: '15:30',
    hasta: '16:30',
    zona: 'aud',
    tipo: 'Conferencia magistral',
    categoria: 'Sostenibilidad global',
    nombre: 'Conferencia de clausura',
    responsable: 0,
  },
];

// ---------- Resultado ----------

export type ResumenDemo = {
  cuentas: { clave: Cuenta['clave']; numeroDocumento: string; codigo: string; nombre: string }[];
  actividadesEnCurso: { nombre: string; zona: string; codigo: string }[];
  totales: { personas: number; actividades: number; llegadas: number; asistencias: number };
};

/** Generador pseudoaleatorio con semilla fija: la demo sale igual cada vez. */
function crearAleatorio(semilla: number): () => number {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Media hora en curso: 10:47 → 10:30. */
function mediaHoraActual(ahora: Date): Date {
  const base = new Date(ahora);
  base.setUTCSeconds(0, 0);
  base.setUTCMinutes(base.getUTCMinutes() < 30 ? 0 : 30);
  return base;
}

export async function sembrarDemo(bd: BaseDatos, ahora = new Date()): Promise<ResumenDemo> {
  const aleatorio = crearAleatorio(20261015);
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(aleatorio() * lista.length)]!;

  for (const c of CUENTAS_DEMO) {
    if (!esCodigoValido(c.codigo, LONGITUD_CODIGO_ACCESO)) {
      throw new Error(`Código de demo inválido para ${c.clave}`);
    }
  }
  // bcrypt es asíncrono; se calcula antes de abrir la transacción, que es síncrona.
  const hashes = await Promise.all(CUENTAS_DEMO.map((c) => hashCodigo(c.codigo)));

  const id = (sql: string, ...parametros: unknown[]): number => {
    const fila = bd.prepare(sql).get(...parametros) as { id: number } | undefined;
    if (!fila) throw new Error(`Catálogo incompleto: ${sql} ${parametros.join(', ')}`);
    return fila.id;
  };
  const idRol = (nombre: string) => id('SELECT id FROM rol WHERE nombre = ?', nombre);
  const idPermiso = (codigo: string) => id('SELECT id FROM permiso WHERE codigo = ?', codigo);
  const idTipo = (nombre: string) => id('SELECT id FROM tipo_actividad WHERE nombre = ?', nombre);
  const idCategoria = (nombre: string) => id('SELECT id FROM categoria WHERE nombre = ?', nombre);

  const insertarPersona = bd.prepare(`
    INSERT INTO persona (tipo_documento, numero_documento, nombres, apellidos, correo,
                         organizacion, nacionalidad, rol_id, descripcion)
    VALUES (@tipoDocumento, @numeroDocumento, @nombres, @apellidos, @correo,
            @organizacion, @nacionalidad, @rolId, @descripcion)`);
  const insertarAutorizacion = bd.prepare(
    'INSERT OR IGNORE INTO autorizacion (persona_id, permiso_id, otorgado_por) VALUES (?, ?, ?)',
  );
  const insertarUsuario = bd.prepare(
    'INSERT INTO usuario (persona_id, codigo_hash, codigo_rotado_en) VALUES (?, ?, ?)',
  );
  const insertarEdificio = bd.prepare('INSERT INTO edificio (nombre, descripcion) VALUES (?, ?)');
  const insertarZona = bd.prepare(`
    INSERT INTO zona (edificio_id, nombre, piso, capacidad, descripcion)
    VALUES (?, ?, ?, ?, 'Dato de ejemplo')`);
  const existeCodigoActividad = bd.prepare('SELECT 1 FROM actividad WHERE codigo = ?');
  const insertarActividad = bd.prepare(`
    INSERT INTO actividad (codigo, nombre, tipo_actividad_id, categoria_id, zona_id,
                           responsable_id, inicio, fin, cancelada)
    VALUES (@codigo, @nombre, @tipoId, @categoriaId, @zonaId, @responsableId, @inicio, @fin, @cancelada)`);
  const insertarLlegada = bd.prepare(
    'INSERT INTO registro_llegada (persona_id, registrado_por, fecha_hora) VALUES (?, ?, ?)',
  );
  const insertarAsistencia = bd.prepare(
    'INSERT INTO registro_actividad (persona_id, actividad_id, fecha_hora) VALUES (?, ?, ?)',
  );

  const resumen: ResumenDemo = {
    cuentas: [],
    actividadesEnCurso: [],
    totales: { personas: 0, actividades: 0, llegadas: 0, asistencias: 0 },
  };

  bd.transaction(() => {
    const creadoEn = aUtcSql(ahora);

    // Personas con cuenta. El administrador se crea primero y figura como quien otorga.
    const idCuenta = new Map<Cuenta['clave'], number>();
    CUENTAS_DEMO.forEach((c, i) => {
      const personaId = Number(
        insertarPersona.run({
          ...c,
          nacionalidad: 'Colombia',
          rolId: idRol(c.rol),
          descripcion: c.descripcion ?? null,
        }).lastInsertRowid,
      );
      idCuenta.set(c.clave, personaId);
      const otorgadoPor = idCuenta.get('administrador') ?? personaId;
      for (const p of [...PLANTILLAS_ROL[c.rol], ...(c.permisosExtra ?? [])]) {
        insertarAutorizacion.run(personaId, idPermiso(p), otorgadoPor);
      }
      insertarUsuario.run(personaId, hashes[i], creadoEn);
      resumen.cuentas.push({
        clave: c.clave,
        numeroDocumento: c.numeroDocumento,
        codigo: c.codigo,
        nombre: `${c.nombres} ${c.apellidos}`,
      });
    });
    const administradorId = idCuenta.get('administrador')!;
    const recepcionId = idCuenta.get('recepcion')!;

    // Personas sin cuenta: los primeros son ponentes, el resto visitantes.
    const generadas: number[] = [];
    for (let i = 0; i < TOTAL_GENERADAS; i++) {
      const extranjero = i % 12 === 5 ? elegir(EXTRANJEROS) : undefined;
      const nombres = elegir(NOMBRES);
      const apellidos = `${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
      generadas.push(
        Number(
          insertarPersona.run({
            tipoDocumento: extranjero ? 'PAS' : 'CC',
            numeroDocumento: extranjero ? `PA${700000 + i}` : String(1100000000 + i * 7919),
            nombres,
            apellidos,
            correo: null,
            organizacion: extranjero?.organizacion ?? elegir(ORGANIZACIONES),
            nacionalidad: extranjero?.nacionalidad ?? 'Colombia',
            rolId: idRol(i < PONENTES_GENERADOS ? 'participante' : 'visitante'),
            descripcion: i < PONENTES_GENERADOS ? 'Ponente' : null,
          }).lastInsertRowid,
        ),
      );
    }
    resumen.totales.personas = CUENTAS_DEMO.length + TOTAL_GENERADAS;

    // Edificios y zonas.
    const zonas = new Map<ClaveZona, { id: number; nombre: string; capacidad: number }>();
    for (const e of EDIFICIOS) {
      const edificioId = Number(
        insertarEdificio.run(e.nombre, 'Dato de ejemplo: reemplazar con el inventario real')
          .lastInsertRowid,
      );
      for (const z of e.zonas) {
        const zonaId = Number(
          insertarZona.run(edificioId, z.nombre, z.piso, z.capacidad).lastInsertRowid,
        );
        zonas.set(z.clave, { id: zonaId, nombre: z.nombre, capacidad: z.capacidad });
      }
    }

    // Llegadas del día 1: la mayoría de los asistentes, concentradas al comienzo de
    // la jornada (antes de la primera actividad) sin salir del día local. Las cuentas de visitante y participante de
    // demo quedan sin llegada para poder registrarla en vivo.
    const dia1 = diaBogota(ahora);
    const dia2 = sumarDias(dia1, 1);
    const desde = Math.max(sumarMinutos(ahora, -300).getTime(), instanteBogota(dia1).getTime());
    const hasta = Math.max(desde, sumarMinutos(ahora, -1).getTime());
    const llegan = [
      administradorId,
      idCuenta.get('organizador')!,
      recepcionId,
      ...generadas.filter(() => aleatorio() < 0.85),
    ];
    const horaLlegada = new Map<number, number>();
    llegan.forEach((personaId, i) => {
      const t = desde + (hasta - desde) * (i / llegan.length) ** 2;
      horaLlegada.set(personaId, t);
      insertarLlegada.run(
        personaId,
        personaId === recepcionId ? administradorId : recepcionId,
        aUtcSql(new Date(t)),
      );
    });
    resumen.totales.llegadas = llegan.length;

    // Actividades y asistencias.
    const base = mediaHoraActual(ahora);
    for (const plan of CRONOGRAMA) {
      const inicio =
        plan.dia === 1 ? sumarMinutos(base, plan.desdeMin) : instanteBogota(dia2, plan.desde);
      const fin =
        plan.dia === 1 ? sumarMinutos(base, plan.hastaMin) : instanteBogota(dia2, plan.hasta);
      const zona = zonas.get(plan.zona)!;
      const codigo = generarCodigoActividad((c) => existeCodigoActividad.get(c) !== undefined);
      const responsableId =
        plan.responsable === undefined
          ? null
          : plan.responsable === 'participante'
            ? idCuenta.get('participante')!
            : generadas[plan.responsable]!;

      const actividadId = Number(
        insertarActividad.run({
          codigo,
          nombre: plan.nombre,
          tipoId: idTipo(plan.tipo),
          categoriaId: idCategoria(plan.categoria),
          zonaId: zona.id,
          responsableId,
          inicio: aUtcSql(inicio),
          fin: aUtcSql(fin),
          cancelada: plan.cancelada ? 1 : 0,
        }).lastInsertRowid,
      );
      resumen.totales.actividades++;

      const enCurso = inicio <= ahora && ahora < fin;
      if (enCurso && !plan.cancelada) {
        resumen.actividadesEnCurso.push({ nombre: plan.nombre, zona: zona.nombre, codigo });
      }

      // Asistencia solo donde la ventana ya abrió (I7) y la actividad sigue en pie (I9),
      // marcada entre la apertura de la ventana y el primer cuarto de hora.
      const aperturaVentana = sumarMinutos(inicio, -15);
      if (plan.cancelada || aperturaVentana > ahora) continue;
      const limite = Math.min(fin.getTime(), ahora.getTime()) - 60_000;
      if (limite < aperturaVentana.getTime()) continue;
      const ocupacion = 0.35 + aleatorio() * 0.55;
      const cupo = Math.floor(zona.capacidad * ocupacion);
      const candidatos = generadas.filter(
        (p) => p !== responsableId && (horaLlegada.get(p) ?? Infinity) <= limite,
      );
      let marcados = 0;
      for (const personaId of candidatos) {
        if (marcados >= cupo) break;
        if (aleatorio() > ocupacion) continue;
        const t = Math.max(
          aperturaVentana.getTime() + Math.floor(aleatorio() * 30) * 60_000,
          horaLlegada.get(personaId)!,
        );
        insertarAsistencia.run(personaId, actividadId, aUtcSql(new Date(Math.min(t, limite))));
        marcados++;
      }
      resumen.totales.asistencias += marcados;
    }
  })();

  return resumen;
}
