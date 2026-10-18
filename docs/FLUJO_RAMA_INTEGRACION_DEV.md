# Flujo compartido: main, dev1 y dev2

Acuerdo vigente del 17 de octubre de 2026. **Sustituye** el flujo anterior en
el que `--branch` publicaba main directamente. Obligatorio para ambas personas
y cualquier IA. Implementación: rama `codex/ambientes-dev1-dev2`.

**Instalado y verificado en DEV (17/18 de octubre):** ambos dominios HTTPS
activos, servicios habilitados, copia inicial autorizada de los 542 registros
de aplicación (30 usuarios / 13 proyectos / 53 versiones), mismos accesos del
original. No volver a ejecutar el bootstrap ni crear administradores iniciales.
No hubo integración en main ni cambios en sus contenedores/configuración/vhost.
Evidencia detallada en el contexto vivo; los apartados de instalación se conservan
para recuperación, no son tareas todavía pendientes en estos dos ambientes.

## Ambientes en capi-dev

| Ambiente | Rama permanente | URL HTTPS | Recuperación local | LAN, sólo edge |
| --- | --- | --- | --- | --- |
| Integrado actual | main | capibloques.dev.nvicchi.com | 127.0.0.1:3000 | 192.168.1.77:3080 |
| Nuestro trabajo | dev1 | capibloques.dev1.nvicchi.com | 127.0.0.1:3001 | 192.168.1.77:3081 |
| Otro desarrollador | dev2 | capibloques.dev2.nvicchi.com | 127.0.0.1:3002 | 192.168.1.77:3082 |

No son tres frontends sobre una misma API: cada ambiente tiene API, PostgreSQL,
redes, secretos, sesiones, proyectos, volúmenes, artefactos y cola propios.
**No se copian cuentas/datos de main.** Main conserva checkout, configuración,
servicios, base y URL actuales. PRD, gateway, Proxmox y router no se modifican.
DNS corresponde al propietario; HTTPS requiere además instalar los vhosts y
certificados independientes en la VM Nginx 192.168.1.38.

## Instalar una vez, sin integrar main

En capi-dev, como `capi`, cuando nadie esté actualizando:

```bash
cd /home/capi/capibloques
git fetch origin codex/ambientes-dev1-dev2
git worktree add --detach /home/capi/capibloques-setup origin/codex/ambientes-dev1-dev2
bash /home/capi/capibloques-setup/scripts/setup-environments.sh
```

El instalador bloquea operaciones, drena el compilador de main, reemplaza su
runner compatible y restaura su admisión original; **no detiene su web/API**.
Es la única intervención compartida necesaria. No reconstruye SDKs ni publica
main. Crea dev1/dev2 desde esta revisión sólo si no existen; nunca los fuerza.
Instala el comando `/home/capi/.local/bin/capi-dev`. Si el worktree ya existe,
no borrarlo ni forzarlo: revisar su revisión y reutilizarlo si corresponde.

Crear/iniciar cada ambiente, por separado:

```bash
~/.local/bin/capi-dev --env dev1
~/.local/bin/capi-dev --env dev2
```

La primera actualización construye las imágenes, migra una base vacía y
habilita sus servicios persistentes. Crear un administrador independiente:

```bash
sudo python3 /opt/capibloques-environments/manage.py admin dev1
sudo python3 /opt/capibloques-environments/manage.py admin dev2
```

Contraseña interactiva, nunca argumento ni Git. Las colas nuevas nacen
**pausadas**, igual que la instalación original: el administrador las habilita
cuando corresponda. Reglas/firmware intérprete no requieren abrir la cola.
Reutilizar nombres no comparte identidad/cuentas entre sitios.

### Copia inicial autorizada de los datos actuales

El propietario autorizó después copiar **todos los datos de la aplicación**
a ambos ambientes: colegio/logo, usuarios con sus claves actuales, cursos,
proyectos, versiones y devoluciones. Es una copia inicial, no sincronización.
La excepción no copia secretos, sesiones, recetas, colas ni binarios privados.

```bash
sudo python3 /home/capi/capibloques-setup/ops/environments/seed.py dev1 --copy-main-data
sudo python3 /home/capi/capibloques-setup/ops/environments/seed.py dev2 --copy-main-data --snapshot /var/lib/capibloques-environments/seeds/ARCHIVO_DE_LA_PRIMERA_COPIA.json
```

