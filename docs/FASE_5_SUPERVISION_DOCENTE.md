# Fase 5: supervisión docente

Guía histórica de esta entrega. Sus pruebas, contratos, pendientes y recetas describen ese momento. Consultar el [contexto vigente](CONTEXTO_PARA_CONTINUAR.md) para estado y autorizaciones, y la [operación vigente de DEV](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) para desplegar o mantener el entorno.

Fecha: 7 de septiembre de 2026. Estado: **implementada y verificada en DEV; lista para validación del propietario**. No habilita las fases posteriores 6–11: experiencia/programación, mensajes/pantalla, Arduino/ESP-IDF, compilación, USB y producción/piloto.

## Recorrido de uso

1. El administrador crea cuentas docentes/alumnos y los asigna a sus cursos desde Gestionar cursos. Tener administración no concede acceso pedagógico a trabajos privados: necesita además rol docente y asignación al curso.
2. El alumno guarda su proyecto y lo comparte explícitamente desde Mis proyectos → Elegir curso. Inscribirlo no comparte su biblioteca entera.
3. El docente entra en Mi cuenta → Mis cursos → Ver curso. Puede filtrar por alumno y buscar por título. Ve sólo los proyectos compartidos, su versión y la fecha del último guardado en servidor. La vista se actualiza cada 15 segundos mientras está visible; también tiene actualización manual.
4. «Revisar…» abre una pestaña independiente. La revisión no monta el editor personal ni toca sus borradores, IndexedDB, autoguardado o proyecto abierto.
5. El visor presenta bloques y escena de sólo lectura. Puede simular, pausar, avanzar un paso, reiniciar, cambiar velocidad/entradas de sensores y activar sonido opcional. Esas entradas sólo afectan a la prueba local. Ocultar la pestaña, perder acceso o desmontar el visor detiene y retira el worker y los sonidos; volver exige verificar permiso nuevamente y reinicia la prueba.
6. La versión queda fijada. Un guardado posterior muestra «Hay una versión más reciente» y no cambia el programa revisado ni reinicia una simulación activa. Elegir otra versión con textos pendientes requiere confirmar su descarte.
7. El docente escribe una devolución breve sobre esa versión. El alumno la abre desde Mis proyectos → Ver devoluciones (otra pestaña), responde y puede marcarla atendida o volver a dejarla pendiente. Guardar respuesta y estado es una operación conjunta; Cancelar no publica cambios.
8. La conversación puede mostrar todas las versiones o sólo la abierta. «Ver versión… de esta devolución» abre el contexto protegido. Cada respuesta muestra su fecha de actualización. Una cuenta docente eliminada aparece sin nombre/alias, conservando el texto.

No hay captura de pantalla, pulsaciones, cambios sin guardar, calificaciones, tareas formales ni edición colaborativa en vivo.

## Copias y exportación

- JSON: descarga la versión elegida, no el último guardado que llegue después. Revalida permiso antes de descargar. No contiene cuentas, cursos, comentarios, operaciones remotas ni procedencia administrativa; sigue siendo el formato portable v2 (el importador anterior mantiene v1/v2).
- Arduino: reutiliza el generador y validación Wemos D1 R32. Conserva la guía de cableado y chequeo previo para circuitos físicos. La revisión de conexiones se repite al cambiar de versión; no certifica seguridad eléctrica por sí sola. ESP-IDF, binarios y grabación USB siguen pendientes de sus entregas.
- «Crear mi copia personal»: requiere confirmación y guarda en la biblioteca del actor, sin curso, comentarios ni historial del alumno. No reemplaza su editor. La biblioteca muestra procedencia (título original, versión y nombre de curso), separada del JSON portable y sin identidad de cuenta ajena.
- Reintentar una copia con la misma identidad no la duplica. La copia tiene identidad propia y no conserva permiso ni dependencia del original.
- Exportaciones y copias ya realizadas no pueden revocarse retroactivamente. La interfaz lo explica.

## Contrato de acceso

Todas las rutas de revisión usan el mismo `access_lock()` de las operaciones de cuenta, cursos y guardado. Bajo ese bloqueo se comprueba sesión/época, cuenta activa, contraseña definitiva, `X-Capi-Account`, propiedad y membresías actuales; las escrituras requieren CSRF. Respuestas privadas `no-store`.

| Situación | Lectura/revisión | Devolución/respuesta | Cambiar original |
| --- | --- | --- | --- |
| Propietario | Sus proyectos y versiones | Responde si el curso está activo y conserva membresía de alumno | Sólo mediante sus rutas personales y permisos anteriores |
| Docente asignado | Sólo proyectos activos compartidos al curso, de alumnos activos/asignados | Inicia devoluciones si el curso está activo | Nunca |
| Administrador sin asignación docente | No obtiene acceso a trabajos ajenos por su rol | No | No |
| Otro alumno/docente de otro curso | No | No | No |
| Curso archivado | Conserva lectura autorizada | No admite nuevos mensajes ni respuestas | Original bloqueado; copia personal permitida |
| Retirada del alumno o docente | El docente pierde acceso en las siguientes solicitudes | No | El alumno conserva el trabajo; puede hacer copia personal |
| Proyecto en papelera | Sólo propietario | No | Rige la recuperación/purga de fase 4 |

