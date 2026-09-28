# Diseño de software — MVP

**Sistema de gestión logística del congreso**
Quinto Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global · ETITC · 15–16 oct. 2026

Documento de cierre de diseño. Su objetivo es que el desarrollo pueda comenzar sin decisiones pendientes.

---

## 1. Alcance del MVP

El MVP cubre el núcleo transaccional del sistema. Todo lo demás se construye después sobre estos datos.

**Incluido**

| Módulo | Alcance |
|---|---|
| Personas | Registro de toda persona asociada al congreso, con su rol y sus permisos |
| Zonas | Edificios y salones del campus |
| Actividades | Ponencias, pósters y demás actividades programadas, con zona y horario |
| Llegada al congreso | Registro de ingreso al campus, ejecutado por un recepcionista |
| Ingreso a actividad | Registro de asistencia por autoservicio, con el código de la actividad |
| Roles y permisos | Control de qué puede hacer cada persona en el sistema |

**Explícitamente fuera del MVP**

Generación de la imagen de escarapela, envío de PDF por correo, mapa 3D y cálculo de rutas, panel de estadísticas avanzado. La escarapela se considera una vista construida sobre los datos de `persona`, no una entidad propia.

---

## 2. Decisiones de diseño

Quedan registradas para que no se reabran durante el desarrollo.

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | El rol describe el estatus en el congreso; los permisos describen la capacidad en el sistema. Son ejes independientes | Un ponente puede tener permisos administrativos sin cambiar de rol |
| D2 | El registro de llegada **no** es prerrequisito para registrar asistencia a una actividad | Los dos registros son independientes; la llegada es conteo de aforo |
| D3 | La llegada la registra un tercero con permiso, pidiendo la identificación | `registro_llegada` guarda quién la registró |
| D4 | El ingreso a actividad es autoservicio con el código de la actividad | `actividad` necesita un código único; el registro no guarda operador |
| D5 | Existe una tabla `usuario` ligada a `persona`. El acceso se hace con el documento más un código alfanumérico de 5 caracteres | La credencial es rotable y separable de los datos personales; una persona puede existir sin poder iniciar sesión |
| D6 | Jerarquía de zonas: `edificio` → `zona`. El piso se almacena aparte del nombre del salón | Permite consultar por piso sin interpretar cadenas |
| D7 | SQLite embebido en `database/` para el MVP; PostgreSQL en Supabase después | Ciertas restricciones viven en la aplicación, no en el motor |

### D8 — Autenticación con código de acceso

La credencial ya no es el número de identificación sino un código alfanumérico de 5 caracteres (por ejemplo `A5D4S`) almacenado en la tabla `usuario`. Esto resuelve el problema anterior: el documento vuelve a ser un dato personal y deja de ser una llave de acceso, y un código comprometido se rota sin tocar el registro de la persona.

**El inicio de sesión exige documento y código, no el código solo.** La razón es aritmética. Con 36 caracteres posibles y 5 posiciones hay 60.466.176 combinaciones, unos 25 bits. Si el código bastara por sí mismo, cada intento se compara contra *todos* los usuarios a la vez: con 2.000 personas registradas, un atacante que pruebe códigos al azar tiene cerca del 1 % de probabilidad de entrar a alguna cuenta en apenas 303 intentos, y prácticamente la certeza de lograrlo en unas decenas de miles. Exigiendo también el documento, cada intento se juega contra una sola persona y la probabilidad cae a 1 en 60.466.176.

Hay además una razón técnica. Si el acceso fuera solo por código, el sistema tendría que **buscar** por ese valor, lo que obliga a guardarlo en claro o con un hash determinista e indexable, y un hash rápido sobre 60 millones de combinaciones se rompe sin esfuerzo si la base se filtra. Con documento más código, la búsqueda se hace por documento y el código se verifica con un hash lento (bcrypt o argon2), que es lo correcto para una credencial.

Reglas que acompañan la decisión:

