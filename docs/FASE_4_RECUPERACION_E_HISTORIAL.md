# Fase 4: guardado, recuperación e historial

Guía histórica de esta entrega. Sus pruebas, contratos, pendientes y recetas describen ese momento. Consultar el [contexto vigente](CONTEXTO_PARA_CONTINUAR.md) para estado y autorizaciones, y la [operación vigente de DEV](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) para desplegar o mantener el entorno.

7 de septiembre de 2026. **Fase 4 completa, implementada y validada en DEV.** El propietario autorizó completar toda la fase, sin aprobaciones entre subfases. No habilita la fase 5 ni producción.

Este documento amplía y reemplaza los pendientes de las entregas históricas [4A](FASE_4A_AUTOGUARDADO.md), [4B.1](FASE_4B1_RECUPERACION.md) y [4B.2a](FASE_4B2A_SALIDA.md). Se mantienen sus garantías de identidad, revisión optimista, operaciones durables, cuotas locales y salida confirmada.

## Cómo usarlo

### Cortes de conexión

Si ya abriste un proyecto y falla la comprobación de sesión por un corte o error temporal del servidor, aparece **Seguir sólo en esta computadora**. Permite editar, simular, guardar localmente y exportar. Mis proyectos y las operaciones remotas quedan bloqueadas; el estado lo indica explícitamente.

**Reconectar** vuelve a comprobar cuenta, permisos y sesión antes de habilitar el servidor. El autoguardado puede retomar el proyecto abierto; los conflictos conservan la edición local y requieren abrir el servidor o crear una copia. Una cola vieja no restaura proyectos de la papelera ni recrea proyectos purgados.

No se puede ingresar ni cargar la aplicación desde cero sin servidor. La continuidad local requiere el proyecto hidratado, una sesión previamente verificada que todavía no haya vencido y ninguna revocación conocida. Se utiliza la fecha real de expiración de la sesión persistida en Django, no una renovación inventada por el navegador. Un aviso de cambio de cuenta/sesión o respuesta 401/403 bloquea el acceso; el vencimiento conocido también bloquea durante el corte. No se puede conocer una revocación remota mientras no hay comunicación, y esta opción nunca autoriza operaciones en el servidor. Al cambiar de pestaña/foco puede requerirse comprobar otra vez o elegir de nuevo continuar localmente.

### Escenas sin terminar

- **Guardar cambios** del inspector incorpora propiedades al borrador de escena; **Cancelar cambios** las revierte.
- **Guardar escena** confirma la escena en el proyecto local. Espera el almacenamiento antes de cerrar; luego el guardado manual/automático del proyecto puede enviarla al servidor.
- **Cancelar → Salir sin guardar** descarta el borrador, incluida su copia recuperable, sin publicar la escena. Si el almacenamiento falla, no se cierra ni afirma haber descartado.
- Al recargar, la escena confirmada sigue intacta y aparece **Revisar escena pendiente**. **Recuperar borrador** recupera tanto la escena en preparación como los campos todavía pendientes del inspector. **Ahora no** conserva la copia. El descarte requiere otra confirmación.
- Deshacer/Rehacer funcionan durante la edición. Al recuperar después de un cierre se inicia una nueva pila de Deshacer/Rehacer; se conserva el borrador, no toda la pila histórica de gestos.
- Si la escena confirmada ya no coincide con la base del borrador, no se fusiona ni aplica silenciosamente. Se permite conservar/exportar o descartar explícitamente.

La copia local indica si está guardando o falló. Inspector, borrador y proyecto confirmado se guardan juntos en una transacción IndexedDB, en campos diferentes del registro de esa cuenta/copia. No se insertan dentro de un envío pendiente ni se publican al simular. Los cambios de escena se capturan al editar; no se depende de terminar tareas durante el cierre del navegador. Se mantienen CAS entre pestañas, bifurcación y época contra escritores anteriores a una limpieza.

**Exportar con escena pendiente** descarga un JSON de recuperación que contiene proyecto confirmado más borrador de escena. También está disponible en Copias locales y al salir. Se importa desde **Importar JSON**, como proyecto personal nuevo: ofrece recuperar la escena, no la confirma automáticamente. No contiene cuenta, identidad remota, curso ni petición pendiente. Puede transportar campos incompletos que todavía deben corregirse antes de Guardar escena.

El JSON portable normal v1/v2 sigue igual e incluye sólo la escena confirmada. La copia extendida usa `application: CapiBloquesLocalCopy`, `version: 1`; contenedor máximo 4 MiB, proyecto interno máximo 2 MB y borrador máximo 2 MB, con validación estructural. Las versiones anteriores de la aplicación no leen este nuevo contenedor; no se cambió el formato del proyecto estándar.

