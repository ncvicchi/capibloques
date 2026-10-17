# Flujo compartido: ramas, integración y actualización DEV

Acuerdo del propietario del 17 de octubre de 2026. Aplica a todas las personas
y sesiones de IA. Sustituye para trabajo nuevo las instrucciones históricas que
publicaban tareas directamente en main. No modifica los scripts existentes.

## 1. Desarrollar sin pisarse

- `main`: línea integrada; no editar ni hacer commits de tareas directamente.
- Una rama `codex/<nombre-de-tarea>` por trabajo. No compartir rama entre tareas
  independientes. Los commits se publican en esa rama, sin force-push.
- Antes de empezar: leer AGENTS/contexto, revisar `git status`, actualizar refs
  con `git fetch origin` y crear la rama desde `origin/main`. Si hay trabajo
  pendiente, conservarlo; no cambiarle la rama ni hacer stash automáticamente.
- Personas/IA simultáneas: clones o worktrees distintos. Dos ramas no aíslan
  ediciones si se alternan sobre la misma carpeta física.
- No usar `/home/capi/capibloques` para desarrollar: es el checkout operativo.
  En DEV, usar un worktree/copia de desarrollo aparte con rama propia; sin
  instalar ni arrancar servicios que reemplacen el runtime público.
- Llevar a la rama los cambios recientes de main antes de entregar y verificar
  lo afectado. Preferir merge de `origin/main` para ramas ya compartidas; no
  reescribir commits publicados sin coordinación.
- Conservar las verificaciones proporcionales al cambio. `--fast` no espera
  GitHub Actions; `--full` es opcional. No quitar guardas de datos o cableado
  para integrar más rápido.

## 2. Entrega de cada tarea

Publicar rama y dar al propietario: nombre, SHA exacto, alcance, pruebas,
pendientes y comando listo para ejecutar en DEV que incluya integración y
actualización. La documentación/contexto viajan en la misma rama.

Una rama publicada no significa integrada; un merge publicado no significa
DEV actualizado; sólo la confirmación final del actualizador acredita la
activación. No declarar aceptaciones físicas/humanas por pruebas locales.

## 3. Integrar antes de actualizar, pero fuera del checkout operativo

El propietario ejecuta el comando. Debe comprobar que su checkout operativo
está limpio y en main, traer main y la rama, verificar el SHA anunciado,
mezclar en un worktree separado, publicar el resultado y después invocar
`update-dev.sh`. Las integraciones/actualizaciones DEV se hacen de a una.

**No ejecutar `git merge`, `git pull` ni `git switch` para adelantar el checkout
operativo antes de actualizar.** `deploy-dev-remote.sh` usa su HEAD como base
del diff que detecta migraciones, dependencias y cambios del compilador. Hacer
el merge allí primero puede ocultarle ese mantenimiento. Un worktree aparte
permite integrar sin cambiar el HEAD ni los archivos que usa ese cálculo.

Plantilla de comando para Ubuntu, usuario capi, sin sudo global. Reemplazar
`rama` y `revision` con los valores exactos de la entrega; no ejecutar esos
marcadores literalmente. El asistente debe entregarla ya completada, no pedir
al propietario que adivine nombres o hashes:

```bash
bash <<'BASH'
set -euo pipefail
rama='codex/NOMBRE-DE-LA-TAREA'
revision='SHA-COMPLETO-DE-LA-ENTREGA'
repo=/home/capi/capibloques
[[ $(hostname) == capi-dev && $(id -un) == capi ]] || { echo 'Usar capi en capi-dev'; exit 1; }
cd "$repo"
[[ $(git branch --show-current) == main ]] || { echo 'El checkout operativo no está en main; no se cambió'; exit 1; }
[[ -z $(git status --porcelain) ]] || { git status --short; echo 'Hay trabajo local; no se cambió'; exit 1; }
for estado in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  [[ ! -e $(git rev-parse --git-path "$estado") ]] || { echo "Operación Git pendiente: $estado"; exit 1; }
done
git fetch origin
[[ $(git rev-parse --verify "refs/remotes/origin/$rama^{commit}") == "$revision" ]] || { echo 'La rama no coincide con la entrega; revisar'; exit 1; }
git merge-base --is-ancestor HEAD origin/main || { echo 'main local diverge; revisar sin reset'; exit 1; }
git config user.name >/dev/null
git config user.email >/dev/null
integracion=$(mktemp -d /home/capi/capibloques-integracion-XXXXXX)
printf 'Copia de integración: %s/worktree\n' "$integracion"
git worktree add --detach "$integracion/worktree" origin/main
git -C "$integracion/worktree" merge --no-ff --no-edit "$revision"
git -C "$integracion/worktree" push origin HEAD:refs/heads/main
git worktree remove "$integracion/worktree"
rmdir "$integracion"
git fetch --quiet origin main
git show origin/main:scripts/update-dev.sh | bash -s -- --fast
BASH
```

El actualizador conserva su propia comprobación de limpieza/identidad y avanza
el checkout operativo mediante fast-forward cuando corresponde. Si sólo se
modificó documentación, el propietario puede integrar sin ejecutar el último
comando: no se requiere reconstruir la aplicación por documentación.

## 4. Si algo falla

- **Cambios locales:** listar archivos y coordinar con su autor. No descartar,
  incorporar cambios ajenos, guardarlos en stash ni hacer commits por sorpresa.
- **Operación Git pendiente:** resolver o cancelar deliberadamente en la copia
  correspondiente antes de continuar. No saltar el bloqueo del actualizador.
- **Conflicto de merge:** el bloque se detiene antes de publicar o actualizar.
  La ruta impresa conserva el worktree para resolución. No se borra al fallar;
  no resolver con `ours`/`theirs` automáticamente.
- **Push rechazado:** pudo avanzar main en otra sesión. No force-push; revisar
  lo nuevo, integrar y verificar de nuevo. El runtime no fue adelantado.
- **Merge publicado y actualización fallida:** main puede contener la tarea,
  pero la aplicación todavía no estar activada. Corregir según el error y
  reintentar el actualizador habitual, sin borrar su estado de mantenimiento.
- No restaurar un stash sin examinar qué contiene y quién lo creó.
- No borrar ramas compartidas ni worktrees con trabajo pendiente. La plantilla
  sólo retira la copia temporal después de merge y push satisfactorios.

La plantilla tiene las comprobaciones descritas, no es un nuevo comando ya
instalado. El script actual por sí solo sigue tomando origin/main y **no hace
merge de ramas**. Si se automatiza esta plantilla en un script futuro, conservar
estas guardas y probar conflictos, concurrencia y fallos antes de publicarlo.

## Estado de esta entrega documental

Publicada inicialmente en `codex/flujo-compartido-ramas`. No se integró a main
ni se operó DEV desde esta sesión. Hasta integrarla, las otras personas deben
consultar esta rama/documento explícitamente; no suponer que su AGENTS local
ya contiene el acuerdo.
