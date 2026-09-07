# Reglas de trabajo de CapiBloques

## Fases y autorización

- Trabajar una fase o subfase acotada por vez. Informar alcance al comenzar y dar actualizaciones breves durante el trabajo; no pasar largos períodos sin informar al propietario.
- Implementar, probar y entregar el resultado de la fase. No avanzar a la siguiente sin el OK del propietario. Informar pendientes o fallos sin presentarlos como completados.
- Hacer commit y push de los cambios versionables verificados de cada entrega. Si no se puede publicar, comunicarlo. No incluir cambios ajenos ni secretos.
- El plan principal es `docs/PLAN_MULTIUSUARIO_PROXMOX.md`; el estado de preparación está en `docs/FASE_0_SERVIDORES.md`. El plan no demuestra que las funciones estén implementadas.
- El entorno DEV completo y su recuperación están en `docs/FASE_1_BASE_REPRODUCIBLE.md`; usar ambos archivos Compose. `docs/FASE_0B_DESARROLLO.md` conserva la guía del túnel. Compose sólo en desarrollo, puerto loopback y túnel SSH dedicado. No mezclar el túnel de navegación con la sesión de administración ni arrancar un servidor alternativo para validar la VM.
- Secretos DEV fuera del checkout; no regenerarlos ante una pérdida ni borrar volúmenes para recuperar la base. El volumen persistente no sustituye un respaldo. El modelo propio es `accounts.User`; no introducir `auth.User` ni habilitar Django admin como sustituto del ABM solicitado.
- Acceso y operación en `docs/FASE_2A_ACCESO.md`. Las mutaciones de cuentas deben comprobar permisos del actor, usar `access_lock()` y métodos de instancia; no saltar revocación/último administrador mediante actualizaciones o borrados bulk. Identidad/roles no equivalen a permisos por curso/proyecto. El editor exige sesión y separa borradores locales por UUID de cuenta; no prometer protección contra acceso al perfil local del navegador.
- ABM administrativo entregado en `docs/FASE_2B1_USUARIOS.md`. Mantener permisos frescos dentro del bloqueo, versión contra sobrescrituras y auditoría sin contraseñas. Antes de añadir relaciones de cursos/proyectos, revisar la baja de cuentas: no introducir borrados en cascada sin conteo, respaldo y confirmación de los datos afectados. La ficha JSON actual no contiene proyectos ni restaura una cuenta.
- En LAN se puede usar `scripts/connect-dev.ps1 -DirectLan`, conservando loopback, host keys y túnel dedicado. En la VM limitada, detener sólo `editor` antes de actualizar código/dependencias, iniciar de nuevo y esperar salud antes de probar; no solapar HMR con despliegue/compilación. Ver incidente de memoria y procedimiento en 2B.1.
- Colegio/logo en `docs/FASE_2B2_COLEGIO.md`. Una institución por instalación. La única imagen PNG optimizada vive en PostgreSQL y su backup; no introducir archivos/rutas externas ni datos de alumnos en la API pública. Mantener validación/recodificación, límites antes del parser, permisos frescos bajo bloqueo, versión y auditoría atómica. La baja de una cuenta no borra la institución.
- Cursos/membresías en `docs/FASE_2B3_CURSOS.md`. Separar administración global de pertenencia docente. Alumnos no reciben padrones. Revalidar curso abierto, no sólo sesión. Mantener `access_lock()`, versión incluyendo estado de miembros, auditoría y FK PROTECT; no mutar membresías fuera del servicio sin estas garantías. Archivar no borra ni impide retiradas; para agregar, reactivar antes. Desactivar bloquea acceso pero conserva asignación; reactivar la restituye con nuevo ingreso. Bajas/cambios de rol incompatibles exigen retirar membresías explícitamente. Revisar nuevamente bajas al incorporar proyectos.

## Infraestructura y límites estrictos

- Biblioteca personal en `docs/FASE_3A_BIBLIOTECA.md`: Guardar manual en PostgreSQL, recuperación local separada. Todas las rutas exigen propietario, sesión/CSRF y precondición de cuenta; admin no lee trabajos privados ajenos. Preservar revisión optimista, replay ligado a acción/cuerpo, límites antes del parser, cuotas incluida papelera y auditoría atómica. JSON portable sin identidad del servidor. Importar/ejemplos/nuevo deben desvincular el editor después de confirmar reemplazo. No reactivar proyectos desde un guardado viejo. Sin purga ni borrado definitivo en 3A; FK PROTECT y baja de cuentas con proyectos bloqueada hasta respaldo/conteo/confirmación en 3B. No presentar el último UUID de operación como cola offline durable ni auditoría como historial restaurable. 3B (cursos/bajas) y 4 (autosave/historial) requieren otro OK.

- La infraestructura autorizada para preparar la aplicación son las VMs 112 (desarrollo, hostname `capi-dev`) y 113 (producción, hostname `capi-prd`). Confirmar identidad antes de mutaciones remotas.
- El gateway/bastión es EXCLUSIVAMENTE un salto SSH. PROHIBIDO ejecutar allí comandos de administración, instalar, reiniciar, editar archivos/configuración o copiar credenciales. Usar reenvío TCP SSH/ProxyJump sin sesión de comandos. No reenviar el agente SSH.
- No modificar el host Proxmox, router ni VM Nginx como efecto incidental de preparar las VMs. Cualquier trabajo futuro allí necesita una solicitud explícita y acotada; la prohibición de cambios en el gateway permanece vigente.
- No guardar contraseñas, tokens, claves privadas, sus rutas locales ni detalles del gateway en el repositorio, logs o documentación pública. Las credenciales se configuran fuera de Git.
- Avisar cuando Git esté disponible en las VMs para que el propietario autentique GitHub. No crear una cuenta del asistente ni copiar credenciales personales de desarrollo a producción.
- Respetar los recursos reales de las VMs. No aumentar asignaciones ni instalar toolchains pesadas sin corresponder a la fase. No convertir un contenedor privilegiado o acceso al socket Docker en un atajo.
- GitHub Pages deja de utilizarse por decisión del propietario; conservar CI y no reactivar publicación automática. No publicar en Sites ni crear recursos de hosting alternativos.

## Producto

- Conservar Arduino y agregar ESP-IDF como opciones. No reemplazar uno por otro.
- Flujo previsto: simular en navegador, compilar, descargar/grabar por USB y ejecutar autónomamente. No agregar control físico en vivo.
- Mantener exportación/importación JSON, compatibilidad de proyectos y pruebas existentes. Validar comportamiento y hardware por separado.
