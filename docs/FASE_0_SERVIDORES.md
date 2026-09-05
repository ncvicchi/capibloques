# Fase 0A: preparación base de servidores

Fecha: 5 de septiembre de 2026.
Alcance: preparar y comprobar las dos VMs autorizadas, retirar GitHub Pages y conservar CI. No implementar funciones de aplicación ni desplegar servicios del proyecto todavía.

## Inventario comprobado

| Dato | VM 112: desarrollo | VM 113: producción |
| --- | --- | --- |
| Hostname | `capi-dev` | `capi-prd` |
| Sistema | Ubuntu Server 24.04.4 LTS | Ubuntu Server 24.04.4 LTS |
| CPU visible | 1 vCPU | 2 vCPU |
| RAM visible | 1,9 GiB (aprox. 2 GB asignados) | 1,9 GiB (aprox. 2 GB asignados) |
| Swap existente | 2,0 GiB | 2,0 GiB |
| Filesystem raíz | 31 GiB | 31 GiB |
| Libre después de preparación | Aproximadamente 24 GiB | Aproximadamente 24 GiB |

No se aumentó CPU, RAM, disco ni swap. Con estos recursos no se presume una capacidad de compilación determinada: se empieza con una compilación y mínimo paralelismo interno, se mide y luego se ajusta. Node y los toolchains ESP32 se prepararán en las fases correspondientes, sin llenar ahora ambas VMs de dependencias que aún no se usan.

Las direcciones privadas, endpoint y clave del gateway, contraseñas y claves Git no se publican en este documento. Acceso mediante reenvío TCP SSH exclusivamente: no se ejecutaron comandos ni se cambió configuración en el gateway. Tampoco se modificaron host Proxmox, router o VM Nginx.

## Herramientas y acciones realizadas

Git, OpenSSH, Python base, certificados y curl ya estaban instalados. Se informó al propietario que Git estaba disponible; luego el propietario configuró autenticación por SSH a GitHub.

Se instalaron en ambas VMs, desde los repositorios Ubuntu ya configurados:

```bash
sudo apt-get install -y --no-install-recommends \
  docker.io docker-compose-v2 python3-venv gh
```

Se verificó el hostname antes de cada comando de modificación y se limitaron las operaciones a `capi-dev` y `capi-prd`. No se hizo `autoremove`, no se agregaron repositorios externos de paquetes y no se instaló Arduino IDE.

| Herramienta | Versión observada en ambas VMs |
| --- | --- |
| Git | 2.43.0 |
| OpenSSH Server | 9.6p1, paquete Ubuntu `1:9.6p1-3ubuntu13.19` |
| Python | 3.12.3, con módulo `venv` disponible |
| Docker Engine | 29.1.3, paquete Ubuntu `29.1.3-0ubuntu3~24.04.2` |
| Docker Compose | 2.40.3, paquete Ubuntu `2.40.3+ds1-0ubuntu1~24.04.1` |
| GitHub CLI | 2.45.0, paquete Ubuntu `2.45.0-1ubuntu0.3` |

La instalación agregó los servicios estándar Docker/containerd. Docker se utiliza con `sudo`; no se agregó el usuario al grupo Docker, no se configuró una API Docker TCP ni se publicaron puertos de contenedores.

Ambas VMs tenían `/var/run/reboot-required` después de las actualizaciones previas. Se reiniciaron únicamente esas VMs, se volvió a entrar por SSH y se verificó que ese aviso ya no existiera. El gateway no se reinició.

## Pruebas de aceptación realizadas

- Acceso SSH a cada VM usando el gateway únicamente como salto, antes y después del reinicio, con comprobación de hostname.
- `systemctl is-active docker`: `active`; `systemctl is-enabled docker`: `enabled`, después del arranque.
- Versiones de Git, Python, Docker y Compose; `python3 -m venv --help` disponible. La creación del entorno Python de la aplicación pertenece a la siguiente fase, no se considera probada aquí.
- Ejecución real en ambas VMs:

  ```bash
  sudo docker run --rm --network none --memory 64m --cpus 0.5 \
    --pids-limit 32 hello-world
  ```

  Resultado: `Hello from Docker!` y salida 0. La descarga la realizó Docker desde Docker Hub; el contenedor se ejecutó sin red y fue eliminado al terminar. Digest observado: `sha256:5dd0d3e6e255913fc30f90b9f2b1d359cc2cbdb48090cc4b65f1676e203243cc`. La imagen pequeña de prueba queda en caché. `sudo docker ps -q` no mostró contenedores activos.

