# Plan de construcción del MVP (versión de demostración)

Siete incrementos en orden. Cada uno es una tarea autónoma con criterios de aceptación verificables. No se pasa al siguiente hasta que el actual los cumple.

Referencias entre corchetes (`[§4]`, `[I12]`, `[P6]`) apuntan a `docs/diseno-mvp.md`. Lo pospuesto está en `docs/deuda-mvp.md`.

---

## 1. Andamiaje

**Objetivo.** Repositorio ejecutable, vacío de lógica.

- Monorepo con `backend/` y `frontend/`, workspaces de npm.
- TypeScript estricto en ambos. Prettier.
- Express con `GET /api/v1/salud` que responde `{ "estado": "ok" }`, separado en `app.ts` (exportable para pruebas) e `index.ts` (arranque).
- Manejador de errores central con la forma única de error y `404` uniforme para rutas desconocidas.
- Vite con React sirviendo una página mínima y proxy de `/api` hacia el backend.
- Vitest y supertest configurados, con una prueba de `salud`.
- Scripts de `CLAUDE.md` funcionando (`reset` puede quedar como marcador hasta el incremento 2).

**Aceptación.** `npm run dev` levanta ambos. `npm run typecheck` y `npm run test` pasan. `GET /api/v1/salud` responde 200 y una ruta inexistente responde 404 con la forma única de error.

---

## 2. Esquema y semillas

**Objetivo.** Base de datos recreable con datos de demo desde el inicio, para que cada incremento siguiente se pueda ver funcionando.

- Módulo de conexión en `src/db/` que abre la base (ruta configurable; `:memory:` en pruebas) y ejecuta `PRAGMA foreign_keys = ON` en cada conexión [regla 12].
- `database/esquema.sql` con el DDL de `[§3.2]`, copiado tal cual.
- `npm run reset`: borra la base, aplica el esquema y carga las semillas.
- Semillas de catálogo: roles, permisos `[§3.3]`, plantillas de rol `[§9.4]`, tipos de actividad, categorías.
- Semilla de demo: edificios y salones de ejemplo; personas de los cuatro roles más una cuenta de recepción, con códigos de acceso conocidos; **cronograma de dos días generado alrededor de la hora actual** (actividades terminadas, en curso y próximas, en paralelo en varias zonas) `[I7]`; llegadas y asistencias ya registradas en las actividades pasadas.
- Utilidades `utils/fechas.ts` (UTC `YYYY-MM-DD HH:MM:SS`, día local de Bogotá), `utils/codigo.ts` (generador con alfabeto de 32 caracteres) y `utils/hash.ts` con `bcryptjs`, que la semilla necesita para guardar los códigos de demo.
- Catálogo de permisos y plantillas de rol como fuente única en `src/modulos/permisos/catalogo.ts`.

**Aceptación.** `npm run reset` sobre una base vacía crea las 12 tablas y los datos; ejecutarlo dos veces seguidas funciona. Prueba de que las llaves foráneas se rechazan. Prueba de que el índice de I4 rechaza dos llegadas de la misma persona a las 08:00 y a las 19:30 hora de Bogotá del mismo día.

---

## 3. Autenticación y permisos

**Objetivo.** Poder iniciar sesión y proteger rutas.

- `POST /auth/login`: busca por documento, verifica el hash, normaliza el código [§5]. Mismo `401` para todo fallo [regla 4].
- Sesiones en memoria con token aleatorio y vigencia de 12 h; `POST /auth/salir`; `GET /auth/yo` con persona, rol y permisos.
- Middleware `autenticacion` y `exigePermiso(codigo)`; los permisos se leen de la base en cada petición [reglas 8 y 9].

**Aceptación.** Login correcto devuelve token; documento inexistente, código incorrecto y usuario inactivo devuelven **respuestas idénticas**; ruta protegida sin token da `401` y con token sin permiso da `403`; tras `salir` el token deja de servir; ninguna respuesta contiene `codigo_hash`.

---

## 4. API de dominio: personas, catálogos y actividades

**Objetivo.** Todo lo que se administra.

