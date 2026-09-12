# Fase 1: base reproducible en desarrollo

Fecha: 6 de septiembre de 2026. Alcance: editor existente + API Django mínima + PostgreSQL persistente en `capi-dev`. **No implementa cuentas, roles, biblioteca ni guardado servidor.** Producción permanece sin aplicación. Gateway usado sólo como salto TCP SSH; Proxmox, router y Nginx no se modificaron.

**Evidencia histórica del 6 de septiembre de 2026.** El acceso y las migraciones de cuentas incorporados después se documentan en [fase 2A](FASE_2A_ACCESO.md). Desde el 12 de septiembre, la web/API de DEV se operan según [fase 13: operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente), con runtime estático, systemd, firewall, tres Compose y configuración pública privada. Las recetas de Node/HMR y dos Compose de fase 1 fueron sustituidas. No usar `verify-backend-dev.sh --restart` sobre DEV actual: ese modo no carga la configuración pública al recrear API/base.

## Entorno comprobado al cerrar fase 1

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

El volumen resiste la recreación de contenedores, **no es un backup**. Aún no hay copia automatizada fuera de Proxmox ni procedimiento de restauración integral ensayado; deben estar listos antes de guardar trabajo real de alumnos. En fase 1 los proyectos del editor sólo vivían en el navegador; la biblioteca PostgreSQL se incorporó después, sin sustituir la exportación JSON.

## Actualizar o recuperar DEV

Seguir exclusivamente la [operación vigente de fase 13](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) para estado, actualización, migraciones y recuperación de web/API. La receta de fase 1 instalaba dependencias dentro del antiguo editor Node y arrancaba servicios con dos Compose; ya no corresponde al runtime actual. `capibloques-dev-runtime` conserva la configuración privada y coordina web con systemd/firewall; no iniciar `editor` manualmente.

Entrar por SSH a `capi-dev`, nunca ejecutar comandos en el gateway. Conservar cambios locales y revisar el árbol antes de actualizar. Las migraciones siguen siendo explícitas y requieren revisar su alcance y respaldo; no se ejecutan automáticamente al arrancar API. No usar reset/force, `down -v`, borrado del checkout, limpieza global de Docker ni regeneración de secretos para recuperar el entorno.

La entrada normal es el HTTPS de fase 13. Para recuperación desde Windows se conserva `scripts/connect-dev.ps1` como en [fase 0B](FASE_0B_DESARROLLO.md#conectarse-desde-windows), con túnel dedicado separado de la sesión administrativa. No hay un servidor alternativo en la PC:

- Editor: `http://localhost:3000/`.
- API viva, independiente de la base: `http://localhost:3000/api/health/live/`.
- API y base listas: `http://localhost:3000/api/health/ready/` → `{"status":"ok"}`.

`ready` devuelve 503 genérico si la base no responde. No expone versiones, credenciales ni detalles de errores. En el cierre histórico de fase 1 aún no existían rutas de cuentas; se incorporaron después.

## Evidencia y pruebas repetibles

Para comprobar sin recrear los servicios de DEV, con API/base migradas y dentro de una verificación autorizada:

```bash
python3 scripts/test_init_dev_secrets.py
sudo sh scripts/verify-backend-dev.sh
```

El primer comando prueba el bootstrap con archivos temporales, no con credenciales de la instalación. El segundo ejecuta la suite backend vigente y prepara una base separada `test_capibloques` usando el administrador de PostgreSQL; **no concede CREATEDB a la API**. Conserva esa base de pruebas en DEV. Las ocho pruebas y el ensayo con recreación descritos abajo corresponden al cierre de fase 1. El modo `--restart` se conserva en CI aislado; no usarlo sobre DEV público porque no carga la configuración privada de fase 13 al recrear servicios.

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

## Próxima fase prevista al cierre histórico

Al cerrar fase 1, la fase 2 requería autorización para identidad, cuentas administradas, roles administrador/docente/alumno y sus pruebas. Esas funciones se entregaron después. Consultar [el contexto vigente](CONTEXTO_PARA_CONTINUAR.md) para continuar; no habilitar producción ni comenzar otra fase automáticamente.
