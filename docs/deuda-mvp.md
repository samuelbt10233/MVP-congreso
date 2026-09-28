# Deuda de la versión de demostración

Lo que se pospuso para entregar la demo. **Todo lo marcado como obligatorio debe estar resuelto antes de operar con datos reales**, es decir, antes de abrir el sistema a los asistentes del congreso. Las referencias apuntan al diseño original, conservado en el historial de git (commit `Agregar documentos de diseño, plan y CLAUDE.md originales`).

## Seguridad de credenciales — obligatorio

| # | Pendiente | Riesgo mientras falte | Nota de implementación |
|---|---|---|---|
| S1 | Bloqueo tras cinco intentos fallidos por documento, con `429` | Fuerza bruta sobre el código de una persona conocida | Contar intentos **por documento, exista o no**; si solo se cuenta sobre usuarios existentes, el `429` delata qué documentos están registrados |
| S2 | Login en tiempo constante | El tiempo de respuesta revela si un documento existe | Ejecutar siempre una comparación bcrypt, contra un hash ficticio cuando no hay usuario |
| S3 | Regla I11: no regenerar el código de alguien con permisos que el solicitante no tiene | Quien tenga `usuario.gestionar` puede apropiarse de una cuenta de administrador | Aplicarla también a **crear** usuario y a desbloquear, no solo a regenerar. Hoy se mitiga reservando `usuario.gestionar` al administrador |
| S4 | Sesiones persistentes e invalidación al regenerar el código | Un código extraviado y luego regenerado sigue sirviendo a quien ya inició sesión con él. Reiniciar el servidor cierra todas las sesiones | Tabla `sesion` con el hash del token; borrar las de la persona al regenerar |
| S5 | Códigos de 7 caracteres para cuentas con permisos administrativos | Menor margen frente a fuerza bruta donde el daño es mayor | Definir qué permisos cuentan como administrativos y qué pasa si se otorgan a alguien que ya tiene código de 5 |
| S6 | Desbloqueo de cuentas | Depende de S1 | `POST /personas/{id}/usuario/desbloquear` con I11 |

## Datos y esquema

| # | Pendiente | Nota |
|---|---|---|
| D1 | Migraciones numeradas con registro de aplicadas | Necesarias para evolucionar el esquema sin recrear la base y para migrar a PostgreSQL |
| D2 | Catálogos `nacionalidad`, `tipo_telefono`, `organizacion` y relaciones `telefono`, `persona_organizacion` | Hoy son columnas de texto en `persona` |
| D3 | Decidir si el documento se vuelve a combinar con el tipo | Si se hace, el login y recepción deben pedir también el tipo |
| D4 | Varios responsables por actividad (`actividad_responsable`) | Pendiente de decisión del equipo; cambia la API |

## Funcionalidad

| # | Pendiente | Nota |
|---|---|---|
| F1 | CRUD de edificios y zonas con `zona.gestionar` (P10) | Hoy el inventario se carga por semilla |
| F2 | Pantallas separadas de alta, edición y permisos (P7, P7b, P8) y de registros y estadísticas (P12, P13) | Solo si la retroalimentación del cliente lo pide |
| F3 | Reparto completo de visibilidad del directorio (§9.6 original): columna de estado del acceso, llegada registrada hoy | |
| F4 | Ventana de asistencia confirmada por el cliente | Hoy −15 min / fin por defecto |

## Calidad

| # | Pendiente | Nota |
|---|---|---|
| C1 | ESLint | Hoy solo Prettier y `typecheck` |
| C2 | Pruebas por permiso de cada endpoint | Hoy se prueban las invariantes y el `401`/`403` genérico |
