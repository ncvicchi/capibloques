# Fase 3B: proyectos de curso y bajas con respaldo

Guía histórica de esta entrega. Sus pruebas, contratos, pendientes y recetas describen ese momento. Consultar el [contexto vigente](CONTEXTO_PARA_CONTINUAR.md) para estado y autorizaciones, y la [operación vigente de DEV](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) para desplegar o mantener el entorno.

## Alcance y límites

El alumno elige explícitamente el curso de cada proyecto guardado desde **Mis proyectos → Elegir curso**. No se comparten todos los trabajos de la cuenta por inscribirla a un grupo. Los proyectos anteriores siguen siendo personales. Importar, duplicar y recuperar un JSON crean trabajos personales independientes, sin conservar el ID del servidor ni compartir automáticamente.

Los docentes asignados ven y descargan el JSON de los trabajos de alumnos activos de ese curso desde **Mi cuenta → Mis cursos → Ver curso**. No pueden sobrescribir originales. Un administrador global no tiene ese acceso por ser administrador: necesita también rol docente y membresía en el curso. Los alumnos no reciben proyectos de compañeros. El visor de revisión y las devoluciones por versión permanecen en fase 5; no es todavía la supervisión completa.

Archivar un curso o retirar al alumno conserva el original pero bloquea modificarlo, renombrarlo o reasignarlo. El propietario puede exportar, duplicar como personal, enviar a papelera o restaurar. Un curso archivado sigue siendo legible para su docente asignado; retirar al docente revoca esa lectura. Retirar o desactivar al alumno oculta sus proyectos a los docentes; reactivar/reasignar recupera acceso cuando se cumplen nuevamente las condiciones. Cambiar de curso o volver a Personal revoca la lectura anterior. Ninguna revocación puede borrar archivos que una persona ya descargó.

La asignación opera sobre la versión **guardada**, no sobre cambios locales pendientes. Incrementa la revisión; el editor abierto debe recargar la versión del servidor o guardar una copia, sin adoptar ciegamente la nueva revisión. La interfaz verifica el contexto periódicamente, pero toda autorización se vuelve a comprobar en servidor en cada petición.

## Baja administrativa

La nueva pantalla **Gestionar usuarios → Eliminar** exige:

1. Cuenta inactiva y sin membresías, incluidos los cursos archivados. Primero desactivar y retirar explícitamente las asignaciones; no hay cascada automática.
2. Conteo de proyectos activos, papelera y bytes. Preparar el respaldo es una excepción administrativa explícita a la privacidad de la biblioteca, no un explorador de trabajos privados.
3. Si hay proyectos, generar y recibir un ZIP completo; el navegador verifica su SHA-256 antes de habilitar la confirmación. Confirmar la finalidad privada del respaldo y comprobar que el archivo quedó guardado en Descargas.
4. Advertencia sobre borradores locales no incluidos, confirmación irreversible y alias exacto. Cancelar no elimina datos.

El ZIP contiene un manifiesto, instrucciones y un JSON portable por proyecto, incluidos los de papelera, con checksum individual y contexto de curso en el manifiesto. No contiene contraseñas, sesiones, borradores del navegador ni historial. Recuperación: crear o usar una cuenta e importar cada JSON; se generan nuevas identidades personales. **No restaura automáticamente la cuenta original ni sus membresías**. No sustituye un respaldo integral de PostgreSQL y secretos.

El recibo firmado de respaldo dura 10 minutos, vinculado al administrador, época de sesión, cuenta y versión exacta de sus datos/proyectos. Cambiar alguno de esos datos obliga a preparar otro respaldo. Prueba que el servidor generó ese ZIP; no prueba que una persona conserve el archivo en su disco. La baja atómica audita UUIDs y elimina exclusivamente los proyectos contados y la cuenta, manteniendo protecciones de último administrador y relaciones. Auditoría no es historial restaurable.

Compatibilidad: la ruta antigua de DELETE administrativo sigue disponible sólo para cuentas sin proyectos y con sus confirmaciones originales. No permite saltarse el respaldo si hay trabajos. Toda la UI usa el nuevo flujo, incluso sin proyectos. No existe aún purga automática ni borrado definitivo individual de proyectos.

## Contratos e infraestructura

