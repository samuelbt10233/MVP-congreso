# Diseño de software — MVP

**Sistema de gestión logística del congreso**
Quinto Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global · ETITC · 15–16 oct. 2026

Documento de cierre de diseño. Su objetivo es que el desarrollo pueda comenzar sin decisiones pendientes.

> **Versión de demostración.** Este MVP se construye para mostrar al cliente la funcionalidad visible del sistema y recoger retroalimentación. Se conserva todo lo que el cliente ve o toca; se pospone la protección de credenciales frente a abuso, que no es observable con datos de prueba. Lo pospuesto está inventariado en `docs/deuda-mvp.md` y **es obligatorio antes de operar con datos reales**. La sección 10 resume qué cambió respecto al diseño completo.

---

## 1. Alcance del MVP

El MVP cubre el núcleo transaccional del sistema. Todo lo demás se construye después sobre estos datos.

**Incluido**

| Módulo | Alcance |
|---|---|
| Personas | Registro de toda persona asociada al congreso, con su rol y sus permisos |
| Zonas | Edificios y salones del campus, cargados por semilla y de solo lectura |
| Actividades | Ponencias, pósters y demás actividades programadas, con zona y horario |
| Llegada al congreso | Registro de ingreso al campus, ejecutado por un recepcionista |
| Ingreso a actividad | Registro de asistencia por autoservicio, con el código de la actividad |
| Roles y permisos | Control de qué puede hacer cada persona en el sistema |

**Explícitamente fuera del MVP**

Generación de la imagen de escarapela, envío de PDF por correo, mapa 3D y cálculo de rutas, panel de estadísticas avanzado, edición del inventario de zonas. La escarapela se considera una vista construida sobre los datos de `persona`, no una entidad propia.

---

## 2. Decisiones de diseño

Quedan registradas para que no se reabran durante el desarrollo.

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | El rol describe el estatus en el congreso; los permisos describen la capacidad en el sistema. Son ejes independientes | Un ponente puede tener permisos administrativos sin cambiar de rol |
| D2 | El registro de llegada **no** es prerrequisito para registrar asistencia a una actividad | Los dos registros son independientes; la llegada es conteo de aforo |
| D3 | La llegada la registra un tercero con permiso, pidiendo la identificación | `registro_llegada` guarda quién la registró |
| D4 | El ingreso a actividad es autoservicio con el código de la actividad | `actividad` necesita un código único; el registro no guarda operador |
| D5 | Existe una tabla `usuario` ligada a `persona`. El acceso se hace con el documento más un código alfanumérico de 5 caracteres | La credencial es rotable y separable de los datos personales |
| D6 | Jerarquía de zonas: `edificio` → `zona`. El piso se almacena aparte del nombre del salón | Permite consultar por piso sin interpretar cadenas |
| D7 | SQLite embebido en `backend/database/` para el MVP; PostgreSQL en Supabase después | Ciertas restricciones viven en la aplicación, no en el motor |
| D9 | El número de documento es único por sí solo, sin combinarse con el tipo | El login, la búsqueda de recepción y el registro de llegada reciben solo `numero_documento` sin ambigüedad |
| D10 | Las sesiones se guardan en memoria del servidor | Reiniciar el servidor cierra todas las sesiones. Aceptable en la demo; ver deuda |
| D11 | El esquema vive en un único `esquema.sql` y la base se recrea con `npm run reset` | Las migraciones numeradas empiezan al preparar la migración a PostgreSQL |

### D8 — Autenticación con código de acceso

La credencial no es el número de identificación sino un código alfanumérico de 5 caracteres (por ejemplo `A5D4S`) almacenado en la tabla `usuario`. El documento es un dato personal y no una llave de acceso, y un código comprometido se rota sin tocar el registro de la persona.

**El inicio de sesión exige documento y código, no el código solo.** La razón es aritmética. Con 32 caracteres posibles y 5 posiciones hay 33.554.432 combinaciones, unos 25 bits. Si el código bastara por sí mismo, cada intento se compararía contra *todos* los usuarios a la vez; exigiendo también el documento, cada intento se juega contra una sola persona.

