# Fase 0B: entorno remoto del editor

Fecha: 5 de septiembre de 2026.
Alcance: ejecutar y probar el editor existente en la VM de desarrollo. No habilita cuentas, base de datos, compilación remota ni producción.

## Entorno

- VM autorizada: `capi-dev`. Checkout: `/home/capi/capibloques`, propiedad de `capi` (UID/GID 1000).
- Clonado por Git SSH usando la autenticación configurada por el propietario. No se copiaron claves ni se cambió la identidad Git global. Los commits de esta entrega salen de la PC de trabajo.
- `compose.dev.yaml` usa la imagen oficial Node **22.23.2**, variante Debian Bookworm slim, fijada por digest. npm observado: **10.9.8**. No se instala Node global en Ubuntu.
- `npm ci` instala exactamente el lockfile en ese checkout Linux. No copiar `node_modules` desde Windows. La caché npm queda en `.cache/npm`, ignorada por Git.
- Sólo un servicio `editor`: usuario no root, sin capacidades adicionales ni socket Docker; raíz del contenedor de sólo lectura. El checkout y los temporales necesarios son escribibles.
- `.vinext` se monta como almacenamiento temporal del contenedor: su lock contiene un PID que no debe sobrevivir a un reinicio. Esto evita confundir un PID reutilizado con otro servidor activo. No ejecutar un segundo servidor sobre este checkout fuera de Compose.
- Límite del servicio: 1 CPU, 1280 MiB RAM, hasta 256 MiB adicionales de swap y 256 procesos. No se modificaron los recursos asignados a la VM.
- Puerto publicado **sólo en `127.0.0.1:3000` de la VM**. Se accede desde la PC por un túnel SSH, no por la IP de LAN ni desde Internet.
- Política `unless-stopped`, comprobación HTTP de salud y logs limitados a dos archivos de 5 MiB. No se prometen cifras de concurrencia a partir de esta prueba de desarrollo.
- Producción permanece sin aplicación. Gateway, Proxmox, router y Nginx no se modifican.

Se conservan los paquetes, lockfile, diseño y funciones existentes. El servicio usa `npm run dev`, no `npm start` (que en este proyecto sigue siendo Wrangler). Vinext requiere `--hostname 0.0.0.0`; `--host` no es equivalente en su CLI.

