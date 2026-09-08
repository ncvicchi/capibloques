# Fase 9 — Compilación y descarga

Autorización: «Vamos con el 9», ampliada con «Quiero resolver también la configuración Wi-Fi ahora» y «Autorizo enviar la clave al servidor para una compilación privada y temporal». **Fase completa implementada, verificada y entregada en DEV el 8 de septiembre de 2026.** No incluye producción ni grabación USB.

## Alcance y decisiones de implementación

- Compilar una instantánea guardada de un proyecto propio. Los docentes hacen una copia personal antes de compilar un trabajo ajeno. El servidor carga el documento: no recibe fuentes, ZIP, CMake, rutas o flags arbitrarios del navegador.
- Cola persistente en PostgreSQL, fuera de las peticiones HTTP; estados, cancelación de pedidos en cola, idempotencia, cuotas, turno entre usuarios y cupo global compartido por Arduino/ESP-IDF.
- Configuración administrativa con Guardar/Cancelar, revisión optimista, auditoría, pausa separada y un techo operativo según recursos reales. Bajar el límite no mata trabajos activos.
- Planificador confiable separado de los compiladores. Ejecuciones efímeras sin red, credenciales de infraestructura, volúmenes del host ni socket Docker; sólo reciben el proyecto y, si se autorizó, su Wi-Fi temporal. CPU/RAM/swap/procesos/disco/tiempo y salida limitados. Toolchains y dependencias permitidas se preparan antes, nunca a pedido del cliente.
- Lease/heartbeat con intento identificado. Un lease vencido no libera un cupo ni autoriza duplicar ejecución: primero comprobar/terminar el contenedor anterior. Resultado sólo del intento vigente. Reinicios no relanzan sin esa comprobación.
- Artefactos privados temporales separados de proyectos, con caducidad, hashes y manifiesto de direcciones extraídas del build real. Entregar ZIP de firmware completo para Wemos D1 R32; no confundir `app.bin` con una imagen suficiente para una placa vacía.
- Mantener editor/simulación utilizables durante la espera; identificar versión compilada y avisar si el editor cambió. JSON y las fuentes de fase 8 siguen disponibles.
- Validación con PostgreSQL real, pruebas de aislamiento/cola/reinicio, compilación Arduino/ESP-IDF real y Chrome/Edge contra DEV. Medir frío/caliente y respuesta de API mientras compila. Usar sólo documentos sintéticos.

DEV verificado al iniciar: 1 vCPU, 1967 MiB RAM, 2047 MiB swap y 22 GiB libres. Empezar con una compilación y un proceso interno; no es una promesa de capacidad. Si los recursos no alcanzan, conservar proyectos y pausar compilaciones.

## Uso

1. Guardar el proyecto en la cuenta y revisar sus conexiones.
2. Abrir **Exportar → Compilar y descargar firmware**. Elegir Arduino o ESP-IDF.
3. Si utiliza Wi-Fi, completar SSID/clave y confirmar el envío privado. Red de 2,4 GHz; SSID de hasta 32 bytes UTF-8, contraseña WPA2 de 8–63 caracteres ASCII o vacía para una red abierta.
4. Se puede cerrar y seguir programando. Volver a abrir muestra el pedido; un aviso distingue la versión compilada de cambios posteriores. Cancelar un pedido en cola no elimina el proyecto. Una compilación ya iniciada termina en segundo plano.
5. Descargar el ZIP completo, con bootloader, tabla de particiones, aplicación y demás segmentos requeridos por ese build, `manifest.json`, hashes y `LEEME.txt`. No es sólo `app.bin`. El navegador comprueba el hash y revalida el acceso antes de ofrecer el archivo.

En **Mi cuenta → Compilaciones**, el administrador puede pausar nuevos pedidos/arranques y guardar/cancelar el límite de simultaneidad. No ve claves ni proyectos privados ajenos. En esta VM el techo operativo es **1**; el selector no permite sobrepasarlo. Aumentar ese techo exige otra medición y ajuste operativo, no más recursos asumidos.

Se conservan JSON portable, `.ino` y ZIP de fuentes ESP-IDF. Las fuentes exportadas mantienen marcadores de Wi-Fi para configurar localmente; sólo la compilación privada incorpora las credenciales ingresadas en el diálogo.

## Contratos y límites