- `GET /catalogos`.
- Personas: listado con búsqueda y paginación, detalle, alta, edición, permisos, generación de código [§5]. Enmascarado del documento y ocultación de correo y teléfono sin `persona.editar`. Documento duplicado `409` [I6]. Alta aplica la plantilla del rol y devuelve el código una vez; **regla I12**.
- Actividades: listado con filtros (el `dia` local se convierte a rango UTC), detalle, alta, edición, cancelación. Código de actividad generado al crear. **I1** dentro de la transacción [regla 13], `409` con la actividad que ocupa la zona. `codigo` omitido sin `actividad.gestionar` [regla 10].

**Aceptación.** Prueba de I12: una cuenta de recepción da de alta un visitante (`201` con código) y recibe `403` al pedir rol organizador. Prueba de enmascarado con solo `persona.leer`. Prueba de `409` por documento repetido. Prueba de solapamiento en sus tres formas (inicio dentro, fin dentro, contención) y de que actividades contiguas **sí** se permiten. Prueba de que el listado no incluye el código para un visitante.

---

## 5. Registros y panel

**Objetivo.** Los dos flujos que producen los datos del congreso y su resumen.

- `GET /recepcion/buscar`, `POST /registros/llegada` [I4, §6.1], `GET /registros/llegada?dia=`.
- `POST /registros/asistencia` con validaciones en orden: código existente (`422`), no cancelada (`422`) [I9], dentro de ventana (`422`) [I7], sin registro previo (`409`) [I3]. Ventana configurable por entorno.
- `GET /registros/asistencia/mias`; `GET /actividades/{id}/asistentes` con `registro.leer` o siendo responsable.
- `GET /estadisticas`.

**Aceptación.** Prueba de llegada duplicada el mismo día (`409` con la hora previa). Prueba de cada uno de los cuatro rechazos de asistencia con su código. Prueba de que el responsable ve sus asistentes sin `registro.leer`. Las estadísticas cuadran contra consultas directas sobre la semilla.

---

## 6. Frontend: cimientos y pantallas base

**Objetivo.** Sesión, permisos y lo que ve cualquier persona autenticada [P1 a P5].

- Cliente HTTP con el token (`sessionStorage`), manejo uniforme del error del backend y redirección a login ante `401`.
- Contexto de sesión, `usePermisos`, componente `Puede` [§9.2, §9.9].
- Router con guards por permiso y pantalla de acceso denegado; menú construido desde `permisos` [regla 9].
- Pantalla de acceso: documento y código, este normalizado a mayúscula sin espacios ni guiones [§9.7].
- P1 Inicio adaptativo, P2 Cronograma con filtros y detalle, P3 Mi perfil con escarapela, P4 Registrar asistencia, P5 Mis asistencias.
- Estilo base con Pico CSS; fechas mostradas en hora de Bogotá.

**Aceptación.** Iniciar sesión con cuatro personas de distintos roles produce cuatro menús distintos. Entrar por URL a una ruta sin permiso muestra acceso denegado. Un visitante marca asistencia de principio a fin y el código de actividad no aparece en su interfaz.

---

## 7. Frontend de gestión y guion de demo

**Objetivo.** [P6, P9, P11, P12] y dejarlo presentable.

- P6 Directorio con formulario lateral de alta, edición, permisos y generación de código.
- P9 Gestión de actividades, mostrando el `409` de solapamiento de forma comprensible.
- P11 Recepción: búsqueda por documento, registro de llegada, alta de persona nueva con código visible una sola vez.
- P12 Panel con totales, ocupación y llegadas del día.
- `docs/demo.md` con el guion de la presentación y las credenciales de prueba.
- Repaso final contra las reglas de `CLAUDE.md`, una por una.

**Aceptación.** Recorrido con la cuenta de recepción: encuentra a una persona, registra su llegada, da de alta a una no registrada y le entrega un código; no ve el directorio ni puede editar a nadie. La base se recrea con `npm run reset` y el panel muestra datos verosímiles.

---

## Notas de ejecución

El orden importa. El incremento 3 sostiene la autorización del resto; los incrementos 4 y 5 concentran las invariantes y son los que merecen revisión humana del código, no solo pruebas verdes.

Nada en este plan cubre escarapelas en PDF, envío de correo, mapa 3D ni lo inventariado en `docs/deuda-mvp.md`.
