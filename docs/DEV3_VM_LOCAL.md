# DEV3 local — operación y contexto

Actualización 01/11: intérpretes **1.15.0** publicados para los tres perfiles
por el montaje de semáforos directos/digitales. Ver `SEMAFOROS_MONTAJE_DIRECTO.md`.
SDK y cachés se conservaron. Las menciones inferiores a1.14.3 documentan la
preparación original y su aceptación física, no una prueba física de1.15.0.

Preparado30/10/2026 por pedido del propietario. VM `capi-dev3`, Ubuntu Server
26.04 LTS, NAT VMware,8vCPU/16GB/120GB. Dirección actual192.168.230.148;
es una concesión DHCP, no se modificó el router ni el DHCP global de VMware.
Si cambia, actualizar el HostName del perfil SSH privado de Windows.

## Acceso y carpeta de trabajo

- Web en esta PC: **http://localhost:3003/**.
- Checkout en la VM: **`/home/capi/capibloques`**.
- Rama estable propia: `dev3`. Cada trabajo nuevo va en una rama `codex/...`
  desde dev3 y se publica en Git. No integrar automáticamente en main/dev1/dev2.
- Leer `AGENTS.md`, `docs/CONTEXTO_PARA_CONTINUAR.md`, `docs/BACKLOG.md` y esta guía.
- Usuario Linux `capi`. Contraseñas/claves/configuración SSH quedan fuera de Git.

Windows tiene un perfil privado externo a Git para el alias `capi-dev3`.
No usa el salto SSH del servidor. Para abrir túnel y navegador, desde el
checkout de Windows:

```powershell
.\scripts\connect-dev3.ps1
```

`-NoBrowser` sólo comprueba y abre el túnel. `-LocalPort` permite otro puerto
de Windows si3003 está ocupado; el destino en la VM sigue siendo3003.
El helper comprueba la salud de la API y no afirma éxito sólo por tener un
socket abierto. Mantiene SSH oculto y registra errores en la carpeta local
de CapiBloques del usuario. No cambia otras conexiones SSH.

El perfil privado debe declarar Host/HostName/User/IdentityFile y host key
verificada. El valor concreto de la clave y su ruta no se documentan aquí.

Entrar por `http://IP_VM` no es el recorrido USB: Web Serial requiere origen
seguro. El túnel hace que Chrome/Edge vea **localhost**, y el USB permanece
en Windows; no se captura ni se pasa a la VM.

## Desarrollo sin despliegue

El código que ejecuta dev3 está **dentro de la VM**. Editarlo por SSH/editor
remoto en `/home/capi/capibloques`: guardar TS/TSX/CSS activa HMR; guardar
Python recarga Gunicorn. La carpeta de Windows es otro checkout y no se
sincroniza automáticamente por guardar un archivo allí.

No hace falta GitHub Actions, reconstruir una imagen ni publicar un commit
para ver una edición local. Commit/push siguen siendo obligatorios al cerrar
cambios del proyecto, y se conservan las comprobaciones apropiadas al cambio.

Comandos en la VM:

```sh
cd /home/capi/capibloques
./scripts/dev3.sh up       # iniciar API/DB/editor
./scripts/dev3.sh status   # salud, contenedores y servicio
./scripts/dev3.sh logs     # seguir logs del editor
./scripts/dev3.sh down     # detener sin borrar datos ni volúmenes
```

Sólo ante cambios de dependencias/infra local o primera instalación:

```sh
./scripts/dev3.sh setup
```

Es idempotente: conserva secretos, base, proyectos y cachés. `npm ci` se
ejecuta sólo si cambia el lockfile o la versión de Node/npm. Ubuntu trae
npm9, incompatible con este lockfile y sus overrides; setup instala npm11.10.0
para el usuario, sin reescribir el lockfile ni reemplazar Node del sistema.
Node instalado22.22.1. Cambios de migraciones requieren `dev3.sh migrate`.

## Servicios y datos

- Editor: servicio de usuario `capibloques-dev3-editor`, puerto127.0.0.1:3003.
- API: Compose propio, Python3.12 y dependencias fijadas del proyecto,
  puerto127.0.0.1:8003. Vite hace proxy `/api/` conservando el origen/Host.
