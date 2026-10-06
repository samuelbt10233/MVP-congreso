# Contexto del aplicativo — Sistema de gestión logística del congreso

Documento de traspaso para planificar la **aplicación final** a partir del MVP de demostración. Resume qué es el sistema, qué decisiones ya están tomadas, qué se construyó, qué se simplificó y qué queda abierto. Está pensado para pegarse completo como contexto en otra conversación.

Fuente de verdad detallada, en el repositorio `samuelbt10233/MVP-congreso` (rama `main`):
- `docs/diseno-mvp.md`: diseño de la versión de demostración.
- `docs/deuda-mvp.md`: lo pospuesto.
- `docs/demo.md`: guion de la demostración.
- `CLAUDE.md`: reglas de desarrollo.

El diseño completo original, previo a las simplificaciones, está en el primer commit de ese historial.

---

## 1. El evento y el cliente

| | |
|---|---|
| Evento | Quinto Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global |
| Institución | ETITC — Escuela Tecnológica Instituto Técnico Central, Bogotá |
| Fechas | 15 y 16 de octubre de 2026 (dos días) |
| Zona horaria | Bogotá, UTC−5 fijo (Colombia no tiene horario de verano) |
| Lugar | Campus de la ETITC: edificios ("bloques") con salones, auditorio, laboratorios y hall de pósters |
| Público | Ponentes, expositores, organizadores, asistentes externos e internos, estudiantes de apoyo |
| Interesado mencionado | La Vicerrectoría es quien verá las estadísticas en la demo |

El MVP se construyó como **versión de demostración** para mostrarle al cliente la funcionalidad visible y recoger retroalimentación antes del desarrollo definitivo. Ese desarrollo definitivo es lo que se va a planificar ahora.

> **Pregunta abierta clave:** la aplicación final, ¿es para usarse en esta edición (15–16 de octubre de 2026) o en una edición futura? El MVP **no está listo para datos reales** (ver §8), así que la respuesta cambia por completo la prioridad de lo que sigue.

---

## 2. Qué resuelve el sistema

Cinco capacidades, todas bajo un modelo de permisos:

1. **Personas**: registro de toda persona asociada al congreso, con su rol y sus permisos.
2. **Zonas**: edificios y salones del campus.
3. **Actividades**: ponencias, pósters, talleres, paneles y conferencias, cada una con zona, horario y responsable.
4. **Llegada al congreso**: registro del ingreso al campus. Lo hace un recepcionista con el documento de identidad de la persona.
5. **Asistencia a actividades**: autoservicio. La persona escribe en su dispositivo el código que se exhibe en el salón.

Además, un **panel de estadísticas** con llegadas por día, asistencias y ocupación por actividad frente a la capacidad de la zona.

**Fuera del alcance del MVP**, previsto para después:
- Generación de la escarapela como imagen o PDF.
- Envío de la escarapela por correo.
- Mapa 3D del campus y cálculo de rutas.
- Estadísticas avanzadas.

---

## 3. Decisiones de diseño que no se reabren

| # | Decisión |
|---|---|
| D1 | **El rol es el estatus en el congreso; los permisos son la capacidad en el sistema.** Son ejes independientes. El rol se muestra (escarapela, directorio); nunca decide qué se ve ni qué se puede hacer |
| D2 | La llegada al campus **no** es requisito para registrar asistencia a una actividad. Son registros independientes; la llegada sirve para contar el aforo |
| D3 | La llegada la registra un tercero con permiso, y queda guardado quién la registró |
| D4 | La asistencia es autoservicio con un **código de actividad** de 4 caracteres que se exhibe en el salón. No guarda operador |
| D5 | Hay una tabla `usuario` separada de `persona`. Una persona puede existir sin poder iniciar sesión |
| D6 | Jerarquía de zonas `edificio → zona`, con el piso guardado aparte del nombre del salón |
| D7 | SQLite en el MVP; **PostgreSQL (Supabase) en la versión final** |
| D8 | **Inicio de sesión con documento + código de acceso alfanumérico.** El código va con hash lento (bcrypt), nunca en claro, y no se imprime en la escarapela. Exigir el documento hace que cada intento se juegue contra una sola persona |

