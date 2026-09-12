# Fase 0B: entorno remoto del editor

Fecha: 5 de septiembre de 2026.
Alcance: ejecutar y probar el editor existente en la VM de desarrollo. No habilita cuentas, base de datos, compilación remota ni producción.

**Guía histórica del editor solo, verificado el 5 de septiembre de 2026.** API/PostgreSQL se incorporaron en fase 1 y el runtime estático público en fase 13, entregada el 12 de septiembre. Para arrancar, actualizar o recuperar la web/API actuales, usar la [operación vigente de fase 13](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). La sección del túnel SSH sigue vigente; la descripción de Node/HMR y sus mediciones corresponde al entorno de 0B.

## Entorno observado al cerrar 0B

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

La receta de 0B detenía el servidor Node, instalaba el lockfile en su contenedor y lo iniciaba con un único Compose. **Esa receta fue sustituida y no debe ejecutarse contra DEV actual.** Desde fase 13, `editor` contiene Nginx estático; systemd y el firewall coordinan su arranque. Usar [fase 13: operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente), sin iniciar `editor` manualmente ni ejecutar `npm ci` en ese contenedor.

Antes de cualquier mantenimiento siguen siendo obligatorios comprobar `hostname` = `capi-dev`, revisar el árbol Git y conservar cambios ajenos. No usar reset/force, `docker system prune`, borrar volúmenes ni eliminar el checkout para solucionar un fallo. La biblioteca del servidor incorporada después de 0B vive en PostgreSQL; los borradores locales permanecen separados por cuenta y origen de navegador.

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

En 0B, tipos/lint/smoke se ejecutaron en el contenedor Node limitado. El `editor` estático actual no incluye esas herramientas: seguir los checks locales/CI y la [verificación operativa vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). Los navegadores de prueba se ejecutan en la PC para no consumir la RAM de la VM; el túnel de recuperación permite dirigirlos a DEV:

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

Al cerrar 0B, incorporar Django y PostgreSQL requería un nuevo OK. Esas funciones y el acceso HTTPS público a DEV se entregaron después; consultar [el contexto vigente](CONTEXTO_PARA_CONTINUAR.md) antes de continuar. Producción permanece en la Fase final postergada.