- Después del aviso del propietario, consulta Git SSH de sólo lectura en ambas VMs:

  ```bash
  GIT_SSH_COMMAND='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10' \
    git ls-remote git@github.com:ncvicchi/capibloques.git HEAD
  ```

  Ambas devolvieron el HEAD que existía al probar: `da526ad4e4901590aa05a8d11bf1c74b9bfa6de4`, con salida 0. Esto prueba autenticación y lectura; no se realizó un push de prueba desde las VMs ni se inspeccionaron ni copiaron claves privadas. GitHub CLI no está autenticado y no es necesario hacerlo para usar Git por SSH.

- No se clonó aún el repositorio en las VMs: el checkout y el entorno remoto se harán en la subfase 0B, después del OK del propietario.

## Retiro de GitHub Pages y CI

- Se retiró el sitio de Pages mediante la API de GitHub del repositorio autorizado. La API de Pages devuelve 404, el repositorio informa `has_pages: false` y la URL pública devuelve HTTP 404.
- El código y el historial del repositorio se conservan. La despublicación es reversible con autorización del propietario; no se reactiva automáticamente.
- `.github/workflows/ci.yml` reemplaza al workflow de publicación: conserva tipos, lint, smoke, audit, Chromium E2E, ambos fixtures compilados con Arduino-ESP32 3.3.11 y build. Añade validación en pull requests a `main` además de push/manual.
- Permisos del workflow: sólo `contents: read`. Sin environment de Pages, permisos Pages/OIDC, subida de artefacto Pages ni acción de despliegue.
- No se cambió el generador ni el runtime de la aplicación. Se mantiene por ahora el ajuste existente de rutas relativas del build.
- Comprobaciones locales de esta entrega: YAML válido y presencia de todos los checks, ausencia de publicación, `git diff --check`, typecheck, lint, smoke y build correctos. El resultado del CI remoto queda asociado al commit en GitHub Actions; no se sustituye por las pruebas locales.
- Las reglas permanentes por fase y el límite estricto del gateway quedaron en `AGENTS.md`. Los cambios versionables de esta entrega se publican mediante el Git ya autenticado de la PC de trabajo, sin trasladar esas credenciales a las VMs.

## Punto de control y pendientes

La preparación base está comprobada y Git SSH ya fue validado en ambas VMs. Detenerse aquí antes de 0B; el propietario debe aprobar continuar.

Actualización posterior: el propietario aprobó 0B. Su entorno, pruebas y recuperación se documentan por separado en [FASE_0B_DESARROLLO.md](FASE_0B_DESARROLLO.md). Los resultados anteriores corresponden al cierre de 0A y se conservan como registro histórico.

Pendiente de la siguiente subfase o de su fase correspondiente:

1. Checkout remoto y configuración de identidad Git de desarrollo según el propietario; no copiar credenciales a producción ni dar por probado permiso de escritura remota.
2. Entorno reproducible del editor con Node compatible, dependencias y acceso de prueba restringido. No hay aplicación corriendo todavía en las VMs.
3. Separación backend/base y datos de prueba en fase 1; toolchains Arduino/ESP-IDF en su fase de compilación.
4. Dominio, certificado y proxy Nginx en su fase autorizada, sin nuevas reglas en el router.
5. Antes de exponer la aplicación: backups fuera del host, revisión de accesos y sustitución de credenciales temporales. No se cambiaron contraseñas ni se deshabilitó acceso SSH por contraseña en esta entrega.

Esta fase no certifica rendimiento del compilador ni seguridad de producción: verifica la base instalada sin ampliar el alcance al desarrollo de la aplicación.
