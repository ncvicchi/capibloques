# Fase 1: base reproducible en desarrollo

Fecha: 6 de septiembre de 2026. Alcance: editor existente + API Django mínima + PostgreSQL persistente en `capi-dev`. **No implementa cuentas, roles, biblioteca ni guardado servidor.** Producción permanece sin aplicación. Gateway usado sólo como salto TCP SSH; Proxmox, router y Nginx no se modificaron.

Evidencia histórica de fase 1. El acceso y las migraciones de cuentas incorporados después se documentan en [fase 2A](FASE_2A_ACCESO.md); sus comandos operativos extienden esta guía. La receta con ambos Compose sigue vigente.

## Entorno comprobado

| Servicio | Versión observada | Acceso y límites |
| --- | --- | --- |
| editor | Node 22.23.2, dependencias del lockfile | Sólo `127.0.0.1:3000` de la VM; 1 CPU, 1280 MiB RAM |
| api | Python 3.12.14, Django 5.2.17 LTS, Gunicorn 26.2.0 | Puerto interno 8000; 0,5 CPU, 256 MiB RAM, 1 worker/2 threads |
| db | PostgreSQL 17.11 | Puerto interno 5432; 0,5 CPU, 256 MiB RAM, máximo 20 conexiones |

Las tres imágenes base están fijadas por digest; Python usa dependencias exactas. `compose.dev.yaml` conserva el editor; **añadir `compose.backend.dev.yaml`** incorpora API/base y configura el proxy `/api/` del editor. Sin esa variable, el editor independiente conserva su comportamiento anterior.

- La base está en una red Docker `internal`; API y base no publican puertos en el host. No requieren nuevos túneles ni reglas del router.
- API no root, raíz y código de sólo lectura, sin capacidades ni socket Docker. Tiene únicamente la clave Django y contraseña del rol de aplicación; no la administrativa de PostgreSQL.
- El rol `capibloques` es propietario de su base para migraciones, pero no superusuario ni creador de bases/roles. La credencial administrativa sólo se monta en `db`.
- El código backend se monta desde `./backend:/app:ro`. Gunicorn no tiene recarga automática: después de editar Python hay que reiniciar API; si cambian dependencias o Dockerfile, reconstruir la imagen.
- Volumen persistente `capibloques-dev_pgdata`; la única migración de aplicación actual es `sessions.0001_initial`. Se evita instalar el usuario estándar de Django antes del modelo propio de fase 2.
- Cookies HttpOnly/SameSite, CSRF activo, DEBUG desactivado, hosts permitidos limitados. Cookies Secure/HTTPS y configuración pública quedan para despliegue; **esta configuración es sólo DEV privado por SSH**.