- Cola PostgreSQL con una reserva global bajo `access_lock()`, una ejecución por persona y reparto por usuario menos recientemente atendido/FIFO personal. Hasta 3 pendientes por usuario, 40 globales; 30 registros por usuario y 1000 globales durante 7 días. El límite de concurrencia admite hasta 4 sólo cuando el operador prepara ese techo; DEV queda en 1.
- Pedidos sin iniciar caducan en 1 hora; el firmware listo dura 24 horas. Metadatos/idempotencia duran 7 días. Una nueva solicitud usa un UUID y un reintento conserva UUID/cuerpo, incluso si se perdió el ACK.
- Reserva conservadora de 5 MB por pedido; ZIP máximo 5 MB, artefactos/reservas hasta 32 MB por cuenta y 256 MB globales. No se desalojan proyectos ni historiales para compilar.
- Caché de resultados sólo para el mismo propietario, proyecto, documento, framework y receta. Nunca se reutilizan resultados con Wi-Fi. Retirar un resultado revoca también los otros pedidos que reutilizaron ese mismo archivo privado; no extiende su vencimiento.
- Bajas y purgas retiran explícitamente firmware y entradas pendientes. Un intento activo conserva su cupo hasta comprobar que su contenedor terminó. Desactivar cuenta, retirar permisos o enviar proyecto a papelera bloquea nuevas descargas, con permisos frescos por objeto; ser administrador no da acceso a firmware ajeno.
- El planificador es un servicio root confiable, no un endpoint público. Django no controla Docker; el compilador no controla la cola. El servicio usa comandos fijos y el ID inmutable de imagen, no rutas/flags elegidos por el navegador.
- Contenedor sin red, sin montajes del host, raíz de sólo lectura, UID 10000, capabilities retiradas y `no-new-privileges`. Máximo 0,60 CPU, 1024 MiB RAM, 1600 MiB RAM+swap, 128 procesos, 256 descriptores y 30 minutos. `/work` tmpfs 768 MiB y `/tmp` tmpfs 128 MiB, ambos `exec,nosuid,nodev`: las herramientas oficiales empaquetadas con PyInstaller requieren ejecutar sus bibliotecas temporales. No se habilita escritura en la imagen.
- Compilador interno con un proceso de build. Salida de herramientas capturada y descartada, nunca logs de fuentes/credenciales entregados al usuario. Sólo estados y errores clasificados fijos. Docker usa `log-driver=none`; el servicio registra eventos genéricos, no el input.
- Heartbeat/lease de 45 segundos. Vencer un lease no libera cupo ni crea otro intento: primero reconciliar Docker y comprobar terminación. Tras caída del planificador, los intentos anteriores se terminan y se marcan fallidos; se pide una nueva compilación explícita, sin reproducir silenciosamente claves.

## Wi-Fi y privacidad

Las credenciales no entran en el JSON del proyecto, su historial, localStorage, IndexedDB, Git ni una caché compartida. El formulario/reintento las conserva sólo en memoria del navegador hasta recibir confirmación o cerrarse/revocarse. La cola las cifra con Fernet y una clave derivada con propósito separado del secreto del entorno; el identificador de reintento usa HMAC, no un hash público de contraseña.

La instantánea y las credenciales cifradas se retiran de la fila al entregar el intento al ejecutor. Las pendientes también se retiran al cancelar/vencer. Durante el build se requieren en memoria y archivos temporales del contenedor; el binario resultante **contiene la clave**, es privado y caduca a las 24 horas. El usuario puede retirarlo antes; la limpieza física del archivo se hace desde el servicio, tras quitar referencias y un margen mínimo de 60 segundos desde su creación.

Esto es retiro lógico, **no borrado forense**: WAL/backups de PostgreSQL, swap, snapshots de la VM, archivos ya descargados y flash de la placa pueden conservar datos. Un backup de infraestructura debe tratarse como sensible. No respaldar rutinariamente el directorio de artefactos temporales ni prometer que restaurar una VM los hace vigentes: su TTL y permisos siguen aplicando. Los ZIP de baja de cuenta conservan proyectos/historial, no firmware ni claves privadas de la cola.

Arduino usa `WiFi.persistent(false)` y ESP-IDF `WIFI_STORAGE_RAM`; eso evita pedir persistencia adicional de la configuración nueva en NVS, pero no borra residuos de firmware o NVS anteriores. Cambiar firmware o retirar un ZIP no permite retirar copias previas ni garantiza eliminar una clave de la placa.

DEV sigue por loopback y túnel SSH; no exponer el formulario con claves por HTTP en LAN/Internet. Producción requiere HTTPS en la Fase final, postergada.

## Operación DEV

Versiones: Arduino CLI 1.5.1, core ESP32 3.3.11, ESP-IDF 5.5.5, Node 22.23.2, Blockly 12.5.1, LiquidCrystal_PCF8574 2.3.0, U8g2 2.36.19 y Arduino_GFX_Library 1.6.7. Bases por digest, CLI por checksum y dependencias JS por lockfile. Perfil Wemos D1 R32/ESP32, DIO, 40 MHz y flash 4 MiB. Arduino FQBN `esp32:esp32:d1_uno32:FlashFreq=40`. Los offsets se leen de `flash_args`/`flasher_args.json` generados, no de datos del usuario.

