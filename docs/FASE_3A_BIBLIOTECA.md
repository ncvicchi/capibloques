# Fase 3A: biblioteca personal y guardado manual

Guía histórica de esta entrega. Sus pruebas, contratos, pendientes y recetas describen ese momento. Consultar el [contexto vigente](CONTEXTO_PARA_CONTINUAR.md) para estado y autorizaciones, y la [operación vigente de DEV](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) para desplegar o mantener el entorno.

## Alcance

Subfase acotada de la fase 3. En el editor, **Guardar** sube una instantánea a PostgreSQL y **Mis proyectos** abre la biblioteca de la cuenta. Permite buscar, abrir, renombrar, duplicar, exportar JSON y enviar a papelera/restaurar. **Nuevo proyecto** crea una escena vacía con un bloque de inicio. Importar JSON conserva el importador v1/v2 existente y crea un trabajo independiente: nunca conserva el UUID de servidor del proyecto anterior.

Todas las cuentas —administrador, docente y alumno— tienen biblioteca personal. Administrar no concede lectura de proyectos ajenos. La vinculación a cursos y la supervisión no forman parte de esta entrega.

## Guardado y recuperación

- Autoguardado **local** existente, con debounce de 350 ms. El botón principal **Guardar** ahora escribe en servidor; el menú Exportar mantiene «Guardar sólo en este navegador».
- Estado visible: sólo local, guardando, confirmado en cuenta, cambios locales posteriores o resultado sin confirmar. Una respuesta no confirma cambios realizados después de tomar su instantánea.
- Antes de reemplazar un editor con cambios: Cancelar, Descartar cambios y abrir o Guardar y abrir. Esto también protege importaciones y ejemplos.
- La escena que todavía está abierta en «Armar escena» mantiene su propio Guardar/Cancelar; guardar el proyecto incluye la escena ya confirmada, no ese borrador de propiedades.
- JSON portable v2 sin propietario, curso, ID de servidor ni tokens. El servidor valida de nuevo estructura, tamaños y tipos; la conversión v1→v2 se realiza en el importador del navegador. Se permite guardar cableado incompleto para corregirlo después; la validación eléctrica sigue separada.
- Borrador local asociado por UUID de cuenta, en un sobre único `library-draft-v1` que contiene documento e identidad/revisión remota. Se conserva el borrador anterior `project-v2` como respaldo de transición. No asignar borradores de otra cuenta ni de alias reutilizados.
- No hay sincronización automática al servidor, historial de instantáneas ni cola offline durable aún. La recuperación de borradores de escena y el tratamiento completo de cierre/reinicio quedan para fase 4.
- Reintentos del guardado manual reutilizan el mismo UUID y contenido mientras permanece abierto el editor. Duplicar también conserva su intento hasta confirmar. Tras cerrar/reiniciar con un resultado incierto, revisar primero Mis proyectos; el registro de operaciones pendientes todavía no persiste entre aperturas. No prometer deduplicación de un nuevo intento creado después de recargar.
- Si falla el almacenamiento local, se puede guardar en servidor o exportar JSON. El almacenamiento del perfil del navegador no ofrece aislamiento frente a otra persona con acceso a ese mismo perfil.

## API y modelo

- `GET/POST /api/projects/`: listado personal paginado (20), búsqueda y alta con UUID elegido por el cliente.
- `GET/PUT /api/projects/<uuid>/`: abrir/exportar o guardar documento completo.
- `POST /api/projects/<uuid>/rename/`, `trash/`, `restore/`: cambios explícitos con revisión esperada.
- Sesión, CSRF, cuenta activa y permisos frescos dentro de `access_lock()`. La cabecera `X-Capi-Account` es una precondición contra cambios de cuenta en otra pestaña, **no** autorización por sí misma. Propietario siempre tomado de la sesión.
- Respuesta privada sin caché; proyecto ajeno y UUID desconocido responden igual. No hay rutas públicas de JSON ni lectura privada especial para administradores.
- Revisión entera optimista; un guardado desactualizado responde 409 y no sobrescribe. Los reintentos sólo repiten la última operación exacta, ligada al verbo, cuerpo y proyecto. Un reintento antiguo después de otras mutaciones se rechaza.
- Documento completo de hasta 2 MB; workspace hasta 1,5 MB y 2000 bloques. Lectura de cuerpo acotada antes del parser sólo en estas rutas; no se amplía el límite general de la API.
- Cuotas iniciales fijas: 100 proyectos y 50 MB por cuenta, incluida la papelera. No son ajustes administrativos ni una medida de capacidad concurrente. La concurrencia de compilación sigue pendiente de su fase.
- Auditoría atómica con actor/UUID de proyecto, revisión y acción; no contiene documentos ni contraseñas. No sustituye un historial restaurable de proyectos.

