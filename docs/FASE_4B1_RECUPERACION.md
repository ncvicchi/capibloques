# Fase 4B.1: recuperar proyectos y envíos pendientes

Guía histórica de esta entrega. Sus pruebas, contratos, pendientes y recetas describen ese momento. Consultar el [contexto vigente](CONTEXTO_PARA_CONTINUAR.md) para estado y autorizaciones, y la [operación vigente de DEV](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) para desplegar o mantener el entorno.

Entrega acotada de recuperación local en el navegador, sobre el autoguardado 4A. No cambia PostgreSQL, la API ni los generadores. No habilita producción ni edición offline. La política de salida en equipos compartidos queda en 4B.2, con otro OK.

Actualización posterior: [4B.2a](FASE_4B2A_SALIDA.md) amplía la salida con la elección de conservar o retirar las copias locales confirmadas de esa cuenta. Las referencias de este documento a conservar siempre al salir describen la entrega original de 4B.1. Desconexión sigue pendiente en 4B.2b.

## Uso

- El editor conserva el proyecto en IndexedDB, separado por UUID de cuenta. Al recargar restaura la copia de esa pestaña; si el navegador ya no conserva esa referencia, busca la más reciente de la cuenta. Primero verifica la sesión y termina de leer la copia; recién entonces permite editar.
- Antes de enviar **Guardar** o **Guardar editor como copia**, confirma una transacción local con el documento actual y la operación exacta que se enviará. Si el servidor recibió el envío pero se perdió la respuesta, volver a abrir permite repetir la misma operación sin crear un proyecto duplicado.
- El autoguardado reintenta el envío recuperado del proyecto abierto cuando su opción está activa y se cumplen las pausas de 4A. Con la opción desactivada, usar Guardar. Esto incluye un primer Guardar explícito aún sin confirmar; no crea proyectos automáticamente si nunca se pidió guardarlos.
- Antes de reemplazar cambios, **Conservar copia local y abrir** permite cambiar de proyecto sin subirlos ni descartarlos. Guardar y abrir, Descartar cambios y abrir, y Cancelar siguen disponibles. Descartar elimina la copia local abierta, no la versión del servidor.
- **Mis proyectos → Copias en esta computadora** muestra las otras copias de esta cuenta: recuperar, exportar JSON, actualizar la lista y quitar con confirmación. La copia abierta se edita/exporta desde el editor. No se envían todas las copias en segundo plano.
- Quitar una copia no borra el proyecto del servidor. Si contiene cambios o un envío pendiente, exportar antes: esa eliminación local no tiene papelera ni deshacer. Cancelar conserva la copia. Si otra pestaña la cambió desde que se abrió la confirmación, no se elimina y se pide actualizar.

## Garantías y límites

- Documento y envío pendiente se escriben juntos. La red espera la finalización de la transacción, no sólo el éxito de una escritura individual. Se solicita durabilidad estricta a IndexedDB. Referencias: [transacciones](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction) y [uso de IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).
- El envío conserva identidad, cuerpo y revisión base; las ediciones posteriores se conservan por separado. Al confirmar, sólo se reconoce la instantánea enviada. Permisos, cuenta, CSRF, revisión y replay siguen siendo comprobaciones del servidor; el almacenamiento local no concede autorización ni guarda tokens.
- Dos pestañas que partieron de una misma copia usan revisión local: si una escribió primero, la otra crea una copia independiente en lugar de pisarla. No es colaboración en tiempo real ni fusión de cambios; los conflictos de servidor siguen requiriendo resolución explícita.
- Límite local por cuenta y origen: 30 copias y 50 MiB de contenido contabilizado, incluyendo operaciones pendientes. No equivale al tamaño físico del perfil del navegador. No se expulsan copias automáticamente al llegar al límite; se informa el error, se conserva lo anterior y no se envía un Guardar que no pudo quedar registrado. Exportar y quitar otras copias permite liberar espacio. El navegador puede imponer una cuota menor.
- El guardado local agrupa cambios durante 350 ms. Un cierre abrupto puede perder una edición que todavía no llegó a confirmarse localmente; no se promete pérdida cero ante apagones. Guardar sólo en este navegador espera la confirmación antes de informar éxito. El cierre voluntario desde el editor captura el cambio reciente y espera la escritura; si falla, deja exportar y no afirma haber cerrado sesión.
- La recuperación depende del mismo origen, perfil y cuenta. Borrar datos del sitio, cerrar un perfil privado, pérdida del disco o expulsión del almacenamiento por el navegador pueden quitar las copias. IndexedDB no reemplaza Guardado en tu cuenta, JSON exportado ni los backups del servidor.
- Las copias permanecen al cerrar sesión, como antes; otra cuenta no las carga desde la aplicación, pero alguien con acceso al perfil local puede leerlas. No se ofrece confidencialidad física ni limpieza de PC compartida en esta subfase. La revocación o imposibilidad de verificar la sesión sigue bloqueando el editor.
- Se valida el documento y la ruta/cuerpo de cualquier operación recuperada antes de usarla. Una copia inválida se conserva y no se ejecuta su envío; se informa el problema. No se realiza una reparación destructiva automática de cachés dañadas.
- Sólo son durables las operaciones Guardar/Guardar editor como copia. Renombrar desde la biblioteca, Duplicar desde el listado, papelera/restauración y elección de curso no son una cola persistente de mutaciones.
- No hay service worker, apertura de la aplicación sin conexión, sincronización de todos los borradores, historial restaurable ni recuperación del borrador interno de Armar escena. Guardar/Cancelar de escena continúa explícito.

