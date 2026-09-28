# CLAUDE.md

Contexto del proyecto para Claude Code. Léelo completo antes de la primera tarea de cada sesión.

## Qué es esto

MVP del sistema de gestión logística del Quinto Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global (ETITC, Bogotá, 15–16 de octubre de 2026). Es una **versión de demostración**: se entrega al cliente para mostrar la funcionalidad visible y obtener retroalimentación antes del desarrollo definitivo.

Cubre cinco capacidades: gestión de personas, zonas del campus, actividades, registro de llegada al congreso y registro de asistencia por actividad, todo bajo un modelo de permisos.

**El diseño vive en `docs/diseno-mvp.md`. Ese documento es la fuente de verdad.** Si una tarea contradice el diseño, detente y dilo en vez de improvisar. Si el diseño no cubre algo, propón y espera confirmación.

Lo pospuesto para después de la demo está en `docs/deuda-mvp.md`. **No lo implementes sin que se pida**, y no lo borres: es la lista de lo que falta antes de operar con datos reales.

## Stack

| Capa | Tecnología | Nota |
|---|---|---|
| Runtime | Node.js 20+ | |
| Lenguaje | TypeScript en modo estricto | Sin `any` salvo justificación en comentario |
| Backend | Express | `tsx` en desarrollo |
| Base de datos | SQLite vía `better-sqlite3` | Archivo en `backend/database/` |
| Acceso a datos | **SQL crudo** | Sin ORM ni query builder |
| Hash | `bcryptjs` | |
| Frontend | React + Vite, SPA, `react-router` | Pico CSS para el estilo base |
| Pruebas | Vitest, `supertest` para la API | |
| Validación | Zod en los bordes de la API | |
| Herramientas | Prettier, `concurrently` | |

## Estructura del repositorio

```
backend/
  database/
    esquema.sql         esquema completo, fuente única
    semillas/           datos de catálogo y demo
    congreso.db         generado, en .gitignore
  src/
    index.ts            arranque del servidor
    app.ts              aplicación Express, exportable para pruebas
    db/                 conexión, reset
    middleware/         autenticacion.ts, permisos.ts, errores.ts
    modulos/<recurso>/  rutas.ts, repositorio.ts (+ servicio.ts si hay reglas)
    utils/              codigo.ts, hash.ts, fechas.ts
  tests/
frontend/
  src/
    api/                cliente HTTP y funciones por recurso
    auth/               sesion.tsx, usePermisos.ts, Puede.tsx
    rutas/              router y guards
    paginas/            una por pantalla del diseño
    componentes/
docs/
  diseno-mvp.md
  PLAN.md
  deuda-mvp.md
```

`rutas` valida entrada y traduce a HTTP; `repositorio` es el único lugar donde se escribe SQL. Los módulos con reglas de negocio (`actividades`, `registros`, `personas`) añaden `servicio.ts` con esas reglas. Las rutas nunca consultan la base directamente.

## Comandos

```bash
npm run dev          # backend y frontend en paralelo
npm run dev:api
npm run dev:web
npm run reset        # recrea la base: esquema + semillas de catálogo y demo
npm run test
npm run typecheck
npm run format
```

## Reglas que no se negocian

Son consecuencia directa del diseño. Violarlas rompe seguridad o corrección, no estilo.

### Credenciales

1. El código de acceso se guarda **solo con bcrypt**. Nunca en claro, nunca en un log, nunca en un mensaje de error. Única excepción: los códigos de las cuentas de demo, que viven en claro en las semillas y en `docs/demo.md` y se hashean al cargarlos.
2. `codigo_hash` no aparece en ninguna respuesta de la API, en ningún caso.
3. El código en claro existe únicamente en la respuesta de dar de alta a una persona o de generar su código, una sola vez.
4. `POST /auth/login` devuelve el mismo `401` con el mismo cuerpo para documento inexistente, usuario o persona inactivos y código incorrecto. No confirmes qué documentos están registrados.
5. Quien no tiene `permiso.gestionar` solo da de alta personas con rol visitante (regla **I12**); otro rol responde `403`.
6. `usuario.gestionar` solo se otorga al administrador en las semillas y plantillas, mientras I11 esté pospuesta.

### Autorización

7. **Cada endpoint verifica el permiso en el servidor.** Que el frontend oculte un botón no protege nada.
8. **Nunca decidas por rol.** Prohibido `if (rol === 'administrador')`. Siempre se evalúa el permiso: `exigePermiso('actividad.gestionar')`. El rol es solo un estatus que se muestra (la única lectura del rol con efecto es aplicar su plantilla al dar de alta y la regla I12).
9. `actividad.codigo` no se incluye en respuestas para quien no tenga `actividad.gestionar`. Filtrarlo es responsabilidad del servicio, no de la vista.

### Datos

10. Fechas siempre en UTC, formato `YYYY-MM-DD HH:MM:SS`. La conversión a hora de Bogotá ocurre en el frontend; la única excepción es traducir el filtro `dia` a un rango UTC.
11. `PRAGMA foreign_keys = ON` en **cada** conexión, no una sola vez al arrancar.
12. La verificación de solapamiento de actividades (I1) va dentro de la misma transacción que el `INSERT` o `UPDATE`.
13. El esquema cambia **solo** editando `database/esquema.sql` y la sección 3.2 del diseño a la vez. Las migraciones numeradas llegan después de la demo.
14. Nada de SQL específico de SQLite más allá de lo que el diseño ya documenta y justifica. Este esquema migra a PostgreSQL después.

## Convenciones

**Vocabulario del dominio en español**, igual que en la base: `persona`, `actividad`, `zona`, `registroLlegada`. No traduzcas a inglés ni mezcles (`personService` está mal, `servicioPersona` o `personas/servicio.ts` está bien).

**Forma única de error.** Todas las respuestas de error usan esta estructura, sin excepción:

```json
{ "error": { "codigo": "ASISTENCIA_YA_REGISTRADA", "mensaje": "...", "detalle": {} } }
```

`codigo` en mayúsculas con guion bajo, estable, pensado para que el frontend lo interprete. `mensaje` en español, dirigido a la persona usuaria.

**Códigos HTTP** según la tabla de la sección 5 del diseño. En particular: `409` para conflicto de estado (duplicado, solapamiento) y `422` para regla de negocio incumplida (código inválido, fuera de ventana).

**Frontend:** el token se guarda en `sessionStorage`; el código de acceso jamás se persiste. La navegación, los guards de ruta y la visibilidad de botones se derivan del arreglo `permisos` que devuelve `GET /auth/yo`.

## Cómo trabajar

- Una tarea a la vez, siguiendo `docs/PLAN.md`. No adelantes incrementos.
- Antes de escribir código, si la tarea toca una invariante (I1 a I12), di cuál y cómo la vas a cumplir.
- Cada incremento termina con sus pruebas pasando y `npm run typecheck` limpio.
- Las invariantes se prueban explícitamente, no se asumen.
- No instales dependencias que no estén en el stack de arriba sin preguntar.
- Si encuentras una contradicción en el diseño, repórtala. No la resuelvas en silencio.