Hay además una razón técnica. Si el acceso fuera solo por código, el sistema tendría que **buscar** por ese valor, lo que obliga a guardarlo en claro o con un hash determinista. Con documento más código, la búsqueda se hace por documento y el código se verifica con un hash lento (bcrypt), que es lo correcto para una credencial.

Reglas que acompañan la decisión en esta versión:

- Alfabeto de 32 caracteres, excluyendo `0`, `O`, `1` e `I`, que se confunden al dictarlos o leerlos.
- El código se guarda **hasheado con bcrypt**. No se puede consultar, solo regenerar. Quien lo pierde recibe uno nuevo.
- El código **no se imprime en la escarapela**. La escarapela es visible y fotografiable; la credencial se entrega por separado.

Pospuesto a la siguiente fase (ver `docs/deuda-mvp.md`): bloqueo tras intentos fallidos, códigos de 7 caracteres para cuentas administrativas, respuesta de tiempo constante en el login y la regla I11.

---

## 3. Modelo de datos

### 3.1 Cambios respecto al borrador

| Cambio | Motivo |
|---|---|
| `persona.numero_documento` con `UNIQUE` | El recepcionista busca a la persona por identificación y el login busca por documento (D9) |
| `persona.correo` | Llave del envío de escarapela en la siguiente fase |
| `persona.organizacion`, `persona.telefono`, `persona.nacionalidad` como texto | Sustituyen a las tablas de catálogo y relación, que no aportan nada visible en la demo |
| `actividad.codigo` con `UNIQUE` | Mecanismo del registro de asistencia por autoservicio |
| `zona.piso` como entero, separado del nombre | Permite filtrar por piso |
| Índice único en `registro_llegada` por persona y día | El congreso dura dos días: una llegada por persona por día |
| Índice único en `registro_actividad` por persona y actividad | Impide marcar dos veces la misma actividad |
| `tipo_actividad` y `categoria` documentadas por separado | `tipo` es la forma (ponencia, póster); `categoria` es la temática |

### 3.2 DDL (SQLite)

Doce tablas. Es el contenido de `backend/database/esquema.sql`.

```sql
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
```

### 3.3 Catálogo de permisos

| Código | Qué habilita |
|---|---|
| `persona.leer` | Consultar el directorio completo de personas |
| `persona.crear` | Dar de alta una persona nueva |
| `persona.editar` | Modificar los datos de una persona ya registrada |
| `permiso.gestionar` | Otorgar y revocar permisos a otras personas |
| `usuario.gestionar` | Generar o regenerar el código de acceso de una persona |
| `actividad.gestionar` | Crear, editar, reprogramar y cancelar actividades |
| `llegada.registrar` | Registrar la llegada de una persona al congreso |
| `registro.leer` | Consultar registros de llegada y asistencia de terceros |
| `estadistica.leer` | Ver estadísticas agregadas del congreso |

Registrar la asistencia propia y consultar la agenda y las zonas no requieren permiso: son capacidades de toda persona autenticada.

`persona.crear` y `persona.editar` van separados a propósito. Quien atiende la entrada necesita dar de alta a alguien que llegó sin registrar, pero no tiene por qué poder modificar los datos de las personas ya inscritas. Buscar a una persona por documento en la pantalla de recepción tampoco exige `persona.leer`: esa búsqueda está incluida en `llegada.registrar` y devuelve solo nombre, rol y estado de llegada, no el directorio completo.

`zona.gestionar` sale del catálogo en esta versión: el inventario se carga por semilla.

### 3.4 Roles del MVP

Los cuatro roles del MVP son **administrador**, **organizador**, **participante** (ponente o expositor) y **visitante**.

El rol no determina los permisos por sí solo: es una plantilla que se aplica al crear la persona y que después se ajusta individualmente. La correspondencia entre roles y paquetes de permisos está en la sección 9.4.

---

## 4. Invariantes y reglas de negocio

Donde SQLite no puede imponerlas, se aplican en la capa de servicio. La columna "Postgres" indica cómo se refuerza al migrar.