### Versiones y papelera

En **Mis proyectos → Historial de…**:

1. Ver versiones manuales, automáticas periódicas y restauradas.
2. Exportar cualquier versión individual como JSON portable.
3. Restaurar una anterior, previa confirmación. Se crea una revisión nueva en el servidor; el editor abierto no se reemplaza ni fusiona. Volver a la biblioteca y abrir el proyecto para cargarla, conservando antes los cambios locales si existen.
4. Quitar una versión anterior no referenciada, confirmando su número. La versión actual no se puede quitar. Se puede exportar antes; este borrado no se deshace.

Se conservan hasta **20 puntos no referenciados por proyecto**, incluida la versión actual: las 19 instantáneas anteriores más recientes y la actual. Las versiones anteriores más antiguas se podan al superar ese límite, según la política visible. Los puntos automáticos se separan al menos cinco minutos; no se mantiene una copia completa de cada autoguardado. Un guardado manual preserva el estado anterior aunque fuese intermedio. Una revisión protegida por referencia se conserva adicionalmente y consume cuota. La fase 5 deberá fijar una revisión antes de referenciarla en una devolución; todavía no hay comentarios ni interfaz para fijarlas.

Cuotas de cuenta: **100 proyectos / 50 MB de documentos actuales**, incluida papelera, y **50 MB adicionales de versiones anteriores**. Al superar la cuota, se rechaza atómicamente el guardado y cualquier poda de esa operación: no se elimina trabajo para fingir éxito. El editor y su exportación siguen disponibles. El historial permite exportar/quitar versiones anteriores para liberar espacio. La recuperación local mantiene **30 copias / 50 MiB por cuenta y origen**, sin expulsión automática; incluye los borradores de escena y las operaciones pendientes.

La papelera protege los proyectos **30 días desde su envío**, sin impedir restaurarlos explícitamente. Después, Historial habilita **Eliminar definitivamente…**, con nombre exacto, revisión vigente y comprobación de plazo en el servidor. La purga es **individual y explícita en DEV**, no un cron ni un borrado masivo al ingresar. El proyecto permanece recuperable hasta ejecutar esa purga. Se retiran contenido e historial del proyecto exacto, con auditoría. Un registro sin contenido conserva UUID de proyecto, propietario y operación para rechazar reenvíos antiguos y reconocer un reintento de purga. No se borran descargas, otras cuentas, borradores locales ni backups existentes.

El historial es privado del propietario. Ser administrador no permite consultar proyectos privados ajenos. Una restauración conserva la asociación vigente al curso y respeta archivo/retirada del alumno; no revive membresías. La revisión docente visual y comentarios siguen en fase 5.

### Baja administrativa y respaldos

La baja preparada de [3B](FASE_3B_CURSOS_Y_BAJAS.md) incluye ahora conteo, bytes y documentos del historial. El ZIP contiene proyectos actuales en `projects/`, versiones anteriores en `history/` y manifiesto con SHA-256, revisión, fecha y tipo. El recibo de respaldo pierde vigencia si cambia el historial, además de cuenta/proyectos/cursos.

La baja elimina explícitamente las versiones antes de borrar sus proyectos; las relaciones siguen con `PROTECT`. También registra los UUID eliminados para evitar recrearlos mediante peticiones viejas. Se conservan las verificaciones de administrador, cuenta inactiva, ausencia de membresías, recibo vigente y confirmaciones. No permite un explorador general de trabajos privados ni restaura cuentas automáticamente. Los JSON del ZIP se importan como trabajos independientes, no como reconstrucción de una cuenta o su historial.

Límite del respaldo: 50 MB actuales + 50 MB históricos, un documento a la vez en el ZIP temporal. Se mantienen tmpfs de 128 MiB y memoria API de 256 MiB; no se aumentaron recursos. Un fallo de recursos impide generar/confirmar el respaldo y conserva los datos.

## Operación y comprobación

Antes de aplicar `projects.0003_history_and_deletions` se creó un `pg_dump -Fc` privado en DEV y se comprobó su catálogo con `pg_restore --list`. No se restauró sobre la base real. La migración es aditiva; las versiones previas a instalar el historial no se pueden inventar ni reconstruir. El estado actual existente se preserva como primer punto al editarlo posteriormente.

El despliegue usa ambos Compose, hostname comprobado `capi-dev`, editor detenido durante cambios y salud esperada antes de pruebas. PostgreSQL, secretos, PRD, Proxmox host, gateway, router, Nginx, Pages y Sites no se reconfiguraron. No se borraron cuentas ni proyectos reales al probar: contratos de navegador sintéticos e integración Django en una base de tests separada.