Referencias: [Django 5.2 y despliegue](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [imagen oficial PostgreSQL](https://hub.docker.com/_/postgres). Las versiones y límites anteriores también se verificaron en ejecución.

## Secretos y datos

Los tres archivos de secretos están en `/home/capi/.config/capibloques-dev`, fuera del checkout y del montaje del editor. El directorio es `0700`; los archivos `0444` permiten leer los montajes a los distintos UID de los contenedores, sin hacer accesible el directorio a otros usuarios del host. Los valores no se versionan ni se imprimen. Compose recibe rutas de archivo, no contraseñas en sus variables de entorno.

**Sólo en una instalación nueva, sin una base existente**, ejecutar como `capi`:

```bash
python3 scripts/init_dev_secrets.py /home/capi/.config/capibloques-dev
```

El script conserva un conjunto completo válido y rechaza conjuntos parciales, enlaces de archivo y destinos dentro del repositorio o ancestros. No es un mecanismo de rotación: PostgreSQL sólo usa los secretos de inicialización cuando su volumen está vacío. Si se pierden los secretos con una base ya creada, **restaurarlos desde una copia segura**, no generar otros ni borrar la base. Si falta todo el directorio, el script por sí solo no puede detectar la existencia del volumen.

El volumen resiste la recreación de contenedores, **no es un backup**. Aún no hay copia automatizada fuera de Proxmox ni procedimiento de restauración integral ensayado; deben estar listos antes de guardar trabajo real de alumnos. Los proyectos del editor siguen en el navegador y se transportan con JSON, no en PostgreSQL.

## Actualizar o recuperar el entorno actual

Entrar por SSH a la VM de desarrollo, no al gateway. Conservar cambios locales; detenerse si el checkout no está limpio. En esta VM ya existen secretos y volumen: el bloque siguiente **no genera ni rota credenciales**.

```bash
(
  set -eu
  test "$(hostname)" = capi-dev
  cd /home/capi/capibloques
  test -z "$(git status --porcelain)"
  git pull --ff-only origin main
  dc() { sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml "$@"; }
  dc config --quiet
  dc pull editor db
  dc stop editor
  dc run --rm --no-deps editor npm ci --no-audit --no-fund
  dc build api
  dc up -d --wait --wait-timeout 120 db
  dc stop api
  dc run --rm -T api python manage.py migrate --noinput
  dc up -d --wait --wait-timeout 180 api editor
  dc ps
)
```

Detener editor antes de instalar evita cambiar `node_modules` en uso y libera memoria durante la construcción. Si falla un paso, el bloque se detiene; corregir la causa y repetir, sin reset/force, `down -v`, borrado del checkout ni limpieza global de Docker. Las migraciones son explícitas, no ocurren automáticamente al arrancar API. Esta receta es para DEV, no para aplicar futuras migraciones destructivas a producción sin respaldo/revisión.

Para consultar estado, ver logs acotados o reiniciar únicamente API después de editar Python:

```bash
sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml ps
sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml logs --tail 40 api db
sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml restart api
```

Desde Windows usar `scripts/connect-dev.ps1` como en [fase 0B](FASE_0B_DESARROLLO.md#conectarse-desde-windows), manteniendo un túnel dedicado separado de la sesión administrativa. No hay un servidor alternativo en la PC:

- Editor: `http://localhost:3000/`.
- API viva, independiente de la base: `http://localhost:3000/api/health/live/`.
- API y base listas: `http://localhost:3000/api/health/ready/` → `{"status":"ok"}`.

`ready` devuelve 503 genérico si la base no responde. No expone versiones, credenciales ni detalles de errores. Las rutas de cuentas y administrador aún no existen.

## Evidencia y pruebas repetibles

En DEV, con API/base migradas:

```bash
python3 scripts/test_init_dev_secrets.py
sudo sh scripts/verify-backend-dev.sh --restart
```

El primer comando prueba el bootstrap con archivos temporales, no con credenciales de la instalación. El segundo ejecuta ocho pruebas Django y prepara una base separada `test_capibloques` usando el administrador de PostgreSQL; **no concede CREATEDB a la API**. Conserva esa base de pruebas en DEV. `--restart` interrumpe brevemente API/base, recrea sus contenedores y compara el registro real de migración antes/después. Omitirlo para probar sin recreación.

Resultados de esta fase:

- Ocho pruebas backend: salud real de PostgreSQL, fallo genérico, métodos/hosts/rutas, secretos obligatorios, rol limitado y lectura/escritura de sesión técnica.
- Persistencia comprobada tras recrear API y PostgreSQL: mismo timestamp de la migración, sin ejecutar migraciones durante la recreación. Esto no equivale a un guardado de proyectos, aún inexistente.
- Caída real controlada de `db`: `ready` → 503; `live` y editor → 200. Al levantar la base, `ready` volvió a 200 sin reiniciar el editor.
- Diez pruebas dirigidas a la VM por túnel: cinco en Chrome y cinco en Edge, sin reintentos. Incluyen API del mismo origen, protección de métodos/rutas, arrastre y persistencia local, importación/exportación JSON y ejecución de ejemplo.
- Typecheck, lint, tres smoke tests y build local correctos. CI verifica además Chromium, auditoría npm, compilación Arduino para Wemos y backend con PostgreSQL real/recreación. Sigue sin publicar Pages.

Para repetir el subconjunto de navegadores desde PowerShell con Chrome/Edge instalados y el túnel activo:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
$env:PLAYWRIGHT_API = '1'
npm run test:e2e -- --project=chrome --project=edge --workers=1 --grep 'base privada|arrastra bloques|exporta y vuelve|abre un ejemplo' --max-failures=1
```

Muestra puntual tras calentar el editor: editor ~721 MiB, API ~67 MiB, PostgreSQL ~21 MiB; VM con ~775 MiB disponibles, 38 MiB de swap usados y 22 GiB de disco libres. **No es una prueba de carga ni garantía de concurrencia**; los límites agregados tampoco reservan memoria para el sistema. No se instalaron compiladores pesados en las VMs.

## Próxima fase, pendiente de OK

Fase 2: identidad, cuentas administradas, roles administrador/docente/alumno y sus pruebas de permisos, según el plan. Esta entrega no cambia el diseño del editor ni exige una validación funcional nueva del propietario; opcionalmente puede abrir el editor y el indicador `ready`. No habilitar producción ni comenzar otra fase automáticamente.