- PostgreSQL17 propio, volumen `capibloques-dev3_dev3_pgdata`, sin puerto host.
- Docker y linger del usuario están habilitados para el arranque de la VM.
- `compose.dev3.yaml` es independiente: no combinar con compose del servidor.
- `CAPIBLOQUES_LOCAL_DEV=1` desactiva sólo aquí los plugins Sites/Cloudflare,
  que no se usan con el backend Django local. Otros entornos conservan su
  configuración. No se cambió autenticación/autorización de la aplicación.

La copia inicial de dev1 fue solicitada explícitamente:30usuarios,
13proyectos,53revisiones, colegio/logo, cursos y auditoría.546registros,
verificados por contenido normalizado contra un snapshot transaccional de
sólo lectura. Sesiones, límites de login y trabajos de compilación no se
copiaron. Los hashes de contraseña se conservaron: usar las mismas cuentas
y claves de dev1. Las sesiones nuevas son independientes.

`scripts/dev3-seed.py SNAPSHOT_PRIVADO` admite sólo un destino vacío y registra
un marcador: no sirve para refrescar/sobrescribir una base usada. El snapshot
y el marcador viven en la carpeta privada de datos del usuario, fuera de Git.
Los secretos Django/DB viven en la carpeta privada de configuración (0700),
con archivos montados sólo lectura para los UID diferentes de Postgres/API.
Nunca copiar estos archivos, snapshots, volúmenes o credenciales a Git.

Después de esta copia, **los proyectos de dev3 no se sincronizan con dev1**.
Git comparte código y documentación; importar/exportar JSON comparte proyectos.
No ejecutar aquí los actualizadores operativos del servidor `update-dev.sh`
o `capi-dev`; no eliminar volúmenes para resolver errores de arranque.

## Firmware y cachés

```sh
./scripts/dev3.sh firmware
```

Genera los intérpretes Wemos, DIYmall S3 y Waveshare usando ESP-IDF5.5.5 en
una imagen oficial fijada por digest. Compila con hasta6CPU/8GB, mantiene
objetos y ccache en `outputs/` y rechaza dos compilaciones simultáneas.
La identidad del código se calcula sobre los archivos del intérprete,
incluyendo cambios todavía no commiteados: HEAD por sí solo sería incorrecto
para desarrollo. Los binarios y dependencias son generados, no van a Git.

El intérprete se compila sólo si cambia su código/configuración. Cambiar
bloques/reglas NO requiere compilar ni ir al servidor. Cambiar C++ sí requiere
compilar y volver a grabar el firmware; el editor no puede aplicar HMR al ESP32.

Primera compilación local completa para los tres perfiles y validación de ZIP,
SHA y partes aprobadas. Repetición sin cambios: **3,3s**, reutilizando los tres
artefactos. Versión instalada actualmente1.14.3 por el arreglo del semáforo;
ver `SEMAFORO_SALIDAS_1_14_3.md`. Las cachés no se borran con setup/up/down.

La cola web antigua de compilación específica por proyecto Arduino/ESP-IDF
**no se activó en esta preparación**. La base nueva la deja pausada y no se
copian trabajos del servidor. Exportar fuentes sigue disponible; el recorrido
principal intérprete precompilado + envío de reglas sí está preparado.

## Evidencia de preparación

- SSH directo al host correcto; Git, Node, Docker/Compose instalados.
- Copia de datos verificada por contenido; repetición de setup sin pérdida.
- API ready200 por túnel y editor de invitado abierto desde Windows.
- Chromium confirmó `isSecureContext=true` y Web Serial disponible.
- Cambio de CSS en la VM produjo actualización WebSocket HMR y mantuvo
  el editor de bloques visible, sin desplegar.
- Intérpretes3perfiles1.14.3 validados desde la web local; Wemos grabada
  con ese artefacto y semáforos reales confirmados por el propietario.
- No se modificaron los servicios/datos del servidor ni main/dev1/dev2.

Pendientes que requieren al propietario: autenticar GitHub para hacer push
**desde la VM** si todavía no lo hizo; decidir una reserva DHCP VMware si
quiere fijar la concesión actual. El clon/lectura de GitHub ya funciona.
