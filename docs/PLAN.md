# Plan de construcción del MVP

Doce incrementos en orden. Cada uno es una tarea autónoma con criterios de aceptación verificables. No se pasa al siguiente hasta que el actual los cumple.

Referencias entre corchetes (`[§4]`, `[I11]`, `[P6]`) apuntan a `docs/diseno-mvp.md`.

---

## 0. Andamiaje

**Objetivo.** Repositorio ejecutable, vacío de lógica.

- Monorepo con `backend/` y `frontend/`, workspaces de npm.
- TypeScript estricto en ambos. ESLint y Prettier.
- Express arriba con un `GET /api/v1/salud` que responde `{ "estado": "ok" }`.
- Vite con React sirviendo una página en blanco y proxy hacia la API.
- Scripts de `CLAUDE.md` funcionando.

**Aceptación.** `npm run dev` levanta ambos. `npm run typecheck` y `npm run lint` pasan. `GET /api/v1/salud` responde 200.

---

## 1. Base de datos y migraciones

**Objetivo.** Esquema creado y reproducible.

- Módulo de conexión en `src/db/` que abre `database/congreso.db` y ejecuta `PRAGMA foreign_keys = ON` **en cada conexión** [regla 12].
- Ejecutor de migraciones: lee `database/migraciones/*.sql` en orden, lleva registro de las aplicadas en una tabla `migracion`, es idempotente.
- `001_esquema_inicial.sql` con el DDL completo de `[§3.2]`, copiado tal cual.
- Semillas de catálogo: roles, permisos del catálogo `[§3.3]`, tipos de actividad, tipos de teléfono.

**Aceptación.** `npm run migrar` sobre base vacía crea las 17 tablas. Ejecutarlo dos veces no falla ni duplica. `npm run sembrar` carga los catálogos. Prueba que verifica que las llaves foráneas se rechazan cuando corresponde.

---

## 2. Autenticación y permisos

**Objetivo.** Poder iniciar sesión y proteger rutas. Es la base de todo lo demás.

- `utils/codigo.ts`: genera códigos de 5 caracteres, alfabeto de 32 sin `0`, `O`, `1`, `I`.
- `utils/hash.ts`: bcrypt para el código.
- `POST /auth/login` recibe `numero_documento` y `codigo`. Busca por documento, verifica el hash [reglas 1 a 4].
- Bloqueo tras cinco intentos fallidos, con `bloqueado_hasta` en `usuario` [regla 5].
- Emisión de token e invalidación en `POST /auth/salir`.
- `GET /auth/yo` devuelve persona, rol y arreglo de permisos.
- Middleware `autenticacion` y `exigePermiso(codigo)` [reglas 8 y 9].
- Manejador de errores central con la forma única de error.

**Aceptación.** Pruebas que demuestren: login correcto devuelve token; documento inexistente y código incorrecto devuelven **respuestas idénticas**; seis intentos fallidos devuelven `429`; una ruta protegida sin token da `401` y con token sin permiso da `403`; ninguna respuesta contiene `codigo_hash`.

---

## 3. Personas

**Objetivo.** Directorio y alta de personas.

- `GET /personas` con `persona.leer`, paginado.
- `POST /personas` con `persona.crear`.
- `GET /personas/{id}`, `PATCH /personas/{id}` con `persona.editar`.
- Documento enmascarado para quien solo tenga `persona.leer`; completo con `persona.editar` [§9.6].
- `GET /personas/{id}/permisos` y `PUT /personas/{id}/permisos` con `permiso.gestionar`.
- Validación con Zod. Documento duplicado responde `409` [I6].

**Aceptación.** Pruebas de cada permiso por separado. Prueba de que un usuario con solo `persona.leer` recibe el documento enmascarado. Prueba de `409` al repetir documento.

---

## 4. Usuarios y códigos de acceso

**Objetivo.** Emitir y rotar credenciales. Es el incremento con más riesgo de seguridad.

- `POST /personas/{id}/usuario` crea el acceso y devuelve el código en claro **una sola vez**.
- `POST /personas/{id}/usuario/regenerar` y `/desbloquear`, ambos con `usuario.gestionar`.
- **Regla I11** en ambos: si la persona objetivo tiene algún permiso que el solicitante no posee, `403`. La consulta SQL está en `[§4]`.
- Regenerar invalida las sesiones activas de esa persona [regla 7].

**Aceptación.** Prueba explícita de I11 con tres casos: recepción sobre visitante (permitido), recepción sobre administrador (`403`), administrador sobre recepción (permitido). Prueba de que el código en claro no aparece en ninguna consulta posterior. Prueba de que la sesión previa deja de servir tras regenerar.

---

## 5. Zonas

**Objetivo.** Inventario del campus.

- CRUD de `edificio` y `zona` con `zona.gestionar`.
- `GET /edificios`, `GET /edificios/{id}/zonas` y `GET /zonas` abiertos a cualquier persona autenticada.
- Semilla con los bloques y salones reales si ya están disponibles; si no, datos de ejemplo marcados como tales.

**Aceptación.** Un organizador (sin `zona.gestionar`) puede listar zonas pero recibe `403` al crear.

---

## 6. Actividades

**Objetivo.** El cronograma, con su invariante más delicada.