## Papelera y bajas de cuentas

Enviar a papelera no borra datos ni permite que un guardado viejo reactive el proyecto. Se puede exportar y restaurar. En 3A **no hay borrado definitivo ni purga automática**; no prometer todavía el plazo de 30 días previsto en el plan general. Al alcanzar una cuota no se borran trabajos automáticamente.

La relación de propietario es `PROTECT`. Mientras no exista la baja administrativa con conteo, respaldo y confirmación de proyectos, se rechaza eliminar cuentas que tengan proyectos, incluidos los de papelera. Se ofrece desactivarlas sin perder trabajos. La ficha administrativa JSON de la fase 2B.1 sigue sin ser un respaldo de proyectos. Resolver este flujo explícitamente en 3B, junto con la pertenencia a cursos.

## Operación DEV

Se mantiene la aplicación en `capi-dev`, API/PostgreSQL privados y frontend loopback mediante túnel SSH. Antes de la migración `projects.0001_initial`, se realizó un `pg_dump -Fc` local en el directorio privado de respaldos de la VM. Esa copia no ha sido restaurada ni está fuera de Proxmox; no equivale al plan de recuperación de producción.

Actualizar siguiendo el procedimiento existente: confirmar hostname, detener sólo `editor`, `git pull --ff-only`, comprobar/aplicar migraciones, reiniciar API si cambió código Python, arrancar con ambos Compose y esperar salud. No borrar volúmenes ni regenerar secretos. PRD, gateway, Nginx y hosting alternativos quedan intactos.

## Validación

Validado el 7 de septiembre de 2026. Código final `ad2204a`; [CI completo aprobado](https://github.com/ncvicchi/capibloques/actions/runs/34078851468).

- DEV: 97 pruebas Django aprobadas, `check`, migraciones coherentes y aplicadas. Los tests usan `test_capibloques`, no las cuentas del propietario. Incluyen cuatro proyectos reales generados por `makeProject`, privacidad entre roles/cuentas, CSRF, revocación, JSON inválido, cuotas, reintentos, revisiones y protección ante bajas.
- Chrome/Edge sobre la VM: ronda principal de 56 pruebas aprobadas en `24da248` (editor, sesión y biblioteca); después, 22 de biblioteca/recuperación aprobadas en `ad2204a`. Son rondas parcialmente repetidas, no 78 casos distintos.
- La última ronda cubre respuesta perdida, copia sin duplicación, rechazo corregible, cambios realizados durante el guardado, persistencia de esos cambios en el borrador local y Guardar y abrir sobre el mismo proyecto.
- CI final: 97 pruebas backend y 62 UI Chromium aprobadas; tipos, lint, smoke del editor/worker/historial, auditoría de dependencias, dos compilaciones Arduino para Wemos D1 R32 y build de siete rutas. No se probó carga física USB ni ESP-IDF, todavía fuera de esta fase.
- Inspección visual en Chrome: escritorio, 390 px y ampliación de texto al 200 %, sin desborde horizontal del diálogo y con salida operable. Corregido el selector de papelera que inicialmente quedaba debajo del diálogo. Se usa un selector nativo con etiquetas visibles en español.
- Playwright intercepta identidad/biblioteca sólo dentro de los contratos UI; no se agregó bypass al producto. La API y permisos se prueban separadamente con Django/PostgreSQL; la validación del propietario con cuentas reales permanece como punto de control.
- DEV terminó con API, base y editor saludables, cero reinicios automáticos; consumo observado aproximado: 66 MiB, 27 MiB y 921 MiB respectivamente. No es una prueba de capacidad para una clase concurrente. PRD no se activó.

## Punto de control para el propietario

1. En el editor, cambiar nombre, pulsar Guardar y abrir Mis proyectos.
2. Duplicar/renombrar una copia, enviarla a papelera y restaurarla.
3. Abrir el mismo proyecto desde otra sesión/navegador autenticado; exportar/importar una copia JSON.
4. Hacer un cambio local y elegir Nuevo proyecto: comprobar Cancelar y Guardar y abrir.

Detenerse aquí. La siguiente subfase propuesta es 3B (vínculos a cursos y baja administrativa con respaldo); requiere otro OK.