## Compatibilidad

Los borradores por cuenta de versiones anteriores se leen cuando todavía no se inicializó la recuperación nueva y se conservan intactos en localStorage. La primera escritura crea la copia IndexedDB; desde entonces se utiliza esa fuente, sin resucitar datos viejos si se quitan las copias nuevas. Los borradores anónimos anteriores a las cuentas siguen teniendo recuperación explícita desde Mi cuenta.

Una operación de 4A que sólo existía en memoria y ya se perdió no puede reconstruirse retrospectivamente. JSON portable mantiene su formato y no incluye asociación al servidor ni envíos pendientes. Cambiar de dominio sigue requiriendo exportación/importación; no se leen datos del antiguo Pages.

## Validación

Validación del 7 de septiembre de 2026. Núcleo de recuperación en `9239b6c`, correcciones de integración en `d180052`, `36f2975` y `b8b0abb`, y ajustes visuales finales en `e36f2e0`/`99272e2`.

- Tipos, lint y smoke del editor, JSON, simulador, historial local y planificador de autoguardado aprobados. Sin dependencias nuevas ni cambios en los generadores.
- Chrome y Edge contra DEV: 50 comprobaciones funcionales aprobadas sobre `b8b0abb`, cubriendo migración, lectura antes de editar, reinicio real de un navegador con perfil efímero persistente, respuesta perdida de POST/PUT, ediciones posteriores, aborto después del éxito de una escritura pero antes de confirmar la transacción, ACK confirmado con escritura local fallida, varios proyectos/pestañas, cambio de cuenta, cuotas, exportación/quitar y regresiones de acceso/cursos.
- Esa ronda detectó desborde del diálogo local a 200 %. La siguiente detectó Cancelar fuera del cuadro de reemplazo al añadir la cuarta acción. Se corrigieron distribución y márgenes, sin ocultar contenido, forzar clics ni ampliar tolerancias. Se reutilizaron los controles existentes y se mejoró la legibilidad del listado local.
- Ronda final sobre `99272e2`: **44 pruebas Chrome/Edge aprobadas sin reintentos**, en cinco minutos, de autoguardado, biblioteca, recuperaciones de respuestas perdidas y controles locales. Incluye Cancelar/Guardar antes de reemplazar en escritorio y 390 px con texto al 200 %, más eliminación local concurrente rechazada. Capturas inspeccionadas: sin desborde horizontal, acciones alcanzables por desplazamiento cuando no caben verticalmente. Las rondas intermedias con fallos no se presentan como aprobadas.
- [CI final del código `99272e2` aprobado](https://github.com/ncvicchi/capibloques/actions/runs/34138324137): 90 pruebas Chromium y 118 Django/PostgreSQL; auditoría de dependencias sin vulnerabilidades informadas, dos sketches compilados para Wemos D1 R32 y ocho páginas estáticas verificadas. El build no publica el sitio.
- DEV: `check` sin problemas, `migrate --check` aprobado y readiness HTTP 200. Editor, API y PostgreSQL saludables, sin OOM ni reinicios automáticos. Observación final: aproximadamente 920 MiB editor, 64 MiB API y 26 MiB PostgreSQL dentro de sus límites existentes; no es una prueba de carga de una clase.
- Se actualizó DEV deteniendo sólo editor, haciendo `git pull --ff-only` y esperando salud antes de probar. Sin migraciones, eliminación de volúmenes ni cambios en cuentas reales. PRD, gateway, Proxmox host, Nginx, router, Pages y Sites no se modificaron.

Los contratos UI usan sesiones, proyectos y fallos de almacenamiento sintéticos sólo en Playwright, sin bypass de autenticación en el producto. La aplicación servida corresponde a DEV mediante su túnel dedicado; no se arrancó un servidor local alternativo. No se probó una placa física ni pérdida del disco/energía.

## Punto de control del propietario

1. Con tu sesión, cambiar nombre/bloques de un proyecto de prueba y esperar que termine «Conservando copia local…». Recargar: debe volver ese proyecto. El estado junto a Guardar distingue copia local de confirmación del servidor.
2. Desactivar el autoguardado en Mis proyectos, modificar el proyecto y elegir Nuevo proyecto → Conservar copia local y abrir. Crear un segundo trabajo; volver a Mis proyectos y recuperar el primero desde Copias en esta computadora.
3. Exportar una de las copias de prueba. Abrir Quitar y Cancelar: debe seguir allí. Confirmar sólo si ya no se necesita o se exportó; el proyecto guardado en servidor debe continuar en el listado.
4. Abrir el mismo trabajo en dos pestañas, con autoguardado desactivado, y hacer cambios diferentes. Cada pestaña conserva su copia. Si se envían ambas al servidor, el conflicto no se resuelve sobrescribiendo automáticamente.

Detenerse tras esta entrega para validar. Siguiente propuesta: **4B.2, salida en equipos compartidos y comportamiento del editor ya cargado ante desconexión**, sin debilitar aislamiento de cuentas ni revocación de acceso. Historial y escenas quedan en 4C.