Sólo operar en `capi-dev`, dentro de `/home/capi/capibloques`. No ejecutar estos pasos en gateway, Proxmox, PRD o Nginx. El instalador comprueba hostname/root. Los secretos del entorno existente no se regeneran.

Para mantenimiento: pausar admisión desde administración, dejar terminar los intentos y confirmar que no hay activos antes de cambiar receta. Detener `editor` antes de pull/dependencias/build de imagen. Conservar el túnel dedicado. La compilación de proyectos **sí** se verifica con el editor encendido; detenerlo sólo es una precaución de despliegue, no una condición de uso.

```sh
sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml -f compose.compiler.dev.yaml stop editor
git pull --ff-only
sudo docker build --memory=1024m --memory-swap=1600m --cpu-period=100000 --cpu-quota=80000 \
  -f ops/compiler/Dockerfile -t capibloques-compiler-dev:phase9 .
sudo python3 ops/compiler/install.py
sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml -f compose.compiler.dev.yaml up -d --build api
sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml exec -T api python manage.py migrate --noinput < /dev/null
```

`install.py` detiene el planificador e instala archivos root-owned; **no activa el servicio ni cambia la receta DB**. Si había intentos interrumpidos, reconciliarlos primero con la receta anterior; no liberar reservas mediante SQL ni borrar contenedores ajenos. Copiar el hash de receta impreso por el instalador en el siguiente comando, sin el prefijo `sha256:`:

```sh
printf '%s' '{"recipe":"REEMPLAZAR_POR_HASH_DE_64_HEX","ceiling":1}' | \
  sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml exec -T api python manage.py compiler_dispatch register
sudo systemctl enable --now capibloques-compiler.service
sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml -f compose.compiler.dev.yaml up -d editor
sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml -f compose.compiler.dev.yaml ps
sudo systemctl is-active capibloques-compiler.service
```

La receta se registra sólo sin intentos activos; invalida trabajos pendientes de herramientas anteriores con un mensaje de recompilación. La pausa administrativa se conserva: quitarla desde la web después de verificar salud. En una primera instalación el estado comienza pausado.

**Usar los tres archivos Compose al crear/recrear el servicio API de DEV.** El tercero monta `/var/lib/capibloques-compiler/artifacts` de sólo lectura en `/artifacts`; debe crearlo el instalador antes. Directorio 0700 y ZIP 0600, propietario UID/GID 1000 de la API. Omitir ese archivo al recrear la API deja la aplicación sin sus descargas. `exec` sobre la API ya creada puede usar los dos archivos base. CI sin compilador host sigue usando los dos archivos base.

La imagen queda identificada por SHA-256, además del tag de construcción. No actualizar toolchains en cada pedido, usar `latest`, hacer prune global ni borrar imágenes/volúmenes ajenos para ganar espacio. El filesystem real de DEV, no la suma virtual de tamaños de capas de Docker, determina el margen disponible.

Para comprobaciones, `python manage.py compiler_probe` ofrece crear/repetir/medir/verificar/retirar **sólo** cuentas sintéticas guardadas por UUID, nombre/prefijo exactos, sin contraseña utilizable ni membresías. `ops/compiler/diagnose.py` sólo admite fixtures sintéticos sin Wi-Fi real; jamás usarlo para revelar logs de trabajos privados.

## Verificación