- Alfabeto de 32 caracteres, excluyendo `0`, `O`, `1` e `I`, que se confunden al dictarlos o leerlos de una escarapela.
- El código se guarda **hasheado**. No se puede consultar, solo regenerar. Quien lo pierde recibe uno nuevo.
- Bloqueo temporal tras cinco intentos fallidos sobre el mismo documento. Sin esto, la protección aritmética anterior se debilita.
- A quien tenga permisos administrativos se le genera un código de 7 caracteres. Es el mismo mecanismo con más margen donde el daño potencial es mayor.
- El código **no se imprime en la escarapela**. La escarapela es visible y fotografiable; la credencial se entrega por separado.

---

## 3. Modelo de datos

### 3.1 Cambios respecto al borrador

| Cambio | Motivo |
|---|---|
| `persona.numero_documento` con `UNIQUE` | El recepcionista busca a la persona por identificación; además es la credencial de acceso |
| `persona.correo` | Llave del envío de escarapela en la siguiente fase |
| `actividad.codigo` con `UNIQUE` | Mecanismo del registro de asistencia por autoservicio |
| `zona.piso` como entero, separado del nombre | Permite filtrar por piso |
| Índice único en `registro_llegada` por persona y día | El congreso dura dos días: una llegada por persona por día |
| Índice único en `registro_actividad` por persona y actividad | Impide marcar dos veces la misma actividad |
| `tipo_actividad` y `categoria` documentadas por separado | `tipo` es la forma (ponencia, póster); `categoria` es la temática |

### 3.2 DDL (SQLite)