Referencias de configuración: [imagen oficial Node](https://github.com/nodejs/docker-node), [servicios Docker Compose](https://docs.docker.com/reference/compose-file/services/). Las versiones y funcionamiento indicados se verifican en la VM, no sólo en documentación.

## Arrancar o actualizar en desarrollo

Dentro de una sesión SSH en la **VM de desarrollo**:

```bash
test "$(hostname)" = capi-dev || exit 1
cd /home/capi/capibloques
git status --short --branch
```

Si hay cambios propios sin guardar, detenerse y resolverlos: no usar reset, force ni sobrescribir el checkout. Con árbol limpio:

```bash
(
  set -eu
  test "$(hostname)" = capi-dev
  cd /home/capi/capibloques
  test -z "$(git status --porcelain)"
  git pull --ff-only origin main
  sudo docker compose -f compose.dev.yaml config --quiet
  sudo docker compose -f compose.dev.yaml pull
  sudo docker compose -f compose.dev.yaml stop editor
  sudo docker compose -f compose.dev.yaml run --rm --no-deps editor npm ci --no-audit --no-fund
  sudo docker compose -f compose.dev.yaml up -d --wait --wait-timeout 180
)
```

El bloque corta ante un error: si falla la instalación, no intenta levantar un entorno incompleto. Detener antes de reinstalar dependencias evita modificar `node_modules` mientras Vite lo usa. No ejecutar `npm ci` simultáneamente con el editor ni compartir esta carpeta entre Windows y Linux. En otro host Linux, confirmar primero que el propietario del checkout tenga UID/GID 1000 o adaptar explícitamente `user` en Compose; no resolver permisos ejecutando el editor como root.

Para consultar o detener:

```bash
sudo docker compose -f compose.dev.yaml ps
sudo docker compose -f compose.dev.yaml logs --tail 80 editor
sudo docker compose -f compose.dev.yaml stop editor
```

`stop` no elimina código ni proyectos; `up -d --wait` vuelve a levantarlo. Los proyectos actuales se guardan en el navegador, no en el contenedor. No utilizar `docker system prune`, borrar volúmenes ni eliminar el checkout para solucionar un fallo.

## Conectarse desde Windows

La PC de trabajo tiene una configuración SSH específica en `.ssh/capibloques-dev.conf` dentro del perfil del usuario, **fuera del repositorio**. No altera el archivo SSH global. Contiene referencias al salto y a la clave existente, no una copia de la clave ni contraseñas. El alias de destino es `capibloques-dev`.

Desde PowerShell, en la carpeta del proyecto:

```powershell
.\scripts\connect-dev.ps1
```

Autenticarse en la VM si SSH lo solicita y mantener esa terminal abierta. Luego abrir **http://localhost:3000/** en Chrome o Edge. El script no abre una sesión de comandos en el gateway: el salto usa exclusivamente reenvío TCP. Tampoco reenvía el agente ni X11.

Ctrl+C o apagar la PC cierra el túnel, **no detiene la VM ni el contenedor**. Para volver a probar, ejecutar otra vez el script. Si ya hay un túnel escuchando en ese puerto, reutilizarlo; no arrancar duplicados. Para un puerto alternativo:

```powershell
.\scripts\connect-dev.ps1 -LocalPort 3001
```

Usar entonces http://localhost:3001/. Atención: otro puerto o usar `127.0.0.1` en lugar de `localhost` cambia el origen del navegador y, por tanto, su guardado local. Exportar JSON antes de cambiar de origen. Los proyectos guardados en el antiguo dominio Pages tampoco aparecen automáticamente aquí.

En otra PC, el propietario debe preparar su propia autenticación y configuración SSH fuera de Git, sin copiar claves privadas. Plantilla orientativa; reemplazar los marcadores y confirmar las huellas de host antes de conectarse:

```sshconfig
Host capibloques-jump
    HostName <HOST_DEL_SALTO>
    Port <PUERTO_DEL_SALTO>
    User <USUARIO_DEL_SALTO>
    IdentityFile "<RUTA_LOCAL_DE_LA_CLAVE_AUTORIZADA>"
    IdentitiesOnly yes
    BatchMode yes
    ForwardAgent no
    ForwardX11 no
    StrictHostKeyChecking yes

Host capibloques-dev
    HostName <IP_PRIVADA_DEV>
    User capi
    ProxyCommand ssh -F "<RUTA_ABSOLUTA_DE_ESTE_ARCHIVO>" -a -x -W %h:%p capibloques-jump
    ForwardAgent no
    ForwardX11 no
    StrictHostKeyChecking yes
```

No se desactiva la verificación de huellas para sortear un error SSH. La configuración privada no debe entrar en commits ni adjuntarse a reportes públicos.

## Probar el entorno correcto

Con el editor detenido, se pueden ejecutar checks en un contenedor temporal bajo los mismos límites:

```bash
sudo docker compose -f compose.dev.yaml run --rm --no-deps editor \
  sh -c 'npm run typecheck && npm run lint && npm run test:smoke'
```

Luego levantar el editor. Los navegadores de prueba se ejecutan en la PC para no consumir la RAM de la VM:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
npm run test:e2e -- --workers=1
```

Chrome y Edge deben estar instalados en esa PC. El modo `PLAYWRIGHT_BASE_URL` **desactiva el arranque de un servidor alternativo**: si se corta el túnel, falla contra el destino indicado, no prueba silenciosamente la copia local. Sin esa variable se mantiene el comportamiento anterior para desarrollo local y CI. Quitar esas variables de la terminal al terminar si se vuelve a probar localmente.

CI valida el Compose y conserva tipos, lint, smoke, audit, interfaz Chromium, compilación Arduino/Wemos y build. No publica en Pages ni en Proxmox.

El modo externo permite 30 segundos por aserción y 90 por caso, por la carga de módulos DEV sin empaquetar a través de SSH. Los límites originales de CI/local (10 y 30 segundos) no cambian; no se agregaron reintentos para ocultar errores remotos.

## Evidencia y punto de control

- `npm ci` en la VM: 600 paquetes instalados en 27 segundos con el lockfile sin cambios; Node 22.23.2/npm 10.9.8.
- Compose válido; typecheck, lint y las tres suites smoke ejecutadas dentro del contenedor de la VM, todas correctas.
- HTTP 200 desde la PC a través de SSH; en Chrome se comprobaron el WebSocket de Vite conectado, `isSecureContext: true` y disponibilidad de la API Serial. Esto **no** implementa ni prueba grabación USB.
- Se detectó y corrigió un fallo reproducible al reiniciar: el lock persistente de Vinext confundía un PID reutilizado con otro servidor. Después de mover `.vinext` a tmpfs, recreación y reinicio terminaron `healthy`, sin OOM ni reinicios automáticos.
- Publicación verificada únicamente en loopback. Proceso UID 1000, sin socket Docker ni directorio SSH del usuario montados. Un contenedor activo, cero volúmenes Docker y aproximadamente 23 GiB libres en la VM.
- Muestras durante las pruebas: aproximadamente 881–1089 MiB usados por el contenedor sobre su límite de 1280 MiB. Son muestras, no una medición de pico ni una prueba de carga multiusuario.
- Script de túnel probado con puerto alternativo, HTTP 200 y cierre; luego se comprobó la reconexión con un túnel dedicado en el puerto habitual. La sesión de administración se mantiene separada.
- Configuración de Playwright importada y comprobada con/sin URL externa y con/sin `CI`: el modo externo no puede arrancar un servidor local de reemplazo. Script PowerShell: sintaxis y rechazo de configuración ausente comprobados.
- En la primera tanda remota se excedió el margen local de 10 segundos al cargar Blockly. Se estableció el margen externo documentado, sin alterar el CI. En la tanda posterior hubo 27 casos correctos, dos fallos de carga y cuatro sin ejecutar al alcanzar el límite de fallos. Las trazas mostraron módulos HTTP pendientes antes de las acciones de usuario, no fallos en arrastre o edición: una espera llegó a unos 94 segundos. No se atribuye una causa exacta sólo a partir de esas trazas.
- Chrome completó sus 11 casos. Después de separar el túnel de navegación de la sesión de administración, Edge repitió la suite completa: 11/11 correctos en 2,2 minutos. La carga de los casos remotos estuvo habitualmente en torno a 10–13 segundos; no se promete latencia de producción a partir de DEV.
- Chromium ya tenía 10 casos correctos; el caso pendiente de arrastre/guardado/recarga se repitió tres veces con el túnel dedicado: 3/3 correctos (11,3–11,7 segundos por caso). Los 33 escenarios navegador/caso quedaron cubiertos con resultados correctos entre las tandas, **no en una única ejecución limpia**. Se conserva arriba el registro de las incidencias.

La configuración y documentación se publican con commit/push. Los resultados del CI completo quedan asociados a los commits en GitHub Actions; no se reactiva Pages.

0B queda completada con el editor de desarrollo disponible por el túnel. El servidor permanece en la VM; no quedan pruebas ejecutándose al cerrar la entrega. Mantener anotadas las demoras observadas: si reaparecen, revisar transporte y logs de DEV, no ampliar tiempos indefinidamente ni confundirlas con fallos funcionales sin evidencia.

La siguiente fase requiere un nuevo OK: incorporar Django y PostgreSQL de forma reproducible, sin comenzar todavía el ABM ni la biblioteca de usuarios. La configuración de producción, HTTPS público y endurecimiento de accesos pertenecen a sus etapas autorizadas.