| # | Regla | MVP (SQLite) | Postgres |
|---|---|---|---|
| I1 | Dos actividades no pueden solaparse en la misma zona | Servicio: consulta de solapamiento dentro de una transacción antes de insertar o actualizar | `EXCLUDE USING gist` sobre `(zona_id, tstzrange(inicio, fin))` |
| I2 | `inicio` siempre anterior a `fin` | `CHECK` | `CHECK` |
| I3 | Una persona registra una sola vez cada actividad | `UNIQUE` | `UNIQUE` |
| I4 | Una llegada por persona y día del congreso | Índice único sobre `date(fecha_hora, '-5 hours')` | Índice único sobre `(persona_id, (fecha_hora AT TIME ZONE 'America/Bogota')::date)` |
| I5 | El código de actividad es único y no se reutiliza | `UNIQUE` | `UNIQUE` |
| I6 | El documento identifica de forma única a una persona | `UNIQUE (numero_documento)` | Igual |
| I7 | La asistencia solo se registra dentro de la ventana de la actividad | Servicio | Servicio |
| I8 | Quien registra una llegada debe tener `llegada.registrar` | Middleware de autorización | Igual |
| I9 | No se registra asistencia a una actividad cancelada | Servicio | Servicio |
| I10 | El código de acceso se guarda con bcrypt, nunca en claro | Servicio | Servicio |
| I12 | Quien no tiene `permiso.gestionar` solo puede dar de alta personas con rol visitante, y nacen sin permisos | Servicio: `403` si se pide otro rol | Servicio |
| I13 | Nadie puede quitarse a sí mismo `permiso.gestionar` | Servicio: `422` | Servicio |

I11 (no escalada al regenerar códigos) queda pospuesta. En su lugar, `usuario.gestionar` solo lo recibe el administrador por plantilla, y el paquete de recepción no lo incluye. Ver `docs/deuda-mvp.md`.

### Ventana de registro de asistencia (I7)

Desde 15 minutos antes de `inicio` hasta el momento de `fin`, ambos incluidos. Fuera de esa ventana el código se rechaza aunque sea correcto.

El margen es configurable con la variable de entorno `VENTANA_ASISTENCIA_ANTES_MIN` (por defecto `15`). **Confirmar el valor con el cliente** en la demo.

Para que la demo funcione a cualquier hora, la semilla genera el cronograma **alrededor de la hora actual**: el primer día del congreso es el día en que se ejecuta `npm run reset`, con actividades ya terminadas, otras en curso y otras próximas. Se recrea la base justo antes de presentar.

### Regla de alta con rol (I12)

Al crear una persona se le aplica la plantilla de permisos de su rol (§9.4). Sin restricción, quien tenga `persona.crear` podría crear a alguien con rol administrador y obtener así todos los permisos, porque el alta también devuelve el código de acceso. La regla: **si quien crea no tiene `permiso.gestionar`, el rol solicitado debe ser visitante**; en otro caso la operación responde `403`. El visitante no tiene permisos en su plantilla.

### Consulta de solapamiento (I1)

```sql
SELECT id, nombre, inicio, fin FROM actividad
WHERE zona_id = :zona_id
  AND cancelada = 0
  AND id != COALESCE(:actividad_id, -1)
  AND inicio < :fin
  AND fin > :inicio
LIMIT 1;
```

Debe ejecutarse dentro de la misma transacción que el `INSERT` o `UPDATE`. SQLite serializa las escrituras, de modo que la verificación es segura en el MVP; en Postgres la garantía la dará el constraint. Actividades contiguas (una termina justo cuando empieza la otra) se permiten.

---

## 5. API REST

Base: `/api/v1`. Todas las respuestas en JSON. Autenticación por token en `Authorization: Bearer`. Salvo `POST /auth/login` y `GET /salud`, **todas las rutas exigen sesión**; la columna "Permiso" indica lo que se exige además.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Recibe `numero_documento` y `codigo`. Devuelve token, persona y permisos |
| `GET` | `/auth/yo` | Datos de la persona autenticada y sus permisos |
| `POST` | `/auth/salir` | Invalida el token de la sesión |

La respuesta de error del login nunca distingue entre documento inexistente, persona o usuario inactivo y código incorrecto: en todos los casos devuelve `401` con el mismo cuerpo, para no confirmar qué documentos están registrados. El código se normaliza antes de verificarlo: mayúsculas, sin espacios ni guiones.

El token es un valor aleatorio de 32 bytes guardado en memoria del servidor, con vigencia de 12 horas.