El cliente sondea permiso con la vista visible, revalida al regresar y descarta respuestas tardías de una sesión/vista anterior. Una revocación confirmada limpia documento, conversación y texto pendiente. Un corte o respuesta incompleta bloquea la vista y termina la simulación, pero conserva los textos en memoria para reintentar con la misma cuenta. No existe revisión docente offline ni autenticación sin conexión.

## Versiones y conservación del contexto

- `ProjectRevision.course` registra el contexto al guardar; no se deduce del curso actual. Las versiones anteriores a la migración 0004 quedan sin contexto y siguen siendo privadas del propietario. No se asigna retrospectivamente un curso a todo su historial.
- El visor utiliza `POST versions/N/` para conservar una instantánea de la versión actual antes de inspeccionarla. No cambia documento, revisión del proyecto ni identidad del guardado pendiente. Es idempotente por proyecto/número de versión y respeta la cuota de historial.
- `GET versions/N/` descarga sólo una instantánea ya conservada y autorizada. Una versión de otro contexto y una inexistente reciben el mismo error de versión no disponible; no se entrega otro documento en su lugar.
- Una devolución referencia una instantánea mediante FK `PROTECT` y la fija (`pinned`) en la misma transacción. Los comentarios sobre N conservan N mientras se guarda N+1. Las podas de historial y borrados individuales de versiones no pueden retirarla.
- Una revisión **sin devolución enviada** sigue sujeta a la retención del historial. Si se elimina o poda mientras estaba abierta, el visor detiene la prueba, conserva el texto pendiente y obliga a elegir otra versión explícitamente; no publica el texto sobre contenido distinto. No promete conservar indefinidamente una inspección sin comentario.
- Un proyecto con devoluciones no puede cambiar de curso ni pasar a Personal mediante reasignación. Para otro contexto se crea una copia sin conversaciones. El original conserva la relación y sus permisos; retirar membresías sigue revocando acceso.
- Abrir/restaurar una versión propia conserva las protecciones de fase 4. El docente no tiene endpoints de restauración, borrado ni «editar como alumno».

## Mensajes, reintentos y límites

- Texto plano, sin HTML interpretado ni adjuntos: hasta 1000 caracteres por devolución y por respuesta. El docente inicia hasta 50 devoluciones por proyecto. Cuota de contenido de mensajes: 10 MB por biblioteca, adicional a las cuotas de documentos/historial. Ningún límite descarta trabajos automáticamente.
- El texto de la devolución enviada y su versión son inmutables. Para una aclaración, el docente envía otra devolución. El alumno puede actualizar su respuesta y estado con un número de versión optimista; otra pestaña no se sobrescribe silenciosamente.
- Creación con UUID idempotente ligado a actor/proyecto/contenido; respuesta con UUID de operación y versión. Reintentos de resultado incierto conservan la identidad. La consulta posterior reconoce una devolución cuyo envío se confirmó en servidor pero cuya respuesta se perdió.
- Los formularios muestran Enviando/Guardando, deshabilitan acciones incompatibles, mantienen texto frente a errores y advierten antes de salir con cambios. **No autoguardan borradores de comentarios ni respuestas**: permanecen en memoria de esa pestaña durante un corte, no sobreviven a cerrarla o recargarla. Cancelar un formulario no revierte mensajes ya publicados.
- Los endpoints de mensajes limitan el cuerpo antes de parsear; validan forma, caracteres, duplicados y valores. Los errores no incluyen contenido privado de otro proyecto.

## Bajas, purga y respaldo

- La purga exacta del proyecto, confirmada por nombre/revisión y protegida por los 30 días de papelera, elimina explícitamente sus devoluciones, respuestas e historial antes del proyecto. Su confirmación muestra que también se pierde la conversación. El JSON portable no es respaldo de comentarios.
- El respaldo privado de baja de cuenta pasa a manifiesto v2. Incluye `projects/`, `history/`, `feedback/` y hashes. Los snapshots comentados están en el historial; las conversaciones son JSON separados con su versión y autor vigente. No se incorporan a los JSON importables.
- La vista previa cuenta versiones, devoluciones, bytes e intervenciones que se anonimizarán. La firma del respaldo cambia si cambia una respuesta, estado o identidad visible de sus autores. El ZIP sigue ligado a administrador, época, cuenta, versión y vencimiento del recibo.
- Al eliminar un alumno se retiran explícitamente sus proyectos y conversaciones. Al eliminar un docente, sus intervenciones en trabajos ajenos **conservan el texto y se anonimiza su autor**, sin borrar ni exportar los proyectos de los alumnos. Se elimina la relación de autor, no se detectan ni retiran nombres que alguien haya escrito dentro del texto libre. La baja antigua y `User.delete()` no omiten la preparación de esas relaciones.
- Siguen vigentes desactivar primero, retirar membresías, impedir borrar el último administrador, respaldo/consentimientos y transacción. No se probaron borrados sobre cuentas o trabajos reales de DEV.
- El respaldo tiene techo comprobado de 50 MB actuales + 50 MB de historial + 10 MB de contenido de mensajes, con margen acotado de metadatos. Se genera de a un documento por vez en el `/tmp` de 128 MiB ya existente. El cliente admite hasta 120 MB para no rechazar respaldos válidos de historial. No se ampliaron los recursos de la VM.
- El ZIP permite importar trabajos como nuevos proyectos y consultar conversaciones por separado; no restaura automáticamente la cuenta, membresías o conjunto de historial/conversación.