```sql
PRAGMA foreign_keys = ON;

-- ---------- Catálogos ----------

CREATE TABLE rol (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE,
    descripcion  TEXT
);

CREATE TABLE nacionalidad (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE,
    codigo_iso   TEXT
);

CREATE TABLE tipo_telefono (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL UNIQUE
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

CREATE TABLE permiso (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo       TEXT NOT NULL UNIQUE,     -- identificador usado en el código fuente
    nombre       TEXT NOT NULL,
    descripcion  TEXT
);

CREATE TABLE organizacion (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL,
    descripcion  TEXT
);

-- ---------- Personas ----------

CREATE TABLE persona (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_documento    TEXT NOT NULL,
    numero_documento  TEXT NOT NULL,
    nombres           TEXT NOT NULL,
    apellidos         TEXT NOT NULL,
    fecha_nacimiento  TEXT,
    correo            TEXT,
    rol_id            INTEGER NOT NULL REFERENCES rol(id),
    nacionalidad_id   INTEGER REFERENCES nacionalidad(id),
    descripcion       TEXT,
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en         TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tipo_documento, numero_documento)
);

CREATE INDEX idx_persona_documento ON persona(numero_documento);

CREATE TABLE telefono (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id        INTEGER NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    tipo_telefono_id  INTEGER NOT NULL REFERENCES tipo_telefono(id),
    numero            TEXT NOT NULL
);

CREATE TABLE persona_organizacion (
    persona_id       INTEGER NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    organizacion_id  INTEGER NOT NULL REFERENCES organizacion(id),
    cargo            TEXT,
    PRIMARY KEY (persona_id, organizacion_id)
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

-- Una persona puede existir sin usuario: quien solo asiste y es registrado
-- en la entrada no necesita iniciar sesion.
CREATE TABLE usuario (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id         INTEGER NOT NULL UNIQUE REFERENCES persona(id) ON DELETE CASCADE,
    codigo_hash        TEXT NOT NULL,
    codigo_longitud    INTEGER NOT NULL DEFAULT 5 CHECK (codigo_longitud BETWEEN 5 AND 12),
    activo             INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    intentos_fallidos  INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta    TEXT,
    ultimo_acceso      TEXT,
    codigo_rotado_en   TEXT,
    creado_en          TEXT NOT NULL DEFAULT (datetime('now'))
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
    inicio            TEXT NOT NULL,       -- ISO-8601 con offset
    fin               TEXT NOT NULL,
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
| `usuario.gestionar` | Crear usuarios, regenerar códigos de acceso y desbloquear cuentas, con el límite de la regla I11 |
| `zona.gestionar` | Crear y editar edificios y zonas |
| `actividad.gestionar` | Crear, editar, reprogramar y cancelar actividades |
| `llegada.registrar` | Registrar la llegada de una persona al congreso |
| `registro.leer` | Consultar registros de llegada y asistencia de terceros |
| `estadistica.leer` | Ver estadísticas agregadas del congreso |

Registrar la asistencia propia y consultar la agenda no requieren permiso: son capacidades de toda persona registrada.

`persona.crear` y `persona.editar` van separados a propósito. Quien atiende la entrada necesita dar de alta a alguien que llegó sin registrar, pero no tiene por qué poder modificar los datos de las personas ya inscritas. Buscar a una persona por documento en la pantalla de recepción tampoco exige `persona.leer`: esa búsqueda está incluida en `llegada.registrar` y devuelve solo nombre, rol y estado de llegada, no el directorio completo.

### 3.4 Roles del MVP

Los cuatro roles del MVP son **administrador**, **organizador**, **participante** (ponente o expositor) y **visitante**.

El rol no determina los permisos por sí solo: es una plantilla que se aplica al crear la persona y que después se ajusta individualmente. La correspondencia entre roles y paquetes de permisos está en la sección 9.4, junto al diseño de las pantallas que habilita cada uno.

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
| I6 | El documento identifica de forma única a una persona | `UNIQUE (tipo_documento, numero_documento)` | Igual |
| I7 | La asistencia solo se registra dentro de la ventana de la actividad | Servicio | Servicio |
| I8 | Quien registra una llegada debe tener `llegada.registrar` | Middleware de autorización | Igual |
| I9 | No se registra asistencia a una actividad cancelada | Servicio | Servicio |
| I10 | El código de acceso se guarda con hash lento (bcrypt o argon2), nunca en claro | Servicio | Servicio |
| I11 | Nadie puede regenerar el código de acceso de una persona que tenga permisos que quien lo solicita no posee | Servicio | Servicio |

### Ventana de registro de asistencia (I7)

Propuesta: desde 15 minutos antes de `inicio` hasta el momento de `fin`. Fuera de esa ventana el código se rechaza aunque sea correcto.

El margen debe ser configurable, no una constante en el código. **Confirmar con el cliente** antes de implementar: si se permite marcar después de terminada la actividad, el dato de asistencia pierde valor; si la ventana es muy estrecha, se generan reclamos.

### Regla de no escalada (I11)

Es la regla menos evidente del documento y la más fácil de omitir al implementar.

Quien tiene `usuario.gestionar` puede regenerar códigos de acceso, y el código regenerado se le muestra en pantalla. Sin restricción, la persona de recepción podría regenerar el código de un administrador, leerlo e iniciar sesión con permisos totales. Es una escalada completa de privilegios a través de una función pensada para ayudar a quien perdió su código.

La regla: **una regeneración solo procede si quien la solicita posee todos los permisos que tiene la persona objetivo.** Recepción puede regenerar el código de cualquier visitante o participante, porque no tienen permisos que ella no tenga. No puede hacerlo sobre un organizador ni sobre un administrador; eso lo resuelve un administrador.

```sql
-- Permisos del objetivo que el solicitante no posee.
-- Si devuelve alguna fila, la regeneración se rechaza con 403.
SELECT p.codigo
FROM autorizacion a
JOIN permiso p ON p.id = a.permiso_id
WHERE a.persona_id = :objetivo_id
  AND a.permiso_id NOT IN (
      SELECT permiso_id FROM autorizacion WHERE persona_id = :solicitante_id
  );
```

La misma comprobación aplica a desbloquear una cuenta, por la misma razón.

### Consulta de solapamiento (I1)

```sql
SELECT 1 FROM actividad
WHERE zona_id = :zona_id
  AND cancelada = 0
  AND id != COALESCE(:actividad_id, -1)
  AND inicio < :fin
  AND fin > :inicio
