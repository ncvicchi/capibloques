# CapiBloques — contexto para continuar

Documento vivo de **fase 11**. Actualización: **8 de septiembre de 2026**. Leerlo desde el checkout vigente; no hace falta el historial del chat. Al terminar **cada fase solicitada**, actualizar aquí estado, pruebas, despliegue, pendientes y próxima autorización, junto con el plan y su guía de entrega.

## 1. Punto de entrada y autorización actual

- Repositorio: [ncvicchi/capibloques](https://github.com/ncvicchi/capibloques). Rama de trabajo actual: `main`. Nuevas ramas, si hacen falta: prefijo `codex/`. Respetar el árbol existente, sin reset/force ni descartar cambios ajenos.
- El propietario autorizó: **«vamos con 11 y 12»**, consecutivas y completas, sin pedir otro OK entre ellas. También pidió mantener esta documentación al cerrar la 12 y toda fase futura que solicite.
- Fase 11: preparar este traspaso, comprobarlo y hacer commit/push. Fase 12: UX, catálogo separado, cámara de escena, guía Wemos y sesión sin validación por foco. **No iniciar 13–17 ni producción por esta autorización.**
- Fase 10: software entregado, **aceptación física pendiente**. El propietario no tiene Wemos disponible; no dar por probada la placa ni conectar/programar otro puerto como sustituto.
- Producción es **Fase final, postergada**, no «fase 11». Los documentos históricos con letras son evidencias antiguas, no fases nuevas ni puntos para pedir OK.
- Este contexto no transfiere automáticamente credenciales, chats, sesiones ni permisos. Otra cuenta debe tener su propio acceso verificado y la solicitud del propietario antes de operar.

Orden de lectura: [AGENTS](../AGENTS.md) → este documento → [plan de fases pendientes](PLAN_FASES_BACKLOG.md) → [backlog](BACKLOG.md) → guía específica de la fase. El [plan principal](PLAN_MULTIUSUARIO_PROXMOX.md) conserva arquitectura y criterios transversales. Las guías antiguas describen su fecha, no necesariamente la operación vigente.

## 2. Producto y decisiones que no se deben perder

CapiBloques enseña programación visual a chicos de **8–12 años**. Se arma una escena con dispositivos, se programan bloques inspirados en Scratch, se simula el comportamiento en el navegador y se ejecuta autónomamente en una placa. No emula el ESP32 instrucción por instrucción.

- Una institución por instalación. Logo/nombre del colegio visibles antes del login. Cuentas creadas por administrador; alias y contraseña, sin correo obligatorio ni registro público. Roles administrador, docente y alumno.
- Proyectos personales con biblioteca, guardar/autoguardar, recuperación local, JSON portable, papelera e historial. Compartir con un curso es explícito. El docente revisa versiones guardadas y comenta sin editar el original; ser administrador no abre por sí solo trabajos privados ajenos.
- Escenas componibles: por ejemplo dos semáforos o semáforo y robot. LEDs/PWM, motores mediante driver, servos, buzzers activo/pasivo, botón, sensores, Wi-Fi y pantalla de mensajes. Potencia/velocidad son conceptos visibles para los chicos, no configuración técnica PWM obligatoria.
- Un único «al comenzar» obligatorio, fuera del catálogo; concurrencia mediante «al mismo tiempo». Favoritos por cuenta, avatares divertidos y ejecución normal/guiada sin alterar el algoritmo.
- **Una pantalla por proyecto.** LCD PCF8574 16×2/20×4, OLED SSD1306 I2C y TFT SPI ILI9341/ILI9488, con zonas de texto cuando corresponde. Consola/Serial y pantalla son destinos independientes.
- Conservar **Arduino y ESP-IDF nativo**, ambos. No introducir Arduino ocultamente en IDF. Fuentes y firmware son exportaciones diferentes; el JSON es el proyecto editable.
- El compilador del servidor sólo acepta proyectos de bloques validados, no C/C++/CMake arbitrario. Recursos limitados; concurrencia administrativa con techo operativo DEV **1**, sin aumentarlo por suposición.
- Wi-Fi: el propietario autorizó enviar SSID/clave para compilación privada temporal. Nunca entran en JSON/historial/Git/logs; el binario sí contiene la clave y debe seguir siendo privado. No prometer borrado forense de backups/RAM/flash.
- USB está conectado a la **PC del navegador**, no al servidor. Chrome/Edge, localhost/HTTPS, elección y confirmación explícitas. Monitor real sólo lectura; distinto de consola simulada. No control remoto de actuadores, OTA ni seguimiento físico de bloques.
- Placa implementada: Wemos D1 R32. S3 DevKit y Waveshare 5 pulgadas están pendientes; modelos/revisiones exactos deben identificarse. No copiar pines/offsets de Wemos a S3.

## 3. Corte verificable al iniciar este traspaso

| Evidencia | Estado y fecha |
| --- | --- |
| Código funcional anterior | `c1e469b`: límite UTF-8 del monitor Serial, verificado con pruebas dirigidas. |
| Documentación de cierre USB | `a289136`: entrega software fase 10; prueba física abierta. |
| Checkout local al iniciar fase 11 | `1c66362`, `main`, árbol limpio; incluye planificación y pedidos 1–10 del backlog. |
| DEV consultado por SSH, 8 septiembre | Host `capi-dev`, checkout limpio en `a289136`; editor/API/DB saludables, compilador `active`. Los commits posteriores de planificación todavía no estaban desplegados. |
| Recursos observados en esa consulta | 1967 MiB RAM, 2047 MiB swap, unos 10 GiB libres en filesystem de 31 GiB. Muestra puntual, no capacidad de un aula ni pico de consumo. |
| PRD | No se consultó durante este traspaso. Última evidencia de preparación en fase 0; no afirmar estado remoto actual. No desplegar allí. |
| CI general anterior | [34189286101](https://github.com/ncvicchi/capibloques/actions/runs/34189286101), commit `8dd4676`: cuatro jobs correctos según registro de fase 10. No atribuirlo al cambio posterior `c1e469b`. |

El estado remoto puede cambiar. Revalidar identidad, commit y salud antes de operar. Los hashes de arriba son un corte histórico, no una orden de volver atrás. Usar `git log` para encontrar entregas posteriores y actualizar esta sección al cerrarlas.

## 4. Arquitectura y mapa de archivos

| Área | Punto de entrada y responsabilidad |
| --- | --- |
| Rutas y UI | [app](../app), [capiblocks-app](../components/capiblocks-app.tsx), estilos [globals.css](../app/globals.css). React, Vinext/Vite y componentes Base UI existentes; conservar lockfile. |
| Identidad del editor | [editor-access](../components/editor-access.tsx), [account-session](../lib/account-session.ts), [accounts](../backend/accounts). Sesión/CSRF y borrador ligado a UUID, no al alias. |
| Escena | [scene-model](../lib/scene-model.ts), [scene-builder](../components/scene-builder.tsx), [scene-stage](../components/scene-stage.tsx). Modelo lógico, edición pendiente separada y vista/simulación. |
| Bloques y generación | [blockly-workspace](../components/blockly-workspace.tsx), [blockly-engine](../lib/blockly-engine.ts), [capiblocks](../lib/capiblocks.ts). Workspace → programa/grafo → simulador y generadores. |
| Simulación | [simulator.worker](../lib/simulator.worker.ts), [execution-panel](../components/execution-panel.tsx). Worker cooperativo, tiempos lógicos/trazas separados de presentación. |
| Pantallas y cableado | [display-model](../lib/display-model.ts), [display-arduino](../lib/display-arduino.ts), [display-idf](../lib/display-idf.ts), [wiring-guide](../components/wiring-guide.tsx). Validación compartida y revisión eléctrica explícita. |
| Recuperación | [project-recovery](../lib/project-recovery.ts), [scene-recovery](../lib/scene-recovery.ts), [local-exit](../lib/local-exit.ts), [use-project-autosave](../components/use-project-autosave.ts). IndexedDB/CAS, envíos pendientes y ACK. |
| Backend | [config/urls](../backend/config/urls.py); módulos [projects](../backend/projects), [courses](../backend/courses), [school](../backend/school), [compiler](../backend/compiler). Django/PostgreSQL. |
| Compilación | [ops/compiler](../ops/compiler), [compiler-generate](../scripts/compiler-generate.mjs), [firmware-builds](../components/firmware-builds.tsx). Cola durable, planificador confiable y ejecutor efímero aislado. |
| USB | [usb-board](../components/usb-board.tsx), [usb-firmware](../lib/usb-firmware.ts), [usb-session](../lib/usb-session.ts), [usb-esptool](../lib/usb-esptool.ts). ZIP/hashes, autorización, exclusividad, cancelación y adaptador. |
| Verificación | [scripts](../scripts), [tests](../tests), [backend/tests](../backend/tests), [CI](../.github/workflows/ci.yml), [Playwright](../playwright.config.ts). Pruebas sintéticas separadas de datos reales. |

Versiones fijadas: Node DEV 22.23.2, React 19.2.8, Blockly 12.5.1, Vinext 1.0.0-beta.9, Django 5.2.17, PostgreSQL 17.11 observado, Arduino CLI 1.5.1/core ESP32 3.3.11 y ESP-IDF 5.5.5. Confirmar declaraciones en [package.json](../package.json), lockfile, [requirements](../backend/requirements.txt), Compose y Dockerfiles. Node local observado al iniciar: 22.20.0/npm 11.10.0, no idéntico al contenedor. No actualizar versiones incidentalmente.

## 5. Contratos críticos y riesgos de regresión

- Permisos frescos dentro de `access_lock()`, revisiones optimistas y operaciones idempotentes. No mutar cuentas/membresías/proyectos por SQL o bulk saltando servicios. Conservar último administrador y revocación.
- JSON portable sin identidad remota, credenciales ni estado transitorio. Importar/nuevo/ejemplos desvinculan la biblioteca después de confirmar reemplazo. No resucitar papelera ni sobrescribir cambios concurrentes.
- Guardar pendiente conserva operación/documento ante respuestas perdidas. IndexedDB por cuenta/copia, CAS entre pestañas, ACK y documento posterior atómicos. No limpiar storage global ni una cuenta real para probar.
- Desconexión permite continuar sólo el proyecto ya cargado, con sesión no vencida y consentimiento cuando corresponde. No autenticar offline ni hacer peticiones con permisos conocidos retirados. Perder foco no equivale a revocación: fase 12 cambia ese comportamiento de UX, no las guardas de permisos.
- Escena pendiente no es proyecto confirmado. Guardar/Cancelar esperan persistencia; deshacer/rehacer no deben publicar cambios automáticamente. Referencias de dispositivos/zonas retirados se diagnostican, no se reasignan a escondidas.
- Revisiones comentadas quedan protegidas. Bajas/purgas exigen conteo, confirmaciones y respaldo vigente; no cascadas incidentales. Los ZIP administrativos restauran contenido por importación, no identidad de cuenta/membresías.
- Compilador: límite global compartido, no liberar cupo sólo por lease vencido; confirmar terminación del contenedor. No ampliar red/montajes/socket/privilegios para resolver un build. Wi-Fi no reutiliza caché.
- USB: validar SHA-256/manifiesto/segmentos y chip/capacidad antes de escribir, verificar transferencia, un dueño del puerto, revalidar acceso. Cancelar no garantiza firmware válido; cerrar pestaña no detiene hardware.
- La compilación y los dobles de pruebas no certifican funcionamiento físico ni seguridad eléctrica. Usar drivers/alimentación adecuados y avisos existentes, sin enseñar conexiones directas engañosas.

## 6. Entornos y operación

### Límites de autorización

VM 112 `capi-dev`, desarrollo; VM 113 `capi-prd`, producción. Ambas preparadas con Ubuntu Server 24.04; recursos limitados. **Gateway sólo salto TCP SSH, jamás comandos/configuración/instalación/reinicio ni copia de claves.** Proxmox/router/Nginx tampoco se cambian incidentalmente. No reenviar agente ni desactivar comprobación de huellas. No modificar PRD por estar disponible.

### Acceso de desarrollo desde Windows

El checkout de la VM está en `/home/capi/capibloques`. El propietario configura el archivo SSH privado fuera de Git, alias `capibloques-dev`; [plantilla y túnel](FASE_0B_DESARROLLO.md#conectarse-desde-windows). No incluir aquí hosts del salto, contraseñas ni rutas de claves.

```powershell
.\scripts\connect-dev.ps1
# Sólo estando realmente en LAN:
.\scripts\connect-dev.ps1 -DirectLan
```

Mantener **un túnel dedicado** y una sesión administrativa separada. Reutilizar túnel existente; no arrancar duplicados. Navegación: `http://localhost:3000/`; salud: `/api/health/live/` y `/api/health/ready/`. `localhost` es la entrada local al servidor remoto, no evidencia de un servidor en la PC. Otro puerto/host cambia el origen y sus borradores locales.

No hay autenticación SSH desatendida garantizada: durante el traspaso la conexión sin contraseña fue rechazada y se ingresó interactivamente. Que GitHub funcione por SSH en la VM no significa que el acceso a la VM use la misma autenticación. Si faltan credenciales, pedir al propietario que las configure por canal privado; no rotarlas ni crear una cuenta del asistente.

### Consultas seguras en DEV, después de autenticar

```sh
test "$(hostname)" = capi-dev || exit 1
cd /home/capi/capibloques
git status --short --branch
git rev-parse HEAD
sudo docker compose -f compose.dev.yaml -f compose.backend.dev.yaml -f compose.compiler.dev.yaml ps
systemctl is-active capibloques-compiler
df -h /
free -m
curl --fail --max-time 12 http://127.0.0.1:3000/api/health/ready/
```

No imprimir `.env`, secretos, logs de proyectos/credenciales ni configurar `set -x`. `ps` y comprobaciones de salud no reemplazan pruebas funcionales.

### Cambios de DEV: procedimientos, no ejecutarlos automáticamente

- Usar **tres Compose** al crear/recrear API: [editor](../compose.dev.yaml), [backend](../compose.backend.dev.yaml), [compilador](../compose.compiler.dev.yaml). El tercero conserva el montaje privado de firmware. API/DB no publican puertos al host; editor sólo loopback.
- Antes de pull/dependencias, detener **sólo editor** para evitar HMR sobre código incompleto y presión de RAM. No solapar instalación/build con editor; no iniciar un servidor alternativo para simular haber probado DEV.
- Si sólo cambia frontend: árbol remoto limpio → detener editor → `git pull --ff-only origin main` → instalar con `npm ci` en contenedor sólo si cambió lockfile → levantar editor con tres Compose → esperar salud → probar el commit correcto. No reinstalar toolchains ni recrear base por un cambio CSS/React.
- Si cambia backend: revisar migraciones, hacer respaldo privado previo y seguir [fase 1](FASE_1_BASE_REPRODUCIBLE.md), sus ampliaciones y [operación de fase 9](FASE_9_COMPILACION_Y_DESCARGA.md#operación-dev). No usar la receta histórica de un solo Compose.
- Si cambia receta/compilador: pausar admisión, dejar terminar trabajos y comprobar ausencia de activos; seguir fase 9. No invalidar intentos ni liberar reservas a mano. Mantener concurrencia/techo 1.
- No `down -v`, `docker system prune`, `git reset --hard`, regeneración de secretos ni borrado de checkout para recuperar. Un rollback necesita revisar compatibilidad de datos y alcance; no restaurar sobre la base real como prueba.

### Pruebas locales y contra DEV

En la PC, desde el repositorio con dependencias del lockfile instaladas:

```powershell
npm run typecheck
npm run lint
npm run test:smoke
npm run test:usb
npm run test:idf
npm run build
```

Elegir además pruebas de drivers y backend según riesgo. Compiladores completos de Arduino/IDF están en CI/DEV; no instalarlos en Windows sin necesidad. `npm run dev` es el servidor de desarrollo; `npm start` es Wrangler heredado, no el despliegue Proxmox. Un editor local sin API no valida autenticación real. Preservar `.openai/hosting.json` heredado, **no publicar ni registrar Sites/Pages**.

Contra DEV, con túnel activo y Chrome/Edge instalados:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
npm run test:e2e -- --project=chrome --project=edge --workers=1
```

Una URL externa deshabilita el servidor alternativo de Playwright. Las pruebas UI interceptan identidad/API con fixtures: describirlo, no confundirlo con login real o permisos PostgreSQL. `PLAYWRIGHT_API=1` habilita comprobaciones de salud cuando el caso lo requiere. Eliminar las variables de esa terminal al volver a tests locales. No aumentar timeouts/reintentos para ocultar un fallo.

Backend en DEV: `sudo sh scripts/verify-backend-dev.sh`, en base separada `test_capibloques`. **`--restart` recrea servicios y no se usa con compilaciones activas**. CI contiene sus propias pruebas y no despliega ni en Proxmox ni en Pages. Los casos de UI nunca deben modificar proyectos o contraseñas de personas reales.

## 7. Datos, respaldo y recuperación de acceso

Datos permanentes: PostgreSQL (cuentas, colegio/logo, cursos, proyectos, historial/devoluciones) y secretos externos al checkout. Volumen persistente no es respaldo. Hay registros de dumps privados en DEV y verificación de catálogo; **no hay ensayo de restauración integral ni backup externo certificado**. Eso permanece en Fase final antes del piloto con datos reales.

Datos locales: IndexedDB y preferencias de cada cuenta/origen/perfil de navegador. Otra cuenta de la herramienta de desarrollo no migra esos datos. Exportar desde CapiBloques si el propietario cambia navegador/equipo; no copiar todo el perfil ni tokens. JSON no restaura cuentas o permisos.

Recuperar acceso mediante [guía de cuentas](FASE_2A_ACCESO.md) y [script del administrador](../scripts/setup-dev-admin.ps1), sólo con nueva petición explícita si implica restablecer contraseña. El alias elegido fue `Administrador`; no existe contraseña pública vigente y el chat no es un almacén de credenciales. No borrar/recrear usuario: cambiaría UUID y propiedad de datos.

Artefactos compilados caducan y pueden contener Wi-Fi; no subirlos como contexto ni respaldarlos rutinariamente. Logs, traces, capturas y `work/outputs` locales tampoco se suben indiscriminadamente. Sólo fixtures sintéticos y documentación saneada en Git.

## 8. Qué está pendiente

El [plan detallado](PLAN_FASES_BACKLOG.md) define aceptación y el [backlog](BACKLOG.md) conserva la intención original. Resumen:

- 10: prueba física Wemos de ambos frameworks y recuperación USB.
- 11: entregar y comprobar este contexto; mantenerlo en futuras fases.
- 12, autorizada a continuación: reorganizar encabezados/catálogo, zoom/desplazamiento de escena, imagen técnica Wemos sincronizada y chequeo periódico de sesión sin interrupciones por foco. Pendiente de implementar al escribir este corte.
- 13: paralelo vertical, lienzo de bloques estático e indicadores locales de progreso.
- 14: TX/RX serial configurable con mensajes completos, espera no bloqueante y bifurcación.
- 15: DevKit S3 exacta, perfiles, imagen de conexiones, fuentes/compilación/USB.
- 16: Waveshare S3 5 pulgadas exacta, pantalla/entrada y guía visual de conectores.
- 17: escena y controles locales en display, prioridad manual/programa explícita.
- Final: producción/HTTPS, restauración/backups externos, carga, monitoreo, rollback y piloto; postergada.

No esperar hardware para documentar o mejorar UX. Sí exigir modelo/documentación y ensayo físico antes de anunciar soporte de placa. El diagrama Wemos debe verificarse: hay pinouts públicos con etiquetas contradictorias; no convertir una ilustración en fuente única de verdad.

## 9. Mensaje listo para otra conversación

> Continuá CapiBloques desde este repositorio. Primero leé AGENTS.md y docs/CONTEXTO_PARA_CONTINUAR.md, luego el plan y la guía de la fase vigente. Confirmá rama, cambios locales y versión desplegada antes de operar. El contexto indica qué fases están autorizadas y cuáles no: no infieras autorización por estar en el backlog. Trabajá una fase completa por vez, informá avances, probá, hacé commit/push y actualizá este contexto al terminar. Producción está postergada. El gateway es exclusivamente un salto SSH y está prohibido modificarlo. No copies secretos ni borres datos para recuperar acceso. La aceptación física de fase 10 sigue pendiente salvo evidencia posterior explícita. Decime qué contexto o acceso privado falta sin pedir contraseñas en Git o documentación.

## 10. Lista de cierre y mantenimiento obligatorio

1. Registrar autorización exacta y alcance entregado; distinguir pendiente, bloqueado y postergado, sin porcentajes ficticios.
2. Actualizar este corte con commits funcionales, pruebas y resultados reales, límites/mocks, fecha de verificación remota y versión desplegada. No adjudicar a un commit una prueba corrida sobre otro.
3. Enlazar la guía de entrega nueva y actualizar plan, backlog, README/AGENTS cuando cambie su estado. Mantener enlaces históricos sin llamar completas funciones no verificadas.
4. Revisar que no haya credenciales, datos infantiles, artefactos privados o rutas de claves en el diff. Verificar enlaces desde un checkout limpio y comandos de consulta, sin ejecutar operaciones destructivas como prueba.
5. Hacer commit/push de cambios verificados, confirmar árbol limpio y remoto. No desplegar si sólo cambió documentación; cambios de aplicación se verifican en DEV según su alcance.
6. Dejar próximos pasos concretos, procesos/túneles normales retenidos y trabajos temporales terminados o explícitamente pendientes. No dejar una prueba que requiere atención corriendo sin informar.

La documentación de fase 11 **no se congela** al completar su primera entrega: es el punto de continuidad obligatorio para la fase 12 y todas las siguientes que autorice el propietario.
