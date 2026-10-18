# Flujo compartido: ramas, integración y actualización DEV

Acuerdo del 17 de octubre de 2026. Obligatorio para todas las personas y sesiones
de IA. Reemplaza desarrollo directo en main y el bloque largo manual de integración.

## 1. Desarrollar sin pisarse

- Crear una rama `codex/<tarea>` desde `origin/main` actualizado; nunca editar
  directamente main ni compartir rama entre tareas independientes.
- Usar clones/worktrees distintos para trabajo simultáneo. Alternar ramas en
  una carpeta no aísla las ediciones de dos personas.
- Conservar trabajo ajeno; no stash/reset/checkout forzado automático ni
  force-push. Si main avanza, integrarlo en la rama propia y verificar.
- `/home/capi/capibloques` es el checkout operativo de DEV, **no** un lugar para
  desarrollar. No adelantar su HEAD con pull/merge/switch antes de actualizar:
  el orquestador calcula mantenimiento desde ese HEAD.
- Commit/push de rama, documentación/contexto, pruebas y pendientes viajan
  juntos. Integrar no demuestra que DEV esté actualizado ni aceptación física.
- El propietario ejecuta la actualización salvo autorización expresa distinta.

## 2. Un único comando

Una vez instalada esta versión, usuario capi en capi-dev:

```bash
cd /home/capi/capibloques
./scripts/update-dev.sh --branch codex/mi-tarea
```

Obtiene la punta remota de esa rama, la integra en una copia separada, publica
main sin force-push y actualiza DEV. No adelanta el checkout operativo antes
del orquestador. Si ya estaba integrada, no crea otro merge y continúa la
actualización: sirve repetir tras un fallo de runtime.

Las entregas deben fijar el SHA exacto para no integrar cambios publicados en
esa rama después de la entrega:

```bash
./scripts/update-dev.sh --branch codex/mi-tarea --commit SHA_COMPLETO_DE_40_CARACTERES
```

Marcador ilustrativo: la entrega lo proporciona reemplazado. `--commit` es
opcional para uso humano y exige --branch. La rama debe existir en origin;
no puede ser main ni una expresión de revisión arbitraria.

- Normal/`--fast`: actualización directa, **sin esperar GitHub Actions**.
- `--full`: solicita y espera CI completa antes de modificar el runtime.
  La integración en main ya puede haberse publicado si esa CI falla.
- Sin --branch: actualiza origin/main, sin integrar otra rama.
- `--check-only`: audita main con el mecanismo existente; no admite --branch
  para no mezclar auditoría con publicación.
- `--help`: uso y opciones.

La primera instalación requiere cargar el actualizador nuevo desde la rama
de esta entrega: el viejo aún no conoce --branch. Se entrega un comando concreto
que lo ejecuta desde un archivo temporal. Hacerlo una vez y sin otro operador
actualizando durante esa transición. Después no repetir fetch/chown/pipelines
manuales antes del comando habitual. Windows `deploy-dev.ps1` también invoca
el actualizador instalado: reparación Git y fetch remoto quedan dentro del lock.

## 3. Exclusión mutua

`update-dev.sh` toma un `flock` no bloqueante **antes** de reparar permisos,
consultar/modificar el checkout, hacer fetch, integrar, push o actualizar.
Lo mantiene hasta terminar, incluso durante --full/--check-only. Integración
y actualización directa comparten el mismo bloqueo:

`/home/capi/.local/state/capibloques/dev-operation.lock`

Si otro proceso lo tiene, el segundo termina con código **75**, **DEV OCUPADO**,
PID, inicio y rama cuando están disponibles. No modifica el repositorio ni
ejecuta sudo ni se encola; repetir al terminar el primero. Esos datos son sólo
informativos: el archivo de información no decide si está ocupado.

**No borrar el .lock ni usar sudo para desbloquearlo.** El archivo es persistente;
el bloqueo vive en el descriptor del proceso y se libera al cerrarse. Eliminar
el archivo permitiría bloquear otro inode mientras el primero sigue activo.
No hay bandera stale basada sólo en PID ni unlock forzado.

Es exclusión local de quienes usan este script en DEV, no un bloqueo distribuido
de GitHub. Comandos manuales, el orquestador interno ejecutado a mano, scripts
viejos y pushes desde otro equipo no quedan serializados: todos deben adoptar
el flujo nuevo. Un push externo concurrente se rechaza o detecta; nunca se
resuelve con force-push. Tras corte/muerte forzada revisar procesos supervivientes
y mantenimiento antes de repetir; el lock no sustituye la recuperación de
`/var/lib/capibloques/dev-deploy.state`.

## 4. Fallos y recuperación

- Checkout sucio, otra rama local, operación Git pendiente, divergencia o SHA
  distinto: detener y conservar trabajo. No auto-stash/reset/rebase/switch.
- Conflicto: conserva el worktree temporal e imprime su ruta. Main/runtime no
  se publican/actualizan por ese intento. Resolver con el autor.
- Push rechazado: conserva la copia, no fuerza ni adelanta el runtime.
- Merge/push correctos, actualización fallida: informa que main ya se publicó
  y DEV no quedó confirmado. Repetir el comando; no deshacer el merge ni borrar
  el estado de mantenimiento para ocultar el fallo.
- Sólo tras push correcto retira su copia con `git worktree remove` sin force
  y `rmdir` de su directorio vacío. No borra ramas ni trabajo pendiente.
- No prometer ETA de build/CI: la hora de inicio del lock no predice el final.

## 5. Verificación y estado

`python scripts/test_update_dev.py -v` prueba el script real con Git temporal y
dos procesos; sustituye identidad/host/sudo por dobles locales. No conecta a
DEV ni ejecuta Docker. Cubre merge/push conservando HEAD operativo, reintento
ya integrado, SHA incorrecto, trabajo local, conflicto, rechazo de push, fallo
después de publicar, opciones/guardas y exclusión entre integrar/actualizar.

Implementación en `codex/integracion-dev-bloqueada`. Publicación no equivale a
instalación: la primera ejecución real queda a cargo del propietario.