LIMIT 1;
```

Debe ejecutarse dentro de la misma transacción que el `INSERT` o `UPDATE`. SQLite serializa las escrituras, de modo que la verificación es segura en el MVP; en Postgres la garantía la dará el constraint.

---

## 5. API REST

Base: `/api/v1`. Todas las respuestas en JSON. Autenticación por token en `Authorization: Bearer`.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Recibe `numero_documento` y `codigo`. Devuelve token, persona y permisos |
| `GET` | `/auth/yo` | Datos de la persona autenticada y sus permisos |
| `POST` | `/auth/salir` | Invalida el token de la sesión |

Tras cinco intentos fallidos sobre el mismo documento, `POST /auth/login` responde `429` y fija `bloqueado_hasta`. La respuesta de error nunca distingue entre documento inexistente y código incorrecto: en ambos casos devuelve `401` con el mismo mensaje, para no confirmar qué documentos están registrados.

### Usuarios

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/personas/{id}/usuario` | `usuario.gestionar` |
| `POST` | `/personas/{id}/usuario/regenerar` | `usuario.gestionar` |
| `POST` | `/personas/{id}/usuario/desbloquear` | `usuario.gestionar` |
| `PATCH` | `/personas/{id}/usuario` | `usuario.gestionar` |

Crear o regenerar devuelve el código en claro **una sola vez**, en esa respuesta. No vuelve a estar disponible en ninguna consulta posterior porque en la base solo queda su hash.

`regenerar` y `desbloquear` aplican además la regla I11: si la persona objetivo tiene algún permiso que el solicitante no posee, la operación responde `403`. Esto evita que quien atiende la entrada obtenga permisos de administrador regenerando el código de uno.

### Personas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/personas` | `persona.leer` |
| `POST` | `/personas` | `persona.crear` |
| `GET` | `/personas/{id}` | `persona.leer` |
| `PATCH` | `/personas/{id}` | `persona.editar` |
| `GET` | `/personas/{id}/permisos` | `permiso.gestionar` |
| `PUT` | `/personas/{id}/permisos` | `permiso.gestionar` |
| `GET` | `/personas/buscar?documento=` | `persona.leer` |

### Zonas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/edificios` | — |
| `POST` | `/edificios` | `zona.gestionar` |
| `GET` | `/edificios/{id}/zonas` | — |
| `GET` | `/zonas` | — |
| `POST` | `/zonas` | `zona.gestionar` |
| `PATCH` | `/zonas/{id}` | `zona.gestionar` |

### Actividades

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/actividades?dia=&zona_id=&tipo_id=&categoria_id=` | — |
| `POST` | `/actividades` | `actividad.gestionar` |
| `GET` | `/actividades/{id}` | — |
| `PATCH` | `/actividades/{id}` | `actividad.gestionar` |
| `POST` | `/actividades/{id}/cancelar` | `actividad.gestionar` |
| `GET` | `/actividades/{id}/asistentes` | `registro.leer` |

El campo `codigo` no se expone en `GET /actividades` para el público general: solo se incluye para quien tenga `actividad.gestionar`, de lo contrario cualquiera podría marcar asistencia sin estar presente.

### Registros

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/recepcion/buscar?documento=` | `llegada.registrar` |
| `POST` | `/registros/llegada` | `llegada.registrar` |
| `GET` | `/registros/llegada?dia=` | `registro.leer` |
| `POST` | `/registros/asistencia` | — (persona autenticada) |
| `GET` | `/registros/asistencia/mias` | — |

`POST /registros/llegada` recibe `numero_documento`. `POST /registros/asistencia` recibe `codigo` y toma la persona del token.

### Estadísticas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/estadisticas/resumen` | `estadistica.leer` |
| `GET` | `/estadisticas/asistencia-por-actividad` | `estadistica.leer` |

### Códigos de respuesta

| Código | Uso |
|---|---|
| `200` | Consulta correcta |
| `201` | Registro creado |
| `400` | Cuerpo inválido o campos faltantes |
| `401` | Sin token o token vencido |
| `403` | Autenticado pero sin el permiso requerido |
| `404` | Recurso inexistente |
| `409` | Conflicto de estado: documento duplicado, asistencia ya registrada, solapamiento de horario |
| `422` | Regla de negocio incumplida: código inválido, fuera de ventana, actividad cancelada |

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
2. El recepcionista, autenticado y con `llegada.registrar`, busca por documento (`GET /recepcion/buscar`). Esa búsqueda devuelve solo nombre, rol y estado de llegada, no el directorio.
3. Si la persona no existe, la da de alta con `persona.crear`. La persona queda con rol de visitante y sin permisos; asignar cualquier permiso exige `permiso.gestionar`, que recepción no tiene.
4. Envía `POST /registros/llegada` con el documento.
5. El servicio verifica que no exista una llegada de esa persona ese mismo día. Si existe, responde `409` y muestra la hora del registro previo.
6. Responde `201` con los datos de la persona y su rol, para que el recepcionista entregue la escarapela correspondiente.