### Personas y códigos de acceso

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/personas?q=&pagina=` | `persona.leer` |
| `POST` | `/personas` | `persona.crear` (y regla I12) |
| `GET` | `/personas/{id}` | `persona.leer` |
| `PATCH` | `/personas/{id}` | `persona.editar` |
| `GET` | `/personas/{id}/permisos` | `permiso.gestionar` |
| `PUT` | `/personas/{id}/permisos` | `permiso.gestionar` |
| `POST` | `/personas/{id}/codigo` | `usuario.gestionar` |

`POST /personas` crea la persona, le aplica la plantilla de su rol, crea su usuario y devuelve el código de acceso en claro **una sola vez**, en esa respuesta. `POST /personas/{id}/codigo` genera un código nuevo (y crea el usuario si no existía) con la misma regla. El código no vuelve a estar disponible en ninguna consulta posterior porque en la base solo queda su hash.

El documento se devuelve enmascarado (`****4567`) a quien no tenga `persona.editar`. Correo y teléfono solo se devuelven con `persona.editar`.

### Catálogos y zonas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/catalogos` | — |

Devuelve en una sola respuesta roles, permisos, tipos de actividad, categorías y edificios con sus zonas. Alimenta filtros y formularios.

### Actividades

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/actividades?dia=&zona_id=&tipo_id=&categoria_id=` | — |
| `POST` | `/actividades` | `actividad.gestionar` |
| `GET` | `/actividades/{id}` | — |
| `PATCH` | `/actividades/{id}` | `actividad.gestionar` |
| `POST` | `/actividades/{id}/cancelar` | `actividad.gestionar` |
| `GET` | `/actividades/{id}/asistentes` | `registro.leer`, o ser el responsable de la actividad |

El campo `codigo` solo se incluye en las respuestas para quien tenga `actividad.gestionar`; de lo contrario cualquiera podría marcar asistencia sin estar presente. `dia` es una fecha local de Bogotá (`YYYY-MM-DD`); el backend la convierte al rango UTC correspondiente.

### Registros

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/recepcion/buscar?documento=` | `llegada.registrar` |
| `POST` | `/registros/llegada` | `llegada.registrar` |
| `GET` | `/registros/llegada?dia=` | `registro.leer` |
| `POST` | `/registros/asistencia` | — |
| `GET` | `/registros/asistencia/mias` | — |

`POST /registros/llegada` recibe `numero_documento`. `POST /registros/asistencia` recibe `codigo` y toma la persona del token.

### Estadísticas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/estadisticas` | `estadistica.leer` |

Devuelve llegadas por día, total de asistencias, actividades en curso y, por actividad, asistentes y ocupación contra la capacidad de la zona.

### Códigos de respuesta

| Código | Uso |
|---|---|
| `200` | Consulta correcta |
| `201` | Registro creado |
| `400` | Cuerpo inválido o campos faltantes |
| `401` | Sin token, token vencido o credenciales incorrectas |
| `403` | Autenticado pero sin el permiso requerido |
| `404` | Recurso inexistente |
| `409` | Conflicto de estado: documento duplicado, asistencia o llegada ya registrada, solapamiento de horario |
| `422` | Regla de negocio incumplida: código inválido, fuera de ventana, actividad cancelada |

Códigos de error estables que el frontend puede interpretar:

| Estado | `codigo` |
|---|---|
| `400` | `CUERPO_INVALIDO` (cuerpo), `PARAMETRO_INVALIDO` (ruta o consulta). `detalle.campos` lista cada campo con su mensaje |
| `401` | `CREDENCIALES_INVALIDAS` (login), `NO_AUTENTICADO` (sin sesión o vencida) |
| `403` | `SIN_PERMISO` (`detalle.permiso`), `ALTA_ROL_NO_PERMITIDA` (I12) |
| `404` | `RUTA_NO_ENCONTRADA`, `PERSONA_NO_ENCONTRADA`, `ACTIVIDAD_NO_ENCONTRADA` |
| `409` | `DOCUMENTO_DUPLICADO`, `HORARIO_OCUPADO` (`detalle.actividad` es la que ocupa la zona), `ACTIVIDAD_YA_CANCELADA`, `LLEGADA_YA_REGISTRADA` y `ASISTENCIA_YA_REGISTRADA` (`detalle.fecha_hora` del registro previo) |
| `422` | `HORARIO_INVALIDO` (I2), `REFERENCIA_INVALIDA` (`detalle.campo`), `AUTOREVOCACION_NO_PERMITIDA` (I13), `CODIGO_ACTIVIDAD_INVALIDO`, `ACTIVIDAD_CANCELADA` (I9), `FUERA_DE_VENTANA` (I7, `detalle.abre` y `detalle.cierra`) |