- `Project.course`: FK nullable `PROTECT`; migración `projects.0002_project_course`.
- `GET /api/projects/courses/`: cursos activos elegibles del alumno.
- `POST /api/projects/<uuid>/course/`: cuenta, CSRF, revisión y operación vinculada a acción/cuerpo; asignar o retirar.
- `GET /api/projects/<uuid>/?metadata=1`: contexto privado actualizado sin transferir el documento.
- `GET /api/courses/<uuid>/projects/` y `.../projects/<uuid>/`: listado paginado/búsqueda y JSON, sólo docente asignado. No hay escrituras docentes.
- `GET/DELETE /api/management/users/<uuid>/deletion/`: preparar o confirmar la baja explícita.
- `POST .../deletion/backup/`: consentimiento, versión, ZIP y recibo; sesión/administrador frescos, CSRF y precondición `X-Capi-Account`.
- Mutaciones y lecturas privadas nuevas bajo `access_lock()`, sin caché. La cabecera de cuenta no sustituye autorización.
- Cuotas existentes: 100 proyectos / 50 MB incluida papelera. ZIP temporal anónimo, un documento por vez; no se escribe en el checkout ni queda una copia permanente en servidor. `/tmp` de la API pasa de 32 a 128 MiB, **dentro del mismo límite de memoria de 256 MiB**; no se aumentó RAM de la VM. Dos respuestas lentas pueden ocupar temporalmente ambos hilos de API. Si no hay recursos para crear el respaldo, se rechaza sin eliminar datos; no es una prueba de capacidad para una clase.

Antes de migrar DEV se generó un `pg_dump -Fc` privado en la VM, comprobado no vacío. Esa copia no se restauró ni se trasladó fuera de Proxmox. Se detuvo sólo editor antes de actualizar código, se comprobó la migración y se recreó API para aplicar su tmpfs. Secretos, cuentas existentes, PRD, gateway, Nginx y Pages no se modificaron por estas operaciones.

## Validación

Validación del 7 de septiembre de 2026. Código final de esta subfase: `a859cec`; [CI completo aprobado](https://github.com/ncvicchi/capibloques/actions/runs/34127701292).

- DEV: 118 pruebas Django/PostgreSQL aprobadas en `f16590f`, más `check`, coherencia y estado de migraciones. El último ajuste `a859cec` sólo modifica el estilo del diálogo de baja. Se prueban dos docentes con un alumno en ambos cursos, vínculos explícitos, archivo/retiradas, lecturas y escrituras prohibidas, CSRF, revisión/replay, recibos vencidos/adulterados/de otro actor, fallos de respaldo y rollback de baja. Los ZIP se abren, se verifican sus checksums y se importan sus documentos bajo identidades nuevas.
- Navegadores contra DEV: 44 contratos de cursos/usuarios/asignación aprobados en Chrome y Edge sobre `e6fed08`; ronda final de 32 pruebas de biblioteca/recuperación/cursos/respaldo aprobada en `a859cec`. Las rondas se superponen: no son 76 casos diferentes. Incluyen descartar una respuesta de contexto anterior a un guardado confirmado y conservar cambios hechos durante peticiones pendientes.
- Inspección visual: compartir curso, listado docente y respaldo en escritorio; diálogo de baja a 390 px y texto al 200 %, con Cancelar alcanzable y sin desborde horizontal. Se corrigieron los márgenes del pie del diálogo, sin esconder contenido ni ampliar tolerancias del test.
- Tipos, lint y smoke del editor/worker/historial aprobados; auditoría de dependencias sin vulnerabilidades informadas. CI final: 118 pruebas backend y 67 UI Chromium aprobadas, dos sketches compilados para Wemos D1 R32 y build con ocho rutas verificadas. El CI sólo verifica: no publica en Pages.
- DEV: API, PostgreSQL y editor saludables, sin OOM ni reinicios automáticos. Observación durante las pruebas: aproximadamente 62, 26 y 887 MiB respectivamente. No se midió la capacidad de una clase concurrente ni se grabó hardware físico.

Los tests de eliminación usan cuentas sintéticas en `test_capibloques`; no se borró una cuenta real para probar. Los contratos UI interceptan respuestas sólo en Playwright; no hay bypass de autenticación en el producto. La validación manual del propietario con sus cuentas sigue siendo el punto de control.

## Punto de control

1. Con un alumno asignado: guardar una copia de prueba y elegir su curso.
2. Con su docente: abrir Mis cursos y descargar el JSON. Verificar que no aparece un trabajo personal del mismo alumno.
3. Volver el proyecto a Personal y actualizar el curso del docente: debe dejar de aparecer.
4. Como administrador, revisar el conteo y Cancelar la baja. Para probar eliminación, utilizar exclusivamente una cuenta de prueba prescindible, nunca un alumno real.

Detenerse tras entregar y pedir validación. La siguiente fase es **4: autoguardado en servidor, recuperación e historial**, requiere otro OK.