El primer comando informa sólo conteos y la ruta privada, nunca usuarios,
hashes ni proyectos. Reutilizar ese snapshot para que ambos partan del mismo
punto. Verifica modelos/migraciones/dependencias compatibles, destino sin usuarios/cursos/proyectos y toma
el bloqueo común. Snapshot consistente `REPEATABLE READ, READ ONLY`, archivo
root 0600 fuera de Git, importación transaccional y conteos contrastados.
Guarda `seeded-from-main.json`; una repetición no vuelve a sobrescribir.
Un destino con datos propios se rechaza, no se vacía ni se mezclan sus usuarios.
Los administradores copiados evitan tener que ejecutar `bootstrap_admin`.

## Trabajar en ramas de tarea

Cada persona usa su clon/worktree. Nuestro trabajo parte de `origin/dev1`;
el otro, de `origin/dev2`, y crea `codex/<tarea>` con nombre único. No desarrollar
en main, las ramas permanentes o `/home/capi/capibloques`; no cambiar la rama
de la carpeta que usa otra persona. Documentación, contexto y pruebas viajan
en los mismos commits. Publicar la rama de tarea, no integrarla manualmente.

Actualizar sólo nuestro endpoint, integrando la tarea ya publicada:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/mi-tarea --commit SHA40
```

El otro desarrollador usa `--env dev2`. Sin `--branch` actualiza la punta de la
rama permanente elegida. El SHA completo opcional evita integrar una entrega
que cambió desde que fue revisada. `--branch` sin dev1/dev2 es **error**, no
atajo a main. El merge usa un worktree temporal y push sin force; nunca cambia
la rama ni adelanta HEAD del checkout operativo de main.

## Promover sólo por pedido explícito

Una vez conforme con las pruebas en el endpoint elegido:

```bash
~/.local/bin/capi-dev --promote dev1
```

O dev2. Comprueba salud e imágenes activas, obtiene su revisión instalada y
exige que siga siendo la punta remota del ambiente. Puede fijarse también
`--commit SHA40`. No promueve una rama que avanzó sin actualizar/probar ni un
ambiente con mantenimiento incompleto. Crea el merge en main, hace push sin
force y recién entonces invoca el actualizador existente del endpoint actual.

**No copia bases de datos**, no promueve usuarios/proyectos y no actualiza el
otro ambiente. Si main recibió cambios del otro desarrollador, integrarlos
primero en la rama de tarea, actualizar y volver a probar: no existe sync o
resolución automática de conflictos. La conformidad humana es un acuerdo del
equipo; el script verifica la revisión técnica, no que alguien haya probado UI.

Actualizar main ya publicado, sin integrar ninguna rama: `~/.local/bin/capi-dev`.
`--fast` es normal y no espera GitHub Actions; `--full` solicita/espera CI antes
del runtime (el merge ya puede estar publicado). `--check-only` no publica ni
actualiza: para dev1/dev2 exige que la revisión remota esté activa y saludable;
main conserva la auditoría original. No combinar con rama/promoción.

Desde Windows: `scripts/deploy-dev.ps1 -Environment dev1 -Branch codex/mi-tarea`
fija HEAD remoto; `-Environment dev2` actualiza ese ambiente y `-Promote dev1`
promueve explícitamente. Requiere el instalador previo y SSH privado existente.

## Recursos, servicios y recuperación

- Un flock común antes de Git/sudo protege instalación/integración/actualización.
  Otro operador recibe **75 / DEV OCUPADO**, sin cola ni modificaciones.
  `/home/capi/.local/state/capibloques/dev-operation.lock` nunca se elimina.
  Comandos antiguos/manuales/pushes externos no participan: adoptar todos el
  comando instalado. Git jamás corre como root, tampoco para diagnosticar.
- Las tres colas mantienen datos separados. Compilaciones y builds del editor
  comparten `/run/capibloques-build.lock`: **un trabajo pesado físico a la vez**,
  aunque cada administrador ajuste su concurrencia. Un runner sólo reconcilia
  sus contenedores; los antiguos de main sin etiqueta conservan identidad main.
  Un huérfano vivo impide nuevas construcciones, no se asume muerto por lease.
- Reutiliza SDK/cores de `capibloques-compiler-dev:phase9`, con capas pequeñas de
  generador por revisión. Toolchain/dependencias del generador distintas exigen
  mantenimiento explícito; no se recicla una receta incompatible. Firmware sin
  cambios copia bundles con árbol/hash/tamaño verificados; los cambios usan
  `/home/capi/capibloques-envs/interpreter-cache` incremental compartida, sin
  borrar `outputs` de main. Sus compilaciones privadas nunca usan esa caché.
- Cada ambiente suma API (tope 256 MiB), PostgreSQL (128 MiB) y editor (64 MiB),
  más runner; son límites, no consumo medido. La VM es pequeña: medir presión
  real tras instalar; no prometer tres builds simultáneos. Exige 4 GiB libres.
- Releases separadas: `/home/capi/capibloques-envs/dev1/<SHA>` y dev2; no editar.
  Configuración raíz: `/etc/capibloques/environments/<env>/`; estado, respaldos
  y artefactos: `/var/lib/capibloques-environments/<env>/`. Guardar copias privadas.
  No borrar secretos ante pérdida; no borrar volúmenes. Las releases/respaldo
  PostgreSQL no se podan automáticamente en esta primera entrega; vigilar disco.
- Servicios: `capibloques-dev1.service`, `capibloques-dev2.service` y
  `capibloques-compiler-dev1.service`/dev2. Inician en reboot; firewall propio
  antes de publicar editor. Redes estáticas distintas se validan por colisión.
- Respaldo `pg_dump -Fc` y `pg_restore --list` antes de migrar. Fallo conserva
  `pending.json` y respaldo, no toca main. Repetir el mismo comando/revisión;
  otro objetivo se rechaza hasta resolver. No hay rollback automático de SQL
  ni `down -v`. Fallo tras migrar puede dejar sólo ese ambiente detenido.
- Un conflicto/push rechazado conserva worktree y no actualiza runtime. Fallo
  tras push informa la rama publicada. No reset/stash/rebase/force automáticos.
  El informe final muestra ambiente, revisión y éxito/fallo; nunca ETA inventada.

## Nginx y DNS, instalación explícita

El propietario crea dev1/dev2 apuntando al mismo acceso público existente.
Copiar al edge `ops/environments/install_edge.py` y `ops/public-dev/` (renderer
y dos plantillas), conservando estructura; no necesita instalar el repo completo.
Conocer la **raíz ACME existente** del sitio actual (no adivinarla):

```bash
sudo python3 ops/environments/install_edge.py http --acme-root /RUTA_ACME_EXISTENTE
```

Admite únicamente la VM con IP 192.168.1.38. Instala dos archivos propios en
`/etc/nginx/sites-enabled/zz-capibloques-dev1.conf`/dev2; rechaza dominios definidos en otros
archivos. Conserva main y certificados ajenos, respalda sólo sus archivos,
valida `nginx -t` y restaura ante fallo de prueba/reload. Usa HTTP 80 / HTTPS
interno 8443, configurables si la instalación real difiere. Imprime comandos
Certbot separados; después de emitirlos ejecutar el mismo comando con `https`.
Se cargan después de los sitios anteriores para conservar el servidor TLS por
defecto. La versión inicial usó conf.d; la migración automática admite sólo
sus dos archivos con contenido idéntico, respaldados y sin sobrescribir otros.
No pide ni acepta un certificado de otro dominio. DNS/ACME deben funcionar
antes de esa segunda etapa. Verificar externamente ambos login, cookies,
guardado independiente y que main sigue respondiendo antes de darlo por activo.

## Evidencia y límites de esta entrega

Pruebas locales: historias Git reales, conflictos, rechazo de push, fallo tras
publicar, repetición, separación de ramas, promoción sólo de punta instalada y
flock concurrente. Contratos adicionales: configuración aislada, secretos no
regenerados, revisión/imágenes activas, reutilización de firmware, despacho y
reconciliación de colas; aislamiento previo del compilador y contratos public-dev.
No equivalen a instalar/testear Docker/systemd/iptables/TLS en la VM.

**Instalación real posterior autorizada:** Linux, DNS, Nginx/certificados,
servicios y copia inicial completados; HTTP login/health y contenido copiado
verificados. No se publicó main. Quedan aceptación humana del editor/login,
compilación avanzada por ambiente, medición sostenida, reboot y promoción real
controlada; no confundir esas aceptaciones con los chequeos HTTP realizados.