Los instantes (`inicio`, `fin`) se reciben en ISO-8601 con zona horaria explícita (`2026-10-15T08:00:00-05:00`) o en UTC `YYYY-MM-DD HH:MM:SS`, y siempre se devuelven en UTC `YYYY-MM-DD HH:MM:SS`.

Cuerpo de error uniforme:

```json
{
  "error": {
    "codigo": "ASISTENCIA_YA_REGISTRADA",
    "mensaje": "Ya registraste tu asistencia a esta actividad.",
    "detalle": { "actividad_id": 42 }
  }
}
```

---

## 6. Flujos principales

### 6.1 Registro de llegada al congreso

1. El asistente llega al punto de entrada y entrega su identificación.
2. El recepcionista, autenticado y con `llegada.registrar`, busca por documento (`GET /recepcion/buscar`). Esa búsqueda devuelve solo nombre, rol y estado de llegada del día, no el directorio.
3. Si la persona no existe y el recepcionista tiene `persona.crear`, la da de alta como visitante (`POST /personas`, regla I12). La respuesta trae el código de acceso, que se muestra una sola vez para entregárselo.
4. Envía `POST /registros/llegada` con el documento.
5. El servicio verifica que no exista una llegada de esa persona ese mismo día. Si existe, responde `409` y muestra la hora del registro previo.
6. Responde `201` con los datos de la persona y su rol, para que el recepcionista entregue la escarapela correspondiente.

### 6.2 Registro de asistencia a una actividad

1. La persona inicia sesión con su número de documento y su código de acceso.
2. En el salón se exhibe el código de la actividad en curso.
3. Envía `POST /registros/asistencia` con el código.
4. El servicio resuelve el código a una actividad. Si no existe, `422`.
5. Verifica que la actividad no esté cancelada (`422`) y que el momento actual esté dentro de la ventana permitida (`422`).
6. Verifica que no haya registro previo de esa persona en esa actividad (`409`).
7. Inserta el registro y responde `201` con el nombre de la actividad y la hora.

### 6.3 Creación o reprogramación de una actividad

1. El organizador envía `POST /actividades` o `PATCH /actividades/{id}`.
2. Dentro de una transacción, el servicio ejecuta la consulta de solapamiento de I1.
3. Si hay conflicto, responde `409` indicando cuál actividad ocupa la zona en ese rango.
4. Si no, persiste y responde `201` o `200`.

Al crear una actividad, el sistema genera el `codigo`: cuatro caracteres alfanuméricos en mayúscula, excluyendo los ambiguos (`0`, `O`, `1`, `I`), verificando que no exista ya.

---

## 7. Notas de implementación

**Fechas y zona horaria.** SQLite no tiene tipo de fecha: se guarda texto. La decisión es **almacenar siempre en UTC**, con formato `YYYY-MM-DD HH:MM:SS`, y convertir a hora de Bogotá en la capa de presentación. La única conversión en el backend es la del filtro `dia`, que traduce un día local al rango UTC correspondiente.

Esto no es una preferencia de estilo, tiene una consecuencia concreta en I4. La función `date()` de SQLite interpreta el offset y devuelve la fecha en UTC: `date('2026-10-15T19:30:00-05:00')` devuelve `2026-10-16`. Si se guardaran las fechas con offset, una llegada registrada a las 7:30 p.m. del 15 contaría como día 16. Por eso el índice aplica `date(fecha_hora, '-5 hours')` sobre un valor en UTC. El mismo formato uniforme es lo que hace correctas las comparaciones de texto de `CHECK (inicio < fin)` y de la consulta de solapamiento.

Colombia no aplica horario de verano, así que el offset fijo de −5 es seguro. Al migrar a PostgreSQL se usa `timestamptz` y la conversión explícita a `America/Bogota`.