Validaciones realizadas:

- Tipos, lint y smoke de JSON, generador, simulador, historial local y autoguardado aprobados. Build local sobre `007df9c` aprobado: ocho páginas verificadas, sin publicar; aviso de tamaño de algunos chunks, no error. No se agregaron dependencias.
- DEV: migraciones consistentes y **129 pruebas Django/PostgreSQL aprobadas**, 15,1 segundos; base de tests separada. Incluye privacidad, CSRF, cuota, conservación de versiones referenciadas, puntos periódicos, restauración con conflictos/curso archivado, replay ligado al destino/modo, respaldo con historial, baja y purga sin resurrección.
- **128/128 pruebas Chrome y Edge contra DEV sobre `eb78636`, sin reintentos, 14,8 minutos**: editor/escenas, acceso, autoguardado, recuperación durable, historial, modo local, salida compartida y regresiones de importación/compartición. No se modificó el runtime de DEV mientras corrían.
- La primera ronda detectó un selector incorrecto en la prueba de papelera (`getByLabel` exacto incluía texto del select). Se corrigió usando rol y nombre accesible; no se aumentaron timeouts ni se forzaron clics. La ronda anterior y su CI fallida no se cuentan como aprobadas.
- Se comprobó la presentación con texto 200% a 390 px. Se redujo el texto inicial del historial y se reservó espacio adaptable para cerrar, con aserción geométrica de no superposición y captura final inspeccionada.
- **24/24 pruebas focalizadas Chrome y Edge contra DEV sobre `007df9c`, sin reintentos, 3,1 minutos**, después de los últimos ajustes: incluye respuesta inválida del historial, confirmación al reabrir cuando sólo queda una escena pendiente, recuperación/importación, límites de papelera y desconexión. La ronda anterior de 128 casos y ésta se informan por separado; no son 152 pruebas distintas.
- [CI del código final `007df9c` aprobada](https://github.com/ncvicchi/capibloques/actions/runs/34147121615): **112 pruebas Chromium**, 129 Django/PostgreSQL con persistencia tras recreación, auditoría sin vulnerabilidades informadas, dos sketches compilados para Wemos D1 R32 y build de ocho páginas aprobado. El build no publica el sitio.
- Readiness HTTP 200 y los tres contenedores saludables, sin OOM ni reinicios automáticos. Muestra final después de pruebas: editor ~852 MiB, API ~64 MiB y PostgreSQL ~28 MiB, dentro de sus límites existentes. No es una prueba de carga de una clase.

Para repetir las comprobaciones focalizadas contra la VM, con su túnel dedicado activo:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
npm run test:e2e -- tests/scene-recovery.spec.ts tests/project-history.spec.ts tests/project-offline.spec.ts --project=chrome --project=edge --workers=1 --max-failures=1
```

Las regresiones completas de fase 4 añaden `tests/capibloques.spec.ts`, `tests/project-autosave.spec.ts`, `tests/project-durable-recovery.spec.ts`, `tests/session-exit.spec.ts` y `tests/editor-access.spec.ts`. CI ejecuta además las restantes pruebas del producto. En DEV, `sudo sh scripts/verify-backend-dev.sh` comprueba el servidor sin recrear PostgreSQL.

No sustituye un backup fuera de la VM ni una prueba de apagón. El ensayo de restauración integral, retención de backups, aplicación de registros de eliminación al restaurar copias antiguas, carga concurrente y producción/HTTPS siguen en la Fase final, postergada. No se promete aislamiento físico del perfil del navegador ni recuperación de datos ya purgados sin un respaldo externo.

## Prueba del propietario al terminar

1. En un proyecto de prueba, guardar un nombre, cambiarlo y guardar otra vez. Desde Mis proyectos, exportar y restaurar una versión anterior; abrirla desde la biblioteca.
2. Agregar un LED en Armar escena y escribir su nombre sin Guardar cambios. Recargar, recuperar la escena pendiente y comprobar que el inspector conserva el nombre. Probar Cancelar y luego repetir con Guardar escena.
3. Exportar con escena pendiente e importar el archivo: debe ofrecer recuperación sin publicar la escena. El proyecto importado es una copia personal nueva.
4. Opcionalmente, interrumpir sólo la conectividad del navegador de prueba después de abrir un proyecto, continuar localmente y reconectar. No detener PostgreSQL ni modificar el router para esta prueba.

Detenerse al cerrar la fase 4. La próxima fase requiere nueva autorización: supervisión docente visual y devoluciones por versión.