**Alfabeto de códigos**: 32 caracteres. Excluye `0`, `O`, `1` e `I`, que se confunden al dictarlos. El código de acceso tiene 5 caracteres y el de actividad, 4. La entrada se normaliza: mayúsculas, sin espacios ni guiones.

---

## 4. Modelo de dominio

### Entidades (12 tablas en el MVP)

- **Catálogos**: `rol`, `permiso`, `tipo_actividad` (la forma: ponencia, póster, taller, panel, conferencia magistral) y `categoria` (el eje temático).
- **Personas**: `persona`, `autorizacion` (permisos otorgados a una persona, con quién y cuándo) y `usuario` (credencial: hash del código y estado).
- **Campus**: `edificio` y `zona`, esta última con piso, capacidad y estado activa.
- **Programa**: `actividad`, con código único, tipo, categoría, zona, responsable, inicio, fin y estado cancelada.
- **Registros**: `registro_llegada` (persona, quién registró, fecha y hora) y `registro_actividad` (persona, actividad, fecha y hora).

El diseño completo original tenía 17 tablas. Las otras cinco (`nacionalidad`, `tipo_telefono`, `telefono`, `organizacion`, `persona_organizacion`) se aplanaron a columnas de texto en `persona` para la demo, y deberían volver en la versión final.

### Roles (plantillas, no compartimentos)

Cuatro roles: **administrador**, **organizador**, **participante** (ponente o expositor) y **visitante**.

El rol es una **plantilla**: al dar de alta a alguien se le otorgan los permisos de su rol, y después se ajustan persona por persona.

### Catálogo de permisos (9)

| Código | Habilita | Admin | Org. | Part. | Visit. | Recepción¹ |
|---|---|:--:|:--:|:--:|:--:|:--:|
| `persona.leer` | Directorio completo | ✓ | ✓ | | | |
| `persona.crear` | Dar de alta personas | ✓ | | | | ✓ |
| `persona.editar` | Modificar datos de personas | ✓ | | | | |
| `permiso.gestionar` | Otorgar y revocar permisos | ✓ | | | | |
| `usuario.gestionar` | Generar o regenerar códigos de acceso | ✓ | | | | |
| `actividad.gestionar` | Crear, editar y cancelar actividades | ✓ | ✓ | | | |
| `llegada.registrar` | Registrar llegadas | ✓ | | | | ✓ |
| `registro.leer` | Consultar registros de terceros | ✓ | ✓ | | | |
| `estadistica.leer` | Ver estadísticas | ✓ | ✓ | | | |

¹ **Recepción no es un rol**: es un paquete de permisos que se otorga a quien cubra la entrada, cualquiera que sea su rol. Por ejemplo, un estudiante de apoyo con rol de visitante.

Sin ningún permiso, toda persona autenticada puede:
- consultar la agenda,
- registrar su propia asistencia y ver su historial,
- ver su perfil y su escarapela.

El **responsable** de una actividad ve sus asistentes sin necesitar `registro.leer`. Es una regla del endpoint, no un permiso.

### Invariantes (reglas de negocio)

| # | Regla |
|---|---|
| I1 | Dos actividades no pueden solaparse en la misma zona. Las contiguas sí se permiten y las canceladas no ocupan la zona |
| I2 | El inicio de una actividad es anterior a su fin |
| I3 | Una persona registra una sola vez cada actividad |
| I4 | Una llegada por persona y **día local de Bogotá** |
| I5 | El código de actividad es único |
| I6 | El documento identifica de forma única a una persona. En el MVP es único por sí solo, sin combinarse con el tipo |
| I7 | La asistencia solo se registra dentro de la ventana: **15 minutos antes del inicio hasta el fin**, configurable. Pendiente de confirmar con el cliente |
| I8 | Registrar llegadas exige `llegada.registrar` |
| I9 | No se registra asistencia a una actividad cancelada |
| I10 | El código de acceso se guarda solo con bcrypt |
| I11 | **No escalada**: nadie regenera o desbloquea el código de alguien que tenga permisos que el solicitante no posee. *Pospuesta en el MVP* |
| I12 | Quien no tiene `permiso.gestionar` solo da de alta visitantes, que nacen sin permisos. *Agregada en el MVP* |
| I13 | Nadie puede quitarse a sí mismo `permiso.gestionar`. *Agregada en el MVP* |