**Llaves foráneas.** `PRAGMA foreign_keys = ON` debe ejecutarse en cada conexión, no una sola vez. Si el cliente de base de datos usa un pool, configurarlo en el evento de apertura de conexión.

**Esquema.** En esta versión el esquema es un único `esquema.sql` y `npm run reset` recrea la base con las semillas (D11). Las migraciones numeradas se introducen al preparar la migración a PostgreSQL.

**Portabilidad.** Evitar en las consultas todo lo que sea específico de SQLite. Las dos excepciones conocidas ya están documentadas: el índice sobre `date(fecha_hora)` y la verificación de solapamiento en la aplicación. Ambas tienen su equivalente indicado en la sección 4.

---

## 8. Pendientes

| Pendiente | Responsable | Estado en la demo |
|---|---|---|
| Confirmar la ventana de registro de asistencia (I7) | Cliente | Se usa −15 min / fin, configurable |
| Definir cómo se entrega el código a cada persona antes del congreso (correo o desprendible en el registro) | Organizadores | En la demo se muestra en pantalla al dar de alta |
| Definir la lista inicial de roles y de categorías temáticas | Organizadores | Semilla con valores de ejemplo |
| Definir si el responsable de una actividad puede ser más de una persona | Equipo | Un solo responsable |
| Cargar el inventario real de edificios y zonas del campus | Organizadores | Semilla de ejemplo, marcada como tal |

Sobre el responsable: hoy `actividad.responsable_id` admite una sola persona. Los pósters suelen tener varios autores. Si eso es necesario, la solución es una tabla `actividad_responsable`; conviene decidirlo tras la demo, antes del desarrollo definitivo, porque cambia la API.

---

## 9. Diseño de frontend: paneles y visibilidad

### 9.1 Principio rector

**La interfaz se dibuja a partir de los permisos, nunca del nombre del rol.**

Los cuatro roles del MVP (administrador, organizador, participante, visitante) son **plantillas de asignación**: al crear una persona se le otorga el paquete de permisos correspondiente, y a partir de ahí los permisos se ajustan individualmente. Una persona con rol de participante puede recibir el permiso de registrar llegadas sin dejar de ser participante.

Esto prohíbe una construcción concreta en el código:

```ts
// Incorrecto: se rompe apenas alguien tenga una combinación distinta
if (usuario.rol === 'organizador') { mostrarGestionActividades(); }

// Correcto
if (puede('actividad.gestionar')) { mostrarGestionActividades(); }
```

El rol sirve para mostrar el estatus de la persona en la escarapela y en el directorio. No decide qué se ve.

### 9.2 Origen de la verdad

Al iniciar sesión, `GET /auth/yo` devuelve la persona y su arreglo de permisos. El frontend lo guarda en memoria de sesión y lo usa para construir la navegación y evaluar cada control.

```ts
type Sesion = {
  persona: { id: number; nombres: string; apellidos: string; rol: string };
  permisos: string[];   // ['actividad.gestionar', 'persona.leer', ...]
};

export function usePermisos() {
  const { permisos } = useSesion();
  return {
    puede:       (p: string) => permisos.includes(p),
    puedeAlguno: (...ps: string[]) => ps.some(p => permisos.includes(p)),
  };
}
```

El arreglo se refresca al volver a iniciar sesión. Si un administrador cambia permisos de una persona con sesión activa, los cambios aplican en su siguiente ingreso; el backend lee los permisos en cada petición, así que no hay riesgo de escalada.

### 9.3 Mapa de pantallas

**Disponibles para toda persona autenticada, sin permiso especial**

| # | Pantalla | Contenido |
|---|---|---|
| P1 | Inicio | Saludo, próxima actividad, accesos directos según permisos |
| P2 | Cronograma | Listado de actividades con filtros por día, zona, tipo y categoría; detalle de actividad |
| P3 | Mi perfil | Datos personales y vista de escarapela |
| P4 | Registrar asistencia | Campo para el código de la actividad |
| P5 | Mis asistencias | Historial propio de actividades registradas |

**Requieren permiso**