- CRUD con `actividad.gestionar`; listado abierto con filtros por día, zona, tipo y categoría.
- Generación del `codigo` de actividad al crear: 4 caracteres, único, sin ambiguos.
- **I1**: verificación de solapamiento por zona dentro de la misma transacción [regla 13]. Conflicto responde `409` indicando qué actividad ocupa el rango.
- **I2** vía `CHECK` ya presente en el esquema.
- `codigo` se omite de la respuesta para quien no tenga `actividad.gestionar` [regla 10].
- `POST /actividades/{id}/cancelar`.

**Aceptación.** Prueba de solapamiento en sus tres formas: inicio dentro de otra actividad, fin dentro de otra, y una que contiene por completo a otra. Prueba de que actividades contiguas (una termina justo cuando empieza la siguiente) **sí** se permiten. Prueba de que el listado no filtra el código para un visitante.

---

## 7. Registros

**Objetivo.** Los dos flujos que producen los datos del congreso.

- `GET /recepcion/buscar?documento=` con `llegada.registrar`, devuelve solo nombre, rol y estado de llegada [§6.1].
- `POST /registros/llegada` con `llegada.registrar`. **I4**: una llegada por persona y día local de Bogotá. Duplicado responde `409` con la hora del registro previo.
- `POST /registros/asistencia` abierto a cualquier persona autenticada, recibe `codigo`, toma la persona del token.
- Validaciones en orden: código existente (`422`), actividad no cancelada (`422`) [I9], dentro de ventana (`422`) [I7], sin registro previo (`409`) [I3].
- Ventana configurable, por defecto desde 15 minutos antes del inicio hasta el fin.
- `GET /registros/asistencia/mias` y `GET /actividades/{id}/asistentes`, este último permitido también al responsable de la actividad sin `registro.leer` [§9.4].

**Aceptación.** Prueba del caso de borde de I4: llegada a las 19:30 hora de Bogotá y otra a las 08:00 del mismo día local deben chocar. Prueba de cada uno de los cuatro rechazos de asistencia con su código correcto. Prueba de que el responsable ve sus asistentes sin tener `registro.leer`.

---

## 8. Estadísticas

**Objetivo.** Lo que verá la Vicerrectoría en la demo.

- `GET /estadisticas/resumen`: total de llegadas por día, total de asistencias, actividades en curso.
- `GET /estadisticas/asistencia-por-actividad`: asistentes por actividad y ocupación contra la capacidad de la zona.
- Ambos con `estadistica.leer`.

**Aceptación.** Los números cuadran contra consultas directas a la base sobre el juego de datos de demo.

---

## 9. Frontend: cimientos

**Objetivo.** Sesión y permisos funcionando antes de dibujar pantallas.

- Cliente HTTP con el token, manejo uniforme del error del backend y redirección a login ante `401`.
- Contexto de sesión, `usePermisos`, componente `Puede` [§9.2, §9.9].
- Router con guards por permiso y pantalla de acceso denegado.
- Menú de navegación construido desde `permisos`, no desde el rol [regla 9].
- Pantalla de acceso: dos campos, el del código normaliza a mayúscula e ignora espacios y guiones [§9.7].

**Aceptación.** Iniciar sesión con cuatro personas de distintos roles produce cuatro menús distintos. Entrar por URL directa a una ruta sin permiso muestra acceso denegado.

---

## 10. Frontend: pantallas base

**Objetivo.** Lo que ve cualquier persona autenticada [P1 a P5].

- P1 Inicio adaptativo por permisos [§9.10].
- P2 Cronograma con filtros; sin mostrar el código de actividad salvo con `actividad.gestionar`.
- P3 Mi perfil con la vista de escarapela.
- P4 Registrar asistencia: campo de código y confirmación.
- P5 Mis asistencias.

**Aceptación.** Un visitante completa el flujo de marcar asistencia de principio a fin. El código de actividad no aparece en ninguna parte de su interfaz.

---

## 11. Frontend: pantallas de gestión

**Objetivo.** [P6 a P13], con la visibilidad de elementos de `[§9.6]`.

- P6 Directorio, P7 alta, P7b edición, P8 permisos.
- P9 Gestión de actividades, P10 zonas.
- P11 Recepción: búsqueda por documento, registro de llegada, alta de persona nueva, generación de código visible una sola vez.
- P12 Registros, P13 Estadísticas.

**Aceptación.** Recorrido con una cuenta de recepción: encuentra a una persona, registra su llegada, da de alta a una no registrada y le entrega un código. No ve el directorio completo ni puede editar a nadie.

---

## 12. Datos de demo y repaso

**Objetivo.** Dejarlo presentable para el cliente.

- Semilla de demostración: bloques y salones, dos días de cronograma con actividades en paralelo, personas de los cuatro roles, una cuenta de recepción, llegadas y asistencias ya registradas para que las estadísticas no salgan vacías.
- Guion de demostración breve en `docs/demo.md` con las credenciales de prueba.
- Repaso final contra las quince reglas de `CLAUDE.md`, una por una.

**Aceptación.** Base recreable desde cero con `npm run migrar && npm run sembrar`. Las estadísticas muestran datos verosímiles. Ninguna regla de `CLAUDE.md` incumplida.

---

## Notas de ejecución

El orden importa. Los incrementos 2 y 4 sostienen la seguridad del resto; si se dejan para el final, todo lo construido encima habrá que revisarlo.

Los incrementos 4, 6 y 7 concentran las invariantes. Son los que merecen revisión humana del código, no solo pruebas verdes.

Nada en este plan cubre escarapelas en PDF, envío de correo ni mapa 3D. Están fuera del MVP a propósito [§1].