**Orden de validación de una asistencia**:
1. El código existe; si no, `422`.
2. La actividad no está cancelada; si no, `422`.
3. La hora está dentro de la ventana; si no, `422`.
4. No hay un registro previo; si lo hay, `409`.

---

## 5. Flujos principales

**Llegada al congreso (recepción)**
1. Recepción busca por documento. La búsqueda devuelve solo nombre, rol y si ya llegó hoy, no el directorio.
2. Si la persona no existe, la da de alta como visitante y el sistema le muestra su código de acceso **una sola vez** para entregárselo.
3. Registra la llegada y entrega la escarapela que corresponde al rol.
4. Una segunda llegada el mismo día se rechaza indicando la hora de la primera.

**Asistencia a una actividad (asistente)**
1. La persona inicia sesión con su documento y su código de acceso.
2. Escribe el código de la actividad, que se exhibe en el salón.
3. El sistema valida en el orden de §4 y confirma el registro.

**Programación (organizador)**
1. Crea, reprograma o cancela actividades.
2. Si la zona ya está ocupada en ese horario, el sistema responde indicando qué actividad la ocupa.
3. Al crear una actividad se genera su código.

**Gestión de credenciales (administrador)**
1. Genera o regenera códigos de acceso.
2. El código anterior deja de servir.
3. El código actual nunca se puede consultar, porque en la base solo existe su hash.

---

## 6. Interfaz: principio y pantallas

**Principio rector:** la interfaz se dibuja a partir de los **permisos**, nunca del nombre del rol.
- El menú, los guards de ruta y la visibilidad de cada botón salen del arreglo de permisos que devuelve `GET /auth/yo`.
- Ocultar algo en la interfaz no es protegerlo: el backend valida el permiso en cada petición.
- Consecuencia: participante y visitante ven el mismo menú, porque tienen los mismos permisos (ninguno).

### Pantallas del MVP (9)

| # | Pantalla | Quién la ve |
|---|---|---|
| P1 | Inicio adaptativo: actividades en curso y próxima, accesos rápidos, bloques según permisos | Todos |
| P2 | Cronograma con filtros por día, zona, tipo y categoría. El código solo lo ve `actividad.gestionar`; los asistentes, `registro.leer` o el responsable | Todos |
| P3 | Mi perfil con escarapela: nombre, organización y rol, **sin documento ni código** | Todos |
| P4 | Registrar asistencia con el código de la actividad | Todos |
| P5 | Mis asistencias | Todos |
| P6 | Personas: directorio con panel lateral de alta, edición, permisos y código | `persona.leer` |
| P9 | Gestión de actividades | `actividad.gestionar` |
| P11 | Recepción: búsqueda, llegada, alta y contador del día | `llegada.registrar` |
| P12 | Panel: indicadores, ocupación, asistentes y llegadas | `estadistica.leer` o `registro.leer` |

La numeración sigue el diseño original. En la demo se fusionaron P7, P7b y P8 dentro de P6, P13 dentro de P12, y se omitió P10 (gestión de zonas).

### Reglas de interfaz sobre el código de acceso

- Se muestra solo en la respuesta de alta o regeneración, una vez, y se limpia al pasar a otra persona.
- No viaja en la URL ni se guarda en el navegador. El token de sesión va en `sessionStorage`.
- El login no distingue "documento inexistente" de "código incorrecto".

---

## 7. El MVP construido

### Stack