### 6.2 Registro de asistencia a una actividad

1. La persona inicia sesión con su número de identificación.
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

Al crear una actividad, el sistema genera el `codigo`. Sugerencia: cuatro caracteres alfanuméricos en mayúscula, excluyendo los ambiguos (`0`, `O`, `1`, `I`), verificando que no exista ya.

---

## 7. Notas de implementación

**Fechas y zona horaria.** SQLite no tiene tipo de fecha: se guarda texto ISO-8601. La decisión es **almacenar siempre en UTC**, con formato `YYYY-MM-DD HH:MM:SS`, y convertir a hora de Bogotá en la capa de presentación.

Esto no es una preferencia de estilo, tiene una consecuencia concreta en I4. La función `date()` de SQLite interpreta el offset y devuelve la fecha en UTC: `date('2026-10-15T19:30:00-05:00')` devuelve `2026-10-16`. Si se guardaran las fechas con offset, una llegada registrada a las 7:30 p.m. del 15 contaría como día 16, y la persona podría registrar llegada dos veces el mismo día real. Por eso el índice aplica `date(fecha_hora, '-5 hours')` sobre un valor en UTC.

Colombia no aplica horario de verano, así que el offset fijo de −5 es seguro. Al migrar a PostgreSQL se usa `timestamptz` y la conversión explícita a `America/Bogota`, que es más robusta.

**Llaves foráneas.** `PRAGMA foreign_keys = ON` debe ejecutarse en cada conexión, no una sola vez. Si el cliente de base de datos usa un pool, configurarlo en el evento de apertura de conexión.

**Migraciones.** Escribirlas como archivos SQL numerados desde el inicio, aunque en el MVP se apliquen a mano. Es lo que permitirá reconstruir el esquema en PostgreSQL sin reescribirlo.

**Portabilidad.** Evitar en las consultas todo lo que sea específico de SQLite. Las dos excepciones conocidas ya están documentadas: el índice sobre `date(fecha_hora)` y la verificación de solapamiento en la aplicación. Ambas tienen su equivalente indicado en la sección 4.

---

## 8. Pendientes antes de desarrollar

| Pendiente | Responsable |
|---|---|
| Confirmar la ventana de registro de asistencia (I7) | Cliente |
| Definir la longitud del código para cuentas administrativas (D8 propone 7) | Equipo |
| Asignar el paquete de recepción (`llegada.registrar`, `persona.crear`, `usuario.gestionar`) a quien cubra cada turno de entrada | Organizadores |
| Definir cómo se entrega el código a cada persona antes del congreso (correo o desprendible en el registro) | Organizadores |
| Definir la lista inicial de roles y de categorías temáticas | Organizadores |
| Definir si el responsable de una actividad puede ser más de una persona | Equipo |
| Cargar el inventario real de edificios y zonas del campus | Organizadores |

