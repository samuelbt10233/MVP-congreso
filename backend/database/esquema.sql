PRAGMA foreign_keys = ON;

-- ---------- Catálogos ----------

CREATE TABLE rol (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE,
    descripcion  TEXT
);

CREATE TABLE permiso (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo       TEXT NOT NULL UNIQUE,     -- identificador usado en el código fuente
    nombre       TEXT NOT NULL,
    descripcion  TEXT
);

CREATE TABLE tipo_actividad (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE,     -- Ponencia, Póster, Taller, Panel
    descripcion  TEXT
);

CREATE TABLE categoria (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE,     -- eje temático del congreso
    descripcion  TEXT
);

-- ---------- Personas ----------

CREATE TABLE persona (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_documento    TEXT NOT NULL,       -- CC, CE, TI, PAS
    numero_documento  TEXT NOT NULL UNIQUE,
    nombres           TEXT NOT NULL,
    apellidos         TEXT NOT NULL,
    correo            TEXT,
    telefono          TEXT,
    organizacion      TEXT,                -- institución o empresa, texto libre
    nacionalidad      TEXT,
    rol_id            INTEGER NOT NULL REFERENCES rol(id),
    descripcion       TEXT,
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE autorizacion (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id    INTEGER NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    permiso_id    INTEGER NOT NULL REFERENCES permiso(id),
    otorgado_por  INTEGER REFERENCES persona(id),
    otorgado_en   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (persona_id, permiso_id)
);

-- ---------- Acceso ----------

CREATE TABLE usuario (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id        INTEGER NOT NULL UNIQUE REFERENCES persona(id) ON DELETE CASCADE,
    codigo_hash       TEXT NOT NULL,
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    ultimo_acceso     TEXT,
    codigo_rotado_en  TEXT,
    creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Zonas ----------

CREATE TABLE edificio (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE,     -- Bloque A, Bloque B
    descripcion  TEXT
);

CREATE TABLE zona (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    edificio_id  INTEGER NOT NULL REFERENCES edificio(id),
    nombre       TEXT NOT NULL,            -- Salón 202, Auditorio Central, Laboratorio 1
    piso         INTEGER,
    capacidad    INTEGER CHECK (capacidad IS NULL OR capacidad > 0),
    descripcion  TEXT,
    activa       INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0,1)),
    UNIQUE (edificio_id, nombre)
);

-- ---------- Actividades ----------

CREATE TABLE actividad (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo            TEXT NOT NULL UNIQUE,
    nombre            TEXT NOT NULL,
    descripcion       TEXT,
    tipo_actividad_id INTEGER NOT NULL REFERENCES tipo_actividad(id),
    categoria_id      INTEGER REFERENCES categoria(id),
    zona_id           INTEGER NOT NULL REFERENCES zona(id),
    responsable_id    INTEGER REFERENCES persona(id),
    inicio            TEXT NOT NULL,       -- UTC, 'YYYY-MM-DD HH:MM:SS'
    fin               TEXT NOT NULL,       -- UTC, 'YYYY-MM-DD HH:MM:SS'
    cancelada         INTEGER NOT NULL DEFAULT 0 CHECK (cancelada IN (0,1)),
    creada_en         TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (inicio < fin)
);

CREATE INDEX idx_actividad_zona_tiempo ON actividad(zona_id, inicio, fin);
CREATE INDEX idx_actividad_inicio ON actividad(inicio);

-- ---------- Registros ----------

CREATE TABLE registro_llegada (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id      INTEGER NOT NULL REFERENCES persona(id),
    registrado_por  INTEGER NOT NULL REFERENCES persona(id),
    fecha_hora      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Una llegada por persona y por día del congreso.
-- Las fechas se guardan en UTC; el modificador '-5 hours' convierte al día
-- local de Bogotá. Ver la nota sobre zona horaria en la sección 7.
CREATE UNIQUE INDEX idx_llegada_persona_dia
    ON registro_llegada(persona_id, date(fecha_hora, '-5 hours'));

CREATE TABLE registro_actividad (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id   INTEGER NOT NULL REFERENCES persona(id),
    actividad_id INTEGER NOT NULL REFERENCES actividad(id),
    fecha_hora   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (persona_id, actividad_id)
);

CREATE INDEX idx_registro_actividad_actividad ON registro_actividad(actividad_id);