| Capa | Tecnología |
|---|---|
| Monorepo | npm workspaces: `backend/` y `frontend/` |
| Backend | Node 20+, Express 5, TypeScript estricto, Zod en los bordes |
| Datos | SQLite con `better-sqlite3`, **SQL crudo** (sin ORM). Esquema en un solo `esquema.sql` |
| Credenciales | `bcryptjs`; sesiones con token aleatorio **en memoria** del servidor, vigencia de 12 h |
| Frontend | React 19, Vite, react-router y Pico CSS. SPA en español, responsive |
| Pruebas | Vitest y supertest: 148 en el backend y 10 en el frontend. Además, 50 verificaciones de aceptación en navegador con Playwright, fuera del repo |

### Arquitectura del backend

Cada módulo tiene sus capas:
- `rutas.ts` valida la entrada y traduce a HTTP.
- `servicio.ts` aplica las reglas de negocio.
- `repositorio.ts` es el único lugar con SQL.

Módulos: `auth`, `personas`, `actividades`, `registros`, `estadisticas`, `catalogos`, `permisos`.

El contexto de la aplicación inyecta la base, las sesiones, un **reloj** (para probar reglas que dependen de la hora) y la ventana de asistencia.

**Convenciones**:
- Vocabulario del dominio en español en todo el código.
- Una única forma de error, `{ "error": { "codigo", "mensaje", "detalle" } }`, con códigos estables como `HORARIO_OCUPADO` o `FUERA_DE_VENTANA`.
- `409` para conflictos de estado y `422` para reglas de negocio incumplidas.
- Fechas siempre en UTC (`YYYY-MM-DD HH:MM:SS`). La conversión a hora de Bogotá ocurre en el frontend; la única excepción es el filtro por día.

### API (`/api/v1`)

| Grupo | Endpoints |
|---|---|
| Autenticación | `POST /auth/login`, `GET /auth/yo`, `POST /auth/salir` |
| Catálogos | `GET /catalogos`: roles, permisos, tipos, categorías y edificios con zonas |
| Personas | `GET/POST /personas`, `GET/PATCH /personas/{id}`, `GET/PUT /personas/{id}/permisos`, `POST /personas/{id}/codigo` |
| Actividades | `GET/POST /actividades`, `GET/PATCH /actividades/{id}`, `POST /actividades/{id}/cancelar`, `GET /actividades/{id}/asistentes` |
| Recepción y registros | `GET /recepcion/buscar`, `GET /recepcion/resumen`, `POST /registros/llegada`, `GET /registros/llegada`, `POST /registros/asistencia`, `GET /registros/asistencia/mias` |
| Estadísticas | `GET /estadisticas` |

### Datos de demo

`npm run reset` recrea la base. La semilla incluye:
- 5 cuentas con códigos conocidos.
- 48 personas sin cuenta.
- 3 bloques con 6 salones **de ejemplo**.
- Un cronograma de dos días **generado alrededor de la hora del reset**, para que siempre haya actividades en curso.
- Llegadas y asistencias coherentes con todas las invariantes.

Credenciales y guion: `docs/demo.md`.

---

## 8. Qué se simplificó y es obligatorio antes de datos reales

Lo detalla `docs/deuda-mvp.md`. Resumen:

**Seguridad (obligatorio)**
- S1: bloqueo tras 5 intentos fallidos por documento, con `429`. Hay que contar **también** los documentos inexistentes, o el bloqueo revela cuáles existen.
- S2: login en tiempo constante, comparando siempre contra un hash ficticio.
- S3: **regla I11 de no escalada**, también al crear usuario y al desbloquear. Hoy se mitiga reservando `usuario.gestionar` al administrador.
- S4: sesiones persistentes que se invalidan al regenerar el código. Hoy viven en memoria y se pierden al reiniciar el servidor.
- S5: códigos de 7 caracteres para cuentas administrativas. Falta definir qué permisos cuentan como administrativos.
- S6: desbloqueo de cuentas.

**Datos**
- Migraciones numeradas; hoy el esquema se recrea completo.
- Volver a los catálogos normalizados: nacionalidad, teléfonos y organizaciones.
- Decidir si el documento vuelve a combinarse con su tipo.
- Varios responsables por actividad.

