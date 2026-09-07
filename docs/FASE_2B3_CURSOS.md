# Fase 2B.3 · Cursos y membresías

Alcance autorizado por el propietario: administrar cursos, asignar docentes y alumnos y ofrecer «Mis cursos». Implementado y probado en DEV. No incluye biblioteca ni revisión de proyectos. Producción no activada.

## Uso

- Mi cuenta → Gestionar cursos: crear, buscar, editar nombre/descripción y preparar miembros. Guardar aplica todo junto; Cancelar/Escape permiten seguir editando o descartar. Recargar advierte si hay cambios pendientes.
- Buscar personas consulta cuentas activas por nombre/alias, de a 20. Agregar/Quitar sólo modifican el borrador. «Restaurar selección guardada» deshace los cambios de membresías. No crea cuentas ni cambia roles.
- Máximo 200 miembros por curso; nombre único sin distinguir mayúsculas (hasta 100 caracteres), descripción de una línea de hasta 500. Varios docentes, alumnos en varios cursos, cursos temporalmente vacíos o sin docente permitidos con advertencia.
- Archivar es reversible y no elimina datos. Conserva lectura de miembros autorizados; impide incorporaciones. Permite retirar miembros. Para volver a incorporar, guardar primero la reactivación. Filtros Activos/Archivados/Todos.
- Mi cuenta → Mis cursos: sólo cursos asignados. Docentes ven el padrón de sus cursos; alumnos no reciben identidades ni conteos de compañeros. Administrador sin asignación docente no recibe acceso pedagógico automático.

## Contratos y protección

- PostgreSQL: `courses.Course`, `Membership`, `CourseEvent`. UUID de curso, unicidad curso/usuario, función docente/alumno y auditoría con identificadores, sin contraseñas ni contenido de proyectos.
- Administración: `/api/management/courses/` GET/POST, `/<uuid>/` GET/PATCH. Lectura personal: `/api/courses/` GET y `/<uuid>/` GET. No hay DELETE de curso.
- Lecturas y escrituras revalidan actor bajo `access_lock()`, compartido con las mutaciones de cuentas. CSRF, sesiones y cambio obligatorio de contraseña siguen vigentes. Un curso ajeno y uno inexistente devuelven el mismo 404.
- Guardado transaccional de metadatos, membresías y auditoría. Versión HMAC que contempla la versión del curso y los nombres/estado de sus miembros. Una pestaña desactualizada recibe 409 y no sobrescribe.
- Retirar membresía revoca en la siguiente petición aunque la sesión siga vigente. La pantalla revalida el detalle abierto al recuperar foco, visibilidad y cada 15 segundos; bloquea durante incertidumbre y limpia datos ante revocación/cambio de identidad. No promete retirar copias ya descargadas.
- Desactivar una cuenta conserva asignaciones, pero revoca sesión y excluye del padrón docente; el administrador ve la cuenta marcada inactiva. Reactivarla restituye su pertenencia existente, con nuevo ingreso. Restablecer contraseña no borra membresías.
- Cambiar un rol incompatible exige retirar primero esas membresías, también de archivados. Eliminar una cuenta con membresías se rechaza con explicación; FK PROTECT como segunda defensa. No se introducen cascadas sobre datos de cursos. La auditoría sobrevive a la baja de su actor.
- Toda futura escritura de membresías debe usar el mismo bloqueo, reglas y auditoría. El ORM no sustituye los permisos de API. Antes de agregar proyectos, ampliar nuevamente la política de bajas y respaldos.

## Operación y validación

- Respaldo PostgreSQL previo a migrar en el directorio privado habitual de DEV. No es todavía un respaldo fuera de la VM ni un ensayo de restauración.
- Detener sólo editor antes de actualizar código; aplicar la migración aditiva `courses/0001_initial`; reiniciar API/editor y esperar salud. Sin nuevas dependencias, sin aumento de recursos y sin cambios en PRD/gateway.
- Pruebas nuevas: aislamiento entre dos docentes y alumno compartido, permisos directos, revocación, archivo/reactivación, validación, conflictos, CSRF, integridad/auditoría y protección de bajas. UI: selección, guardar/cancelar, restauración, archivo, pérdida de permiso/conexión, vistas por rol y teléfono con texto ampliado.
- DEV: 83 pruebas Django/PostgreSQL correctas, migración aplicada sin divergencia de modelos, servicios saludables y sin reinicios automáticos. Respaldo previo generado fuera de Git; no se crearon cursos/cuentas ficticias en la base real.
- Chrome + Edge contra el túnel de DEV: 20 pruebas de cursos (incluidas dos verificaciones anónimas contra la API real); 28 regresiones de cuentas/ABM/acceso al editor. Las mutaciones de las pruebas UI usan respuestas simuladas; permisos y persistencia reales se prueban en la base PostgreSQL de test, no con la contraseña del propietario.
- Tipos, lint, smoke del simulador/JSON/historial y build estático correctos. El build verifica también `/cursos/` y `/gestion/cursos/` y sus assets desde raíz.
- La prueba de texto al 200% detectó desborde del título con las fuentes del runner Linux; corregido limitando el encabezado y permitiendo ajuste. No se eliminaron comprobaciones ni ampliaron tiempos/reintentos. Se agregó también una prueba de salida con una petición pendiente: la continuación no revalida una pantalla ya desmontada.
- [CI final de `46457cf`](https://github.com/ncvicchi/capibloques/actions/runs/34068577280): **correcto**, backend y frontend; 51 pruebas de interfaz Chromium, comprobaciones estáticas/auditoría de dependencias, dos sketches compilados para Wemos D1 R32 y build. Cierre documental posterior sin cambios de código.

Siguiente fase propuesta: 3, biblioteca de proyectos y guardado manual en servidor. Requiere nuevo OK.
