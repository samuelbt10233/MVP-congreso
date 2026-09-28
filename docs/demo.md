# Guion de demostración

Recorrido de unos 20 minutos por el MVP con los datos de demo. Cada acto usa una cuenta distinta, así el cliente ve cómo cambia la interfaz según los permisos de quien entra.

## Preparación (5 minutos antes)

```bash
npm install          # solo la primera vez
npm run reset        # recrea la base con el cronograma alrededor de la hora actual
npm run dev          # API en :3000, web en http://localhost:5173
```

- Ejecuta `npm run reset` **justo antes** de presentar: el cronograma se genera alrededor de la hora del reset, con actividades terminadas, en curso y próximas. Si el servidor ya estaba corriendo, reinícialo después del reset.
- La salida de `npm run reset` imprime las credenciales y **los códigos de las actividades en curso**. Déjala a mano: son los que "se exhiben en el salón".
- Abre dos ventanas del navegador (una normal y una de incógnito) para alternar cuentas sin cerrar sesión.

## Credenciales de prueba

Datos ficticios, solo para la demo.

| Cuenta | Documento | Código | Qué ilustra |
|---|---|---|---|
| Administradora — Laura Gómez | `1010101010` | `ADMN2` | Todos los permisos |
| Organizador — Carlos Rodríguez | `1020202020` | `RGNZ3` | Programa actividades, consulta el directorio y el panel |
| Participante — María Fernanda López | `1030303030` | `PART4` | Ponente responsable de tres actividades |
| Visitante — Andrés Castro | `1040404040` | `VSTA5` | Asistente; empieza sin llegada ni asistencias |
| Recepción — Valentina Ruiz | `1050505050` | `RECP6` | Rol visitante con el paquete de recepción |

El código se puede escribir en minúsculas, con espacios o guiones: `vsta-5` funciona igual que `VSTA5`.

## Acto 1 — La experiencia del asistente (visitante)

1. Entra con `1040404040` y `vsta-5`. Señala que el código se normaliza solo.
2. **Inicio**: actividades en curso y la próxima, accesos rápidos, escarapela.
3. **Mi perfil**: la escarapela muestra nombre, organización y rol. *No* muestra el documento ni el código de acceso, porque la escarapela se ve y se fotografía.
4. **Cronograma**: filtros por día, zona, tipo y categoría; la actividad cancelada aparece tachada. Abre el detalle de una actividad: el visitante **no** ve su código de asistencia.
5. **Registrar asistencia** con el código de una actividad en curso (de la salida del reset): confirma la actividad y la hora.
6. Repite el mismo código: *«Ya registraste tu asistencia a esta actividad.»*
7. Prueba un código inventado (`ZZZZ`): *«El código no corresponde a ninguna actividad.»*
8. **Mis asistencias**: aparece la actividad recién registrada.

> Mensaje: el asistente solo necesita su documento y su código; el código de la actividad lo ve en el salón, así que marcar asistencia exige estar presente.

## Acto 2 — La entrada al campus (recepción)

1. En otra ventana, entra con `1050505050` / `RECP6`. El menú solo agrega **Recepción**: es una estudiante de apoyo con rol de visitante a la que se le dio el paquete de recepción.
2. Busca `1040404040`: aparece Andrés con su rol, sin datos personales. **Registrar llegada** → indica qué escarapela entregar. El contador del día sube.
3. Busca de nuevo el mismo documento: *«Ya se registró su llegada hoy a las…»* (una llegada por persona y día).
4. **Siguiente persona**. Busca un documento que no existe, por ejemplo `77889900` → **Dar de alta**. Completa nombre y apellidos: solo puede darla de alta como visitante.
5. Aparece el **código de acceso, una sola vez**, para entregárselo. Registra su llegada.
6. **Siguiente persona**: el código desaparece de la pantalla y no se puede volver a consultar.
7. (Opcional) En la ventana de incógnito, la persona nueva entra con `77889900` y el código entregado.
8. Intenta abrir `/personas` escribiendo la URL: *Acceso denegado*. Recepción no ve el directorio ni edita a nadie.

## Acto 3 — La organización (organizador)

1. Entra con `1020202020` / `RGNZ3`.
2. **Gestión de actividades**: aquí sí aparecen los códigos para exhibir en cada salón.
3. **Nueva actividad** en la misma zona y horario que una existente → *«La zona ya está ocupada por «…» de … a …»*. Cambia la hora y se programa, con su código generado.
4. **Cancelar** esa actividad: queda tachada y ya no admite asistencia.
5. **Personas**: el organizador consulta el directorio con el documento enmascarado (`****4567`) y sin datos de contacto; no puede editar.
6. **Panel**: llegadas del día, asistencias, actividades en curso y ocupación de cada actividad frente a la capacidad de su zona. **Ver asistentes** abre la lista nominal.

## Acto 4 — El ponente (participante)

1. Entra con `1030303030` / `PART4`. Su menú es igual al del visitante: no tiene permisos adicionales.
2. **Cronograma** → abre «Movilidad eléctrica en Bogotá» (o cualquiera de sus actividades): tiene **Ver asistentes**, aunque no puede ver los asistentes de actividades ajenas.

> Mensaje: el rol es el estatus en el congreso; lo que cada quien puede hacer lo deciden los permisos.

## Acto 5 — La administración (administradora)

1. Entra con `1010101010` / `ADMN2`: el menú completo.
2. **Personas** → busca a María Fernanda: documento completo, datos de contacto, edición.
3. En **Permisos en el sistema**, marca *Registrar llegadas* y *Dar de alta personas* y guarda. Sigue siendo participante, pero en su próximo ingreso verá **Recepción**: así se asignan los turnos de la entrada.
4. **Código de acceso** → *Generar código nuevo*: el anterior deja de servir. El código actual nunca se puede consultar, solo reemplazar.
5. Abre la ficha de Laura (ella misma) e intenta quitarse *Gestionar permisos*: el sistema lo impide para que nadie se quede fuera.

## Preguntas para el cliente

Decisiones pendientes que la demo deja a la vista (`docs/diseno-mvp.md`, §8):

- **Ventana de asistencia**: hoy abre 15 minutos antes del inicio y cierra al terminar. ¿Está bien?
- **Entrega del código de acceso** antes del congreso: ¿por correo o en un desprendible al inscribirse?
- **Pósters con varios autores**: ¿una actividad necesita varios responsables?
- **Roles y categorías temáticas** definitivos.
- **Inventario real** de edificios y salones (hoy son datos de ejemplo).

## Qué no incluye esta versión

Escarapela en PDF, envío de correos, mapa 3D y estadísticas avanzadas quedan fuera del MVP. Tampoco están aún las protecciones de credenciales frente a abuso (bloqueo por intentos fallidos, sesiones persistentes, entre otras); están inventariadas en `docs/deuda-mvp.md` y son obligatorias antes de usar el sistema con datos reales.

## Si algo falla durante la demo

- **«No hay actividades en curso»**: el reset se hizo hace demasiado. Ejecuta `npm run reset` y reinicia `npm run dev`.
- **La sesión se cerró sola**: el servidor se reinició; las sesiones viven en memoria. Vuelve a entrar.
- **Un código de actividad no funciona**: puede estar fuera de ventana. Usa uno de la lista *Actividades en curso* de la salida del reset.