**Funcionalidad**
- Gestión de edificios y zonas (P10); hoy se cargan por semilla.
- Pantallas separadas de alta, edición, permisos y estadísticas, si el cliente las pide.
- Columnas adicionales del directorio: estado del acceso y llegada de hoy.

**Calidad**
- ESLint.
- Pruebas de permiso endpoint por endpoint.

**Infraestructura (no estaba en el MVP)**
- Despliegue, dominio y HTTPS.
- Migración a PostgreSQL en Supabase. El esquema se escribió evitando SQL específico de SQLite; las dos excepciones documentadas tienen su equivalente en PostgreSQL:
  - el índice único por día local pasa a `(fecha_hora AT TIME ZONE 'America/Bogota')::date`;
  - el solapamiento pasa a `EXCLUDE USING gist` sobre `tstzrange`.
- Copias de respaldo.
- Monitoreo.

---

## 9. Decisiones pendientes con el cliente

1. **Ventana de asistencia**: hoy abre 15 minutos antes y cierra al terminar. ¿Se confirma?
2. **Entrega del código de acceso** antes del congreso: ¿por correo o en un desprendible al inscribirse?
3. **Varios responsables por actividad**: los pósters suelen tener varios autores. Cambia el modelo y la API.
4. **Lista definitiva** de roles y de categorías temáticas.
5. **Inventario real** de edificios, salones, pisos y capacidades.
6. **Inscripción previa**: ¿cómo llegan las personas al sistema antes del evento? El MVP solo tiene alta manual y alta en recepción; no hay importación masiva ni autoinscripción.
7. **Escarapela**: formato, impresión y si se envía por correo. Esta fase estaba fuera del MVP.
8. Retroalimentación de la demo: *no registrada en este documento*. Conviene incorporarla aquí cuando exista.

---

## 10. Lecciones del MVP útiles para la versión final

- **El cronograma de prueba debe depender de la hora.** Una demo con fechas fijas (15–16 de octubre) no deja probar el registro de asistencia en otro momento. La semilla relativa a la hora actual resolvió eso. La aplicación final necesita, además, un modo de ensayo o de reloj controlado para el simulacro previo al evento.
- **Contador de recepción.** El diseño pedía mostrar las llegadas del día a recepción, pero el único endpoint con ese dato exigía `registro.leer`. Se agregó `GET /recepcion/resumen`. Hay que revisar ese tipo de cruces entre pantalla y permiso al diseñar.
- **Persona inactiva en recepción.** Hoy recepción la encuentra y puede registrar su llegada. No está definido si eso es correcto.
- **Autodesactivación.** Un administrador puede desactivarse a sí mismo y quedarse sin acceso. I13 cubre quitarse permisos, pero no esto.
- **Operación en el evento.** Algunos puntos dependen del uso real y no se han probado:
  - Varios recepcionistas en paralelo.
  - Conectividad del campus.
  - Dispositivos de los asistentes para escribir el código.
  - Exhibición del código en cada salón: impreso, en pantalla o rotativo.
- **El código de actividad es fijo.** Una foto del código permite marcar asistencia sin estar presente. Si el dato de asistencia tiene peso, por ejemplo para certificados, conviene evaluar códigos rotativos o una verificación adicional.

---

## 11. Glosario

| Término | Significado |
|---|---|
| Escarapela | Credencial física o gafete que se porta en el evento; muestra nombre, organización y rol |
| Código de acceso | Credencial personal de 5 caracteres para iniciar sesión, junto con el documento |
| Código de actividad | 4 caracteres exhibidos en el salón para registrar asistencia |
| Llegada | Ingreso al campus, registrado por recepción. Una por persona y día |
| Asistencia | Presencia en una actividad, registrada por la propia persona |
| Paquete de recepción | Permisos `llegada.registrar` + `persona.crear`, otorgados por persona |
| Plantilla de rol | Permisos que recibe una persona al darla de alta con un rol |
| Zona | Salón, auditorio, laboratorio o hall dentro de un edificio |
| Ventana de asistencia | Intervalo en que un código de actividad es aceptado |