| # | Pantalla | Permiso | Absorbe del diseño completo |
|---|---|---|---|
| P6 | Directorio de personas | `persona.leer` | P7 alta, P7b edición y P8 permisos, como formulario lateral |
| P9 | Gestión de actividades | `actividad.gestionar` | — |
| P11 | Recepción | `llegada.registrar` | — |
| P12 | Panel | `estadistica.leer` o `registro.leer` | P13 estadísticas |

P10 (gestión de zonas) no existe en esta versión: las zonas se consultan en los filtros del cronograma y en el formulario de actividad.

### 9.4 Plantillas de rol

Paquete de permisos que se otorga al asignar cada rol. Después se ajusta por persona.

| Permiso | Administrador | Organizador | Participante | Visitante | Recepción¹ |
|---|:--:|:--:|:--:|:--:|:--:|
| `persona.leer` | ✓ | ✓ | | | |
| `persona.crear` | ✓ | | | | ✓ |
| `persona.editar` | ✓ | | | | |
| `permiso.gestionar` | ✓ | | | | |
| `usuario.gestionar` | ✓ | | | | |
| `actividad.gestionar` | ✓ | ✓ | | | |
| `llegada.registrar` | ✓ | | | | ✓ |
| `registro.leer` | ✓ | ✓ | | | |
| `estadistica.leer` | ✓ | ✓ | | | |

¹ **Recepción no es un rol**, es un paquete de dos permisos que se otorga individualmente a quien cubra la entrada, cualquiera que sea su rol. Un estudiante de apoyo con rol de visitante puede recibirlo para su turno y conservar su rol. Como el alta devuelve el código de acceso, recepción puede entregar credenciales a quien da de alta sin tener `usuario.gestionar`.

Notas sobre la tabla:

- **El participante ve los asistentes de sus propias actividades sin tener `registro.leer`.** No se resuelve con un permiso adicional sino con una regla en el endpoint: `GET /actividades/{id}/asistentes` autoriza también a quien figure como `responsable_id` de esa actividad.
- **Ningún permiso permite consultar un código de acceso.** En la base solo existe su hash.
- **`usuario.gestionar` se reserva al administrador** mientras I11 esté pospuesta. Otorgarlo a otra persona le permitiría regenerar el código de un administrador.

### 9.5 Pantallas resultantes por rol

| Pantalla | Administrador | Organizador | Participante | Visitante |
|---|:--:|:--:|:--:|:--:|
| P1 Inicio | ✓ | ✓ | ✓ | ✓ |
| P2 Cronograma | ✓ | ✓ | ✓ | ✓ |
| P3 Mi perfil | ✓ | ✓ | ✓ | ✓ |
| P4 Registrar asistencia | ✓ | ✓ | ✓ | ✓ |
| P5 Mis asistencias | ✓ | ✓ | ✓ | ✓ |
| P6 Directorio | ✓ | ✓ | | |
| P9 Gestión de actividades | ✓ | ✓ | | |
| P11 Recepción | ✓ | asignable | asignable | asignable |
| P12 Panel | ✓ | ✓ | | |

El participante ve los asistentes de sus actividades desde el detalle de la actividad en P2.

### 9.6 Visibilidad dentro de cada pantalla

**P2 Cronograma**

| Elemento | Condición |
|---|---|
| Listado, filtros, detalle de actividad, distintivo de cancelada | Toda persona autenticada |
| **Código de la actividad** | `actividad.gestionar` (el backend no lo envía en otro caso) |
| Botones Editar y Cancelar | `actividad.gestionar` |
| Botón Ver asistentes | `registro.leer` o ser responsable de esa actividad |

**P6 Directorio de personas**

| Elemento | Condición |
|---|---|
| Nombre, apellidos, rol, organización, documento enmascarado | `persona.leer` |
| Documento completo, correo y teléfono | `persona.editar` |
| Botón Nueva persona | `persona.crear` |
| Botón Editar | `persona.editar` |
| Casillas de permisos | `permiso.gestionar` |
| Botón Generar código de acceso | `usuario.gestionar` |

**P11 Recepción**

| Elemento | Condición |
|---|---|
| Búsqueda por documento, botón Registrar llegada, contador del día | `llegada.registrar` |
| Botón Dar de alta persona no registrada | `persona.crear` |
| Código recién generado, visible una sola vez | Quien acaba de dar de alta |

