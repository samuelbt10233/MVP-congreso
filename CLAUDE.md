# CLAUDE.md

Contexto del proyecto para Claude Code. Léelo completo antes de la primera tarea de cada sesión.

## Qué es esto

MVP del sistema de gestión logística del Quinto Congreso de Ingeniería, Desarrollo Humano y Sostenibilidad Global (ETITC, Bogotá, 15–16 de octubre de 2026). Se entrega al cliente para obtener retroalimentación antes del desarrollo definitivo.

Cubre cinco capacidades: gestión de personas, zonas del campus, actividades, registro de llegada al congreso y registro de asistencia por actividad, todo bajo un modelo de permisos.

**El diseño está cerrado y vive en `docs/diseno-mvp.md`. Ese documento es la fuente de verdad.** Si una tarea contradice el diseño, detente y dilo en vez de improvisar. Si el diseño no cubre algo, propón y espera confirmación.

## Stack

| Capa | Tecnología | Nota |
|---|---|---|
| Runtime | Node.js 20+ | |
| Lenguaje | TypeScript en modo estricto | Sin `any` salvo justificación en comentario |
| Backend | Express | |
| Base de datos | SQLite vía `better-sqlite3` | Archivo en `backend/database/` |
| Acceso a datos | **SQL crudo** | Sin ORM ni query builder |
| Frontend | React + Vite, SPA | |
| Pruebas | Vitest, `supertest` para la API | |
| Validación | Zod en los bordes de la API | |

## Estructura del repositorio

```
backend/
  database/
    migraciones/        001_esquema_inicial.sql, 002_...
    semillas/           datos de catálogo y demo
    congreso.db         generado, en .gitignore
  src/
    index.ts
    db/                 conexión, ejecutor de migraciones
    middleware/         autenticacion.ts, permisos.ts, errores.ts
    modulos/<recurso>/  rutas.ts, servicio.ts, repositorio.ts, esquemas.ts
    utils/              codigo.ts, hash.ts, fechas.ts
  tests/
frontend/
  src/
    api/                cliente HTTP y funciones por recurso
    auth/               sesion.tsx, usePermisos.ts, Puede.tsx
    rutas/              router y guards
    paginas/            una por pantalla del diseño (P1–P13)
    componentes/
docs/
  diseno-mvp.md
```

Cada módulo del backend separa tres responsabilidades: `rutas` valida entrada y traduce a HTTP, `servicio` contiene las reglas de negocio, `repositorio` es el único lugar donde se escribe SQL. Las rutas nunca consultan la base directamente.

## Comandos

```bash
npm run dev          # backend y frontend en paralelo
npm run dev:api
npm run dev:web
npm run migrar       # aplica migraciones pendientes
npm run sembrar      # carga catálogos y datos de demo
npm run test
npm run typecheck
npm run lint
```

## Reglas que no se negocian

Son consecuencia directa del diseño. Violarlas rompe seguridad o corrección, no estilo.

### Credenciales

1. El código de acceso se guarda **solo con bcrypt**. Nunca en claro, nunca en un log, nunca en un mensaje de error.
2. `codigo_hash` no aparece en ninguna respuesta de la API, en ningún caso.
3. El código en claro existe únicamente en la respuesta de crear o regenerar, una sola vez.
4. `POST /auth/login` devuelve el mismo `401` con el mismo mensaje para documento inexistente y para código incorrecto. No confirmes qué documentos están registrados.
5. Cinco intentos fallidos sobre un documento bloquean la cuenta y devuelven `429`.
6. Regenerar un código o desbloquear una cuenta exige la regla **I11**: rechaza con `403` si la persona objetivo tiene algún permiso que el solicitante no posee. La consulta está en el diseño, sección 4.
7. Regenerar un código invalida las sesiones activas de esa persona.

### Autorización

8. **Cada endpoint verifica el permiso en el servidor.** Que el frontend oculte un botón no protege nada.
9. **Nunca decidas por rol.** Prohibido `if (rol === 'administrador')`. Siempre se evalúa el permiso: `exigePermiso('actividad.gestionar')`. El rol es solo un estatus que se muestra.
10. `actividad.codigo` no se incluye en respuestas para quien no tenga `actividad.gestionar`. Filtrarlo es responsabilidad del servicio, no de la vista.

### Datos

11. Fechas siempre en UTC, formato `YYYY-MM-DD HH:MM:SS`. La conversión a hora de Bogotá ocurre en el frontend.
12. `PRAGMA foreign_keys = ON` en **cada** conexión, no una sola vez al arrancar.
13. La verificación de solapamiento de actividades (I1) va dentro de la misma transacción que el `INSERT` o `UPDATE`.
14. El esquema cambia **solo** creando un archivo de migración nuevo y numerado. Nunca edites una migración ya aplicada.
15. Nada de SQL específico de SQLite más allá de lo que el diseño ya documenta y justifica. Este esquema migra a PostgreSQL después.

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
- Antes de escribir código, si la tarea toca una invariante (I1 a I11), di cuál y cómo la vas a cumplir.
- Cada incremento termina con sus pruebas pasando y `npm run typecheck` limpio.
- Las invariantes se prueban explícitamente, no se asumen. Si implementas I11, escribe la prueba de que recepción no puede regenerar el código de un administrador.
- No instales dependencias que no estén en el stack de arriba sin preguntar.
- Si encuentras una contradicción en el diseño, repórtala. No la resuelvas en silencio.