- DEV, Chrome y Edge instalados, por túnel SSH al editor de la VM: **58/58 pruebas**, sin reintentos, en 5,7 minutos; compilación activa durante la ejecución. Son contratos de interfaz con interceptaciones sintéticas de API, complementados por las pruebas reales de PostgreSQL, cola y descarga siguientes. Incluyen cola/descarga/cierre, Wi-Fi/ACK perdido, administración, exportación Arduino/IDF, pantallas, inicio único/paralelo y autoguardado. Inspección visual del diálogo a 390 px, sin desborde horizontal y con contenido desplazable.
- Ocho guardados HTTP reales de un proyecto sintético a través del proxy del editor durante ESP-IDF: **76–513 ms**, mediana **219 ms**; salud **42–492 ms**. No incluyen latencia WAN del cliente y no son una prueba de capacidad de una clase completa. Hubo además pruebas de navegador concurrentes.
- Typecheck, lint, generador compartido, cuatro pruebas de aislamiento/ZIP y liberación de referencias del planificador, smoke del editor/worker, ESP-IDF y build de las diez páginas estáticas: correctos. Las cuatro pruebas del planificador también pasan en Python de la VM.
- Backend: **179/179 pruebas** sobre PostgreSQL real en `test_capibloques`, separada de los datos DEV; 80,116 segundos con compilación concurrente. Incluyen reservas concurrentes entre workers, equidad/cupos, lease sin liberación prematura, intentos obsoletos, credenciales cifradas y retiradas en la entrega, corrupción de clave, idempotencia, límites, caché privada/alias, revocación y bajas. Migraciones aplicadas y sin diferencias pendientes.
- Cola/descarga real ESP-IDF con Wi-Fi sintético: **500,5 s**, pico cgroup **542 MiB**, sin OOM. ZIP de **739.065 bytes**, tres segmentos; descarga privada comprobada, SHA-256 global/por segmento correcto y credencial sintética presente en binario. La instantánea compilada siguió siendo la original mientras el proyecto se guardó ocho veces durante el build.
- Cola/descarga real Arduino con Wi-Fi sintético: **160,8 s**, pico cgroup **667 MiB**, sin OOM. ZIP de **922.676 bytes**, cuatro segmentos; SHA-256 global/por segmento y presencia de credencial sintética verificados.
- Cola/descarga real Arduino sin Wi-Fi: **76,1 s**, pico cgroup **694 MiB**, sin OOM. ZIP de **309.339 bytes**, cuatro segmentos, hashes correctos y sin credencial sintética. Repetir exactamente ese proyecto devolvió el mismo firmware privado en **35,2 ms**, sin iniciar otro contenedor ni extender su vencimiento. Esto es caché de artefactos, no recompilación incremental de un proyecto modificado; Wi-Fi siempre compila de nuevo.
- [CI funcional completo, commit 567d836](https://github.com/ncvicchi/capibloques/actions/runs/34185001549): **179 pruebas backend y 154 pruebas Chromium**, build estático y siete circuitos compilados en Arduino más siete nativos ESP-IDF correctos. Sólo fixtures sintéticos, nunca proyectos o claves reales enviados a GitHub Actions.
- [CI final completo, commit ca36952](https://github.com/ncvicchi/capibloques/actions/runs/34186145649): los cuatro jobs correctos tras el ajuste final del planificador y del script de mantenimiento. La entrega posterior sólo actualiza documentación; no cambia código probado. Imagen DEV `sha256:6a2e6876ecbd7da000f9bfb01c1cb48b0707f93359abd200fd8fc5396e6de178`, servicio habilitado y activo, concurrencia/techo 1, sin pausa ni trabajos/artefactos de prueba pendientes.
- Recuperación real: SIGKILL del proceso principal con un único intento sintético confirmado activo; systemd pasó de 0 a 1 reinicios y volvió a `active`. El ejecutor anterior fue retirado, el pedido quedó fallido con mensaje de interrupción, no se duplicó y no quedaron contenedores/cupos activos. El comando de señal informó un error sobre procesos auxiliares, pero la caída del principal y toda la recuperación se comprobaron por separado; no se interpretó su exit code como evidencia suficiente.

- Mantenimiento real con cola vacía: otras **179 pruebas** correctas en 41,028 s; `verify-backend-dev.sh --restart` recreó API/PostgreSQL conservando el registro persistente de migración. Las descargas IDF/Wi-Fi y Arduino/caché volvieron a verificarse después. Montaje `/artifacts` confirmado `writable=false`; editor, API y DB saludables.
- Ajuste final del planificador para liberar referencias temporales incluso cuando queda ocioso: cuatro pruebas correctas en Windows y Linux/DEV; repetición real Arduino/Wi-Fi con descarga verificada en **196,1 s**, sin OOM, y otras **8/8 pruebas Chrome/Edge** tras desplegarlo. No requirió cambiar la imagen de herramientas.
- Memoria: ningún build final alcanzó OOM. Con compilación y pruebas de navegador, una muestra tuvo 431 MiB disponibles y 162 MiB de swap usados. Filesystem raíz real quedó con **11 GiB libres** (de 31 GiB), aproximadamente 19 GiB usados. El tamaño virtual sumado de las capas de imagen no equivale a espacio adicional exclusivo ocupado. No se aumentaron recursos ni se borraron volúmenes/imágenes ajenos.

Son mediciones de ejemplos sintéticos, no un SLA ni una prueba de carga de un aula completa. La compilación no demuestra compatibilidad eléctrica ni ejecución en una placa física. Las cuatro cuentas/proyectos sintéticos se retiraron mediante sus UUID exactos y las guardas del probe, sin borrar cuentas/proyectos reales. Los registros mínimos de auditoría del compilador siguen su plazo de siete días, sin documentos, claves ni referencias de artefactos.

Fuera de fase: grabación/monitor USB (10), producción/HTTPS/piloto (Fase final, postergada), ESP32-S3, control físico en vivo y backlog de interfaz. No se inició ninguna de esas fases.