La cuarta merece atención: hoy `actividad.responsable_id` admite una sola persona. Los pósters suelen tener varios autores. Si eso es necesario, la solución es una tabla `actividad_responsable`, y conviene decidirlo antes de escribir código porque cambia la API.

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
    puede:      (p: string) => permisos.includes(p),
    puedeAlguno: (...ps: string[]) => ps.some(p => permisos.includes(p)),
  };
}
```

El arreglo se refresca al volver a iniciar sesión. Si un administrador cambia permisos de una persona con sesión activa, los cambios aplican en su siguiente ingreso; el backend ya rechaza lo que no corresponda, así que no hay riesgo de escalada.

Al regenerar el código de una persona, su sesión activa debe invalidarse. De lo contrario, regenerar el código tras un extravío no expulsa a quien lo hubiera encontrado.

### 9.3 Mapa de pantallas

**Disponibles para toda persona autenticada, sin permiso especial**

| # | Pantalla | Contenido |
|---|---|---|
| P1 | Inicio | Saludo, próxima actividad, accesos directos según permisos |
| P2 | Cronograma | Listado de actividades con filtros por día, zona, tipo y categoría |
| P3 | Mi perfil | Datos personales y vista de escarapela |
| P4 | Registrar asistencia | Campo para el código de la actividad |
| P5 | Mis asistencias | Historial propio de actividades registradas |

**Requieren permiso**

| # | Pantalla | Permiso |
|---|---|---|
| P6 | Directorio de personas | `persona.leer` |
| P7 | Alta de persona | `persona.crear` |
| P7b | Edición de persona | `persona.editar` |
| P8 | Permisos de una persona | `permiso.gestionar` |
| P9 | Gestión de actividades | `actividad.gestionar` |
| P10 | Gestión de zonas y edificios | `zona.gestionar` |
| P11 | Recepción: registrar llegada | `llegada.registrar` |
| P12 | Registros de llegada y asistencia | `registro.leer` |
| P13 | Estadísticas | `estadistica.leer` |

### 9.4 Plantillas de rol

Paquete de permisos que se otorga al asignar cada rol. Después se ajusta por persona.

| Permiso | Administrador | Organizador | Participante | Visitante | Recepción¹ |
|---|:--:|:--:|:--:|:--:|:--:|
| `persona.leer` | ✓ | ✓ | | | |
| `persona.crear` | ✓ | | | | ✓ |
| `persona.editar` | ✓ | | | | |
| `permiso.gestionar` | ✓ | | | | |
| `zona.gestionar` | ✓ | | | | |
| `actividad.gestionar` | ✓ | ✓ | | | |
| `llegada.registrar` | ✓ | | | | ✓ |
| `usuario.gestionar` | ✓ | | | | ✓² |
| `registro.leer` | ✓ | ✓ | | | |
| `estadistica.leer` | ✓ | ✓ | | | |

¹ **Recepción no es un rol**, es un paquete de tres permisos que se otorga individualmente a quien cubra la entrada, cualquiera que sea su rol. Un estudiante de apoyo con rol de visitante puede recibirlo para su turno y conservar su rol.

² Limitado por la regla I11: recepción puede regenerar el código de visitantes y participantes, no el de organizadores ni administradores.

Notas sobre la tabla:

- **`llegada.registrar` y `usuario.gestionar` se asignan por persona, no por rol.** Quien atiende la entrada puede ser cualquiera: un estudiante de apoyo con rol de visitante, un organizador o un administrador. Van juntos porque en la entrada se hacen las dos cosas: registrar la llegada y entregar o regenerar el código de acceso de quien lo perdió. Es el caso que mejor ilustra por qué los roles son plantillas y no compartimentos.
- **El organizador no administra zonas.** El inventario de edificios y salones es estable y se carga una sola vez antes del congreso; el organizador elige entre las zonas existentes al programar una actividad. Si durante el montaje hiciera falta habilitar un espacio nuevo, lo hace un administrador. Es una línea de configuración revertirlo si en la práctica estorba.
- **El participante ve los asistentes de sus propias actividades sin tener `registro.leer`.** No se resuelve con un permiso adicional sino con una regla en el endpoint: `GET /actividades/{id}/asistentes` autoriza también a quien figure como `responsable_id` de esa actividad.
- **Ningún permiso permite consultar un código de acceso.** `persona.editar` da acceso a los datos personales; el código no es uno de ellos, porque en la base solo existe su hash.

### 9.5 Pantallas resultantes por rol

| Pantalla | Administrador | Organizador | Participante | Visitante |
|---|:--:|:--:|:--:|:--:|
| P1 Inicio | ✓ | ✓ | ✓ | ✓ |
| P2 Cronograma | ✓ | ✓ | ✓ | ✓ |
| P3 Mi perfil | ✓ | ✓ | ✓ | ✓ |
| P4 Registrar asistencia | ✓ | ✓ | ✓ | ✓ |
| P5 Mis asistencias | ✓ | ✓ | ✓ | ✓ |
| P6 Directorio | ✓ | ✓ | | |
| P7 Alta de persona | ✓ | | | |
| P7b Edición de persona | ✓ | | | |
| P8 Permisos | ✓ | | | |
| P9 Gestión de actividades | ✓ | ✓ | | |
| P10 Gestión de zonas | ✓ | | | |
| P11 Recepción | ✓ | asignable | asignable | asignable |
| P12 Registros | ✓ | ✓ | propias | |
| P13 Estadísticas | ✓ | ✓ | | |

El visitante conserva las cinco pantallas base, incluida la de registrar asistencia. El razonamiento está en la sección 9.8.

### 9.6 Visibilidad dentro de cada pantalla

Ocultar una pantalla completa no alcanza: dentro de una misma vista hay elementos que solo algunos deben ver.

**P2 Cronograma**

| Elemento | Condición |
|---|---|
| Listado, filtros, detalle de actividad | Toda persona autenticada |
| **Código de la actividad** | `actividad.gestionar` |
| Botones Editar y Cancelar | `actividad.gestionar` |
| Botón Ver asistentes | `registro.leer` o ser responsable de esa actividad |
| Distintivo de actividad cancelada | Toda persona autenticada |

**P6 Directorio de personas**

| Elemento | Condición |
|---|---|
| Nombre, apellidos, rol, organización | `persona.leer` |
| Número de documento enmascarado (`****4567`) | `persona.leer` |
| Número de documento completo | `persona.editar` |
| Correo y teléfono | `persona.editar` |
| Estado del acceso: con usuario, sin usuario, bloqueado | `usuario.gestionar` |
| **Código de acceso** | Nadie. No existe en claro en la base |
| Botón Nueva persona | `persona.crear` |
| Botón Editar | `persona.editar` |
| Botón Gestionar permisos | `permiso.gestionar` |
| Botón Regenerar código de acceso | `usuario.gestionar` |
| Columna Llegada registrada hoy | `registro.leer` |

**P11 Recepción**

| Elemento | Condición |
|---|---|
| Búsqueda por documento y botón Registrar llegada | `llegada.registrar` |
| Botón Crear persona no registrada | `persona.crear` |
| Botón Generar o regenerar código de acceso | `usuario.gestionar` |
| Código recién generado, visible una sola vez | `usuario.gestionar` |
| Botón Desbloquear cuenta | `usuario.gestionar` |
| Contador de llegadas del día | `llegada.registrar` |

La pantalla de recepción muestra el código recién generado en un panel que se limpia al pasar a la siguiente persona. No queda en el historial de la vista ni se puede volver a consultar.

**P13 Estadísticas**

| Elemento | Condición |
|---|---|
| Totales de llegada y asistencia, ocupación por actividad | `estadistica.leer` |
| Enlace a la lista nominal de asistentes | `registro.leer` |

### 9.7 Qué protege ahora la interfaz

Con la tabla `usuario`, el número de documento deja de ser una llave y vuelve a ser un dato personal. Eso cambia el motivo del enmascaramiento en el directorio: ya no es una medida de seguridad sino de privacidad, y por eso se mantiene pero deja de ser crítica.

La credencial real es el código de acceso, y la interfaz lo trata en consecuencia:

- **No se muestra nunca.** En la base solo está su hash, así que ninguna pantalla puede recuperarlo, ni siquiera para un administrador. La única vez que aparece en claro es en la respuesta a crear o regenerar, y se pinta una sola vez.
- **No se imprime en la escarapela.** La escarapela es visible y fotografiable durante los dos días del congreso. El código se entrega por separado, en el desprendible de registro.
- **No viaja en la URL.** Ni como parámetro de consulta ni en enlaces de acceso directo, porque quedaría en el historial del navegador y en los registros del servidor.
- **El formulario de acceso no distingue errores.** Documento inexistente y código incorrecto producen el mismo mensaje. Decir "ese documento no está registrado" confirmaría quién asiste al congreso.

La pantalla de acceso pide dos campos: documento y código. Conviene que el campo del código acepte minúsculas y las convierta, ignore espacios y guiones, y muestre el texto en mayúscula fija, porque la mayoría de los errores al escribirlo vienen de ahí y no de la memoria de la persona.

### 9.8 Configuración de visibilidad adoptada

Las dos preguntas que quedaban abiertas se resuelven así.

**El visitante conserva las cinco pantallas base, incluida la de registrar asistencia.** Registrar la asistencia propia no es un permiso sino una consecuencia de estar autenticado. Retirársela dejaría sin datos el indicador central del congreso, porque el visitante es justamente quien llena los salones. La definición de "solo cronograma" se respeta en lo que importa: el visitante no ve el directorio, ni estadísticas, ni ninguna pantalla de gestión.

**El organizador no administra zonas ni personas, pero sí las consulta.** Gestiona actividades, lee el directorio, ve registros y estadísticas. No puede editar personas, ni otorgar permisos, ni tocar el inventario de espacios.

El criterio general al decidir ambas fue el mismo: **cada rol recibe lo mínimo que le permite cumplir su función, y lo que excede eso se otorga por persona.** Un organizador que además vaya a cubrir la entrada recibe `llegada.registrar` y `usuario.gestionar` a título individual, sin que eso cambie lo que ven los demás organizadores. Es el modelo que describiste: los cuatro roles son el punto de partida, no el destino.

**El paquete de recepción resuelve el caso de la persona no registrada.** Quien cubre la entrada recibe tres permisos a título individual: `llegada.registrar`, `persona.crear` y `usuario.gestionar`. Con eso puede registrar llegadas, dar de alta a quien llegó sin inscribirse y entregarle un código de acceso, sin necesidad de que haya un administrador presente.

Lo que ese paquete deliberadamente **no** incluye:

- `persona.editar`, porque dar de alta a alguien nuevo es distinto de modificar los datos de los ya inscritos.
- `persona.leer`, porque la búsqueda de la pantalla de recepción va por documento y devuelve un solo resultado reducido. No hace falta abrir el directorio completo para atender la entrada.
- `permiso.gestionar`, de modo que las personas creadas en la entrada nacen como visitantes sin permisos.

Y sobre `usuario.gestionar` pesa la regla I11: recepción regenera códigos de visitantes y participantes, nunca de organizadores ni administradores. Sin esa restricción, el paquete de recepción sería una ruta directa a permisos totales.

### 9.9 Tres niveles de control y una advertencia

| Nivel | Qué hace | Dónde |
|---|---|---|
| Navegación | El menú solo lista las pantallas alcanzables | Componente de menú, a partir de `permisos` |
| Ruta | Un guard bloquea el acceso directo por URL y redirige a una pantalla de acceso denegado | Router |
| Elemento | Botones y columnas se ocultan individualmente | Componente de control de permiso |

```tsx
export function Puede({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { puede } = usePermisos();
  return puede(permiso) ? <>{children}</> : null;
}

// Uso
<Puede permiso="actividad.gestionar">
  <BotonEditarActividad id={actividad.id} />
</Puede>
```

**Ocultar no es proteger.** Todo lo anterior es presentación: evita que la gente vea opciones que no puede usar. La seguridad real está en el backend, que valida el permiso en cada petición sin importar lo que el frontend haya mostrado. Cualquier endpoint que dependa de que el botón estuviera oculto es una vulnerabilidad.

### 9.10 Pantalla de inicio adaptativa

P1 es la misma ruta para todos, pero su contenido se arma con los permisos disponibles. Evita construir cuatro pantallas de inicio distintas.

| Bloque | Condición |
|---|---|
| Próxima actividad del cronograma | Siempre |
| Acceso rápido a registrar asistencia | Siempre |
| Mi escarapela | Siempre |
| Resumen de llegadas del día | `estadistica.leer` |
| Acceso rápido a recepción | `llegada.registrar` |
| Actividades que yo dirijo | Si la persona es responsable de alguna |
| Acceso rápido a gestión de actividades | `actividad.gestionar` |