La pantalla de recepción muestra el código recién generado en un panel que se limpia al pasar a la siguiente persona. No queda en el historial de la vista ni se puede volver a consultar.

**P12 Panel**

| Elemento | Condición |
|---|---|
| Totales de llegada y asistencia, ocupación por actividad | `estadistica.leer` |
| Lista de llegadas del día | `registro.leer` |

### 9.7 Tratamiento del código de acceso en la interfaz

- **No se muestra nunca**, salvo en la respuesta a crear o regenerar, y se pinta una sola vez.
- **No se imprime en la escarapela.** Se entrega por separado.
- **No viaja en la URL** ni se persiste en el navegador.
- **El formulario de acceso no distingue errores.** Documento inexistente y código incorrecto producen el mismo mensaje.

La pantalla de acceso pide dos campos: documento y código. El campo del código acepta minúsculas y las convierte, ignora espacios y guiones y muestra el texto en mayúscula fija.

### 9.8 Configuración de visibilidad adoptada

**El visitante conserva las cinco pantallas base, incluida la de registrar asistencia.** Registrar la asistencia propia no es un permiso sino una consecuencia de estar autenticado. El visitante no ve el directorio, ni el panel, ni ninguna pantalla de gestión.

**El organizador no administra personas, pero sí las consulta.** Gestiona actividades, lee el directorio, ve registros y estadísticas. No puede editar personas ni otorgar permisos.

**Cada rol recibe lo mínimo que le permite cumplir su función, y lo que excede eso se otorga por persona.** Un organizador que además vaya a cubrir la entrada recibe `llegada.registrar` y `persona.crear` a título individual.

### 9.9 Tres niveles de control y una advertencia

| Nivel | Qué hace | Dónde |
|---|---|---|
| Navegación | El menú solo lista las pantallas alcanzables | Componente de menú, a partir de `permisos` |
| Ruta | Un guard bloquea el acceso directo por URL y muestra una pantalla de acceso denegado | Router |
| Elemento | Botones y columnas se ocultan individualmente | Componente `Puede` |

```tsx
export function Puede({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { puede } = usePermisos();
  return puede(permiso) ? <>{children}</> : null;
}
```

**Ocultar no es proteger.** La seguridad real está en el backend, que valida el permiso en cada petición sin importar lo que el frontend haya mostrado.

### 9.10 Pantalla de inicio adaptativa

| Bloque | Condición |
|---|---|
| Próxima actividad del cronograma | Siempre |
| Acceso rápido a registrar asistencia | Siempre |
| Mi escarapela | Siempre |
| Resumen de llegadas del día | `estadistica.leer` |
| Acceso rápido a recepción | `llegada.registrar` |
| Actividades que yo dirijo | Si la persona es responsable de alguna |
| Acceso rápido a gestión de actividades | `actividad.gestionar` |

---

## 10. Cambios respecto al diseño completo

| Área | Diseño completo | Versión de demostración |
|---|---|---|
| Tablas | 17 | 12: `nacionalidad`, `tipo_telefono`, `telefono`, `organizacion` y `persona_organizacion` pasan a columnas de texto en `persona` |
| Documento | Único con el tipo | Único por sí solo (D9) |
| Esquema | Migraciones numeradas | `esquema.sql` + `npm run reset` (D11) |
| Sesiones | Persistentes, invalidables al regenerar | En memoria, vigencia de 12 h (D10) |
| Login | Bloqueo tras 5 fallos, `429` | Sin bloqueo |
| Códigos | 7 caracteres para administradores | Todos de 5 |
| Regla I11 | En regenerar y desbloquear | Pospuesta; `usuario.gestionar` solo para administrador |
| Recepción | `llegada.registrar`, `persona.crear`, `usuario.gestionar` | Los dos primeros; el alta devuelve el código |
| Alta con rol | Sin regla | Regla I12 |
| Zonas | CRUD con `zona.gestionar` | Solo lectura por semilla; sin P10 |
| Pantallas | 14 | 9 |
| Estadísticas | Dos endpoints | `GET /estadisticas` |
| Endpoints de usuario | Crear, regenerar, desbloquear, `PATCH` | `POST /personas/{id}/codigo` |

El detalle de lo pospuesto y cuándo debe volver está en `docs/deuda-mvp.md`.