## Operación DEV

Migración aditiva `projects.0004_supervision`: procedencia opcional en proyecto, contexto de curso en historial, tabla de devoluciones. No reescribe documentos ni atribuye cursos históricos desconocidos.

Antes de aplicarla se detuvieron editor/API y se generó un `pg_dump -Fc` privado de la base existente, fuera de Git, con permisos restringidos. Se comprobó que no estuviera vacío y que `pg_restore --list` pudiera leerlo. Esto **no es un ensayo de restauración ni una copia fuera de la VM**; ambos siguen pendientes antes del piloto real.

En esta entrega, el desarrollo continuó sólo en la VM `capi-dev`, con backend/base internos y acceso por el túnel dedicado a localhost. No se tocó producción, Proxmox, gateway, router o Nginx. No se reactivó Pages ni se publicó en otro hosting. No hubo cambios de credenciales ni cuentas reales.

## Validación

- Tipos, lint, pruebas de núcleo/simulador y build: correctos; nueve páginas estáticas con assets verificados. Persiste la advertencia no bloqueante de algunos chunks superiores a 500 kB.
- Backend en PostgreSQL real de prueba, separado de los datos DEV: 149 pruebas correctas (22,077 s). Incluye tres pruebas con conexiones/hilos concurrentes: guardado + comentario sobre N, revocación + comentario, doble envío idempotente. Comprueba también aislamiento entre cursos, endpoints personales vedados al docente, contexto legacy, cuotas, CSRF, respuestas, purga y bajas/respaldo.
- Primera regresión dirigida a la VM: 32 pruebas de supervisión, 16 en Chrome y 16 en Edge, correctas sin reintentos. Incluye móvil de 390 px con texto al 200%, recuperación de cortes, respuestas incompletas y versiones retiradas.
- CI del código desplegado `24223a0`: [ejecución 34155534640](https://github.com/ncvicchi/capibloques/actions/runs/34155534640), correcta. 149 pruebas backend; 128 de interfaz Chromium sin casos flaky; tipos, lint, pruebas de núcleo/worker, auditoría npm, dos sketches compilados para `esp32:esp32:d1_uno32` con ESP32 3.3.11 y build estático. No constituye prueba física en placa.
- La regresión local detectó una carrera en el test de cableado: `locator.all()` enumeraba cero casillas antes de montarse el diálogo bajo demanda. La traza confirmó que no intentaba marcar ninguna. Se agregó espera del conteo esperado, sin modificar el comportamiento ni relajar la protección de la aplicación. El recorrido completo pasó tres veces consecutivas en Chrome y tres en Edge (6/6, 55,5 s).
- Regresión ampliada contra DEV: 116 casos de cuentas, cursos, biblioteca, historial, acceso y supervisión, en Chrome/Edge. Terminó con 115 correctos y el único fallo de sincronización del test descrito arriba (13,9 min). Tras corregirlo, se repitió toda la suite de supervisión: **32/32 correctos, 16 por navegador, sin reintentos (2,5 min)**. No se atribuye un 116/116 a la primera ejecución fallida.
- Inspección visual de escritorio 1440 px y móvil 390 px con texto al 200%; el selector de versiones no desborda la pantalla. Las pruebas UI utilizan cuentas/respuestas sintéticas dentro de Playwright; la suite backend prueba permisos y persistencia reales sobre la base de pruebas separada.
- Salud al cierre: editor/API/PostgreSQL saludables, `/api/health/ready/` devuelve `status: ok`, sin contenedores OOM ni reinicios automáticos. El último commit de cierre sólo cambia documentación y sincronización del test; no modifica el runtime validado por el CI enlazado. El CI que dispare ese push es una ejecución nueva, no la evidencia enlazada aquí.

### Validación propuesta al propietario

Con cuentas de prueba creadas por el administrador: asignar un docente y un alumno a un curso, compartir un proyecto, dejar una devolución sobre N, guardar N+1, responder y marcar atendida. Confirmar que la devolución sigue abriendo N y que hacer una copia docente no cambia el original. No hace falta conectar una Wemos para validar esta fase.
