# CapiBloques — contexto para continuar

Documento vivo de **fase 11**. Actualización: **12 de septiembre de 2026**. Leerlo desde el checkout vigente; no hace falta el historial del chat. Al terminar **cada fase solicitada**, actualizar aquí estado, pruebas, despliegue, pendientes y próxima autorización, junto con el plan y su guía de entrega.

## 1. Punto de entrada y autorización actual

- Repositorio: [ncvicchi/capibloques](https://github.com/ncvicchi/capibloques). Rama de trabajo actual: `main`. Nuevas ramas, si hacen falta: prefijo `codex/`. Respetar el árbol existente, sin reset/force ni descartar cambios ajenos.
- El propietario autorizó: **«vamos con 11 y 12»**, consecutivas y completas, sin pedir otro OK entre ellas. También pidió mantener esta documentación al cerrar la 12 y toda fase futura que solicite.
- **Fases 11, 12 y 13 entregadas.** La 11 es contexto portable con mantenimiento obligatorio; la 12 entrega UX, catálogo separado, cámara de escena, guía Wemos y sesión sin validación por foco. La 13 publica DEV de forma persistente y segura en `https://capibloques.dev.nvicchi.com/`. Las fases 14–18 y producción no están autorizadas.
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

## 3. Evidencia y versiones

### Corte histórico al iniciar el traspaso

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

### Entrega de fases 11 y 12 — 8 de septiembre de 2026

| Evidencia | Resultado |
| --- | --- |
| Fase 11 inicial | `14c4dcc`: contexto, reglas y planes publicados. Clone limpio desde GitHub y 55 destinos de enlaces locales del contexto comprobados; no depende del chat ni transfiere credenciales. |
| Código de fase 12 | Implementación desde `6143bbe`, corregida y verificada hasta **`668be43`**. Mesa de trabajo, cámara, Wemos, sesiones y correcciones de Deshacer/Exportar/botones/scroll móvil. Secuencia y evidencia en la [guía de entrega](FASE_12_MESA_DE_TRABAJO.md). |
| DEV verificado al cierre | `capi-dev`, checkout limpio en `668be43832c99b23f09295f8356d44d1c495503b`. Editor/API/DB saludables y planificador `active`; salud VM/túnel `ok`. Sólo editor reiniciado; API/base/compilador no recreados, concurrencia 1. |
| Tipos, lint, unidad y build | Correctos sobre `668be43` en CI; siete grupos smoke, drivers, USB, aislamiento y 10 páginas estáticas verificadas. Permanece aviso de chunks grandes, no error de build. `npm audit`: cero vulnerabilidades conocidas tras parche acotado sharp 0.35.4. |
| Altura útil comparable | 54,9 % → 80,6 % a 1366 × 768; capturas y método en la guía. No confundir esta proporción de pantalla con avance del proyecto. |
| Navegadores | **124/124 Chrome/Edge sobre `63c96b2`**, más **46/46 sobre `668be43`**, sin reintentos. Acceso/autoguardado, mesa de trabajo, móvil/fuentes/scroll, programación, compilación/Wi-Fi, revisión docente y salida. Fixtures UI sintéticos, salud sin interceptar y backend separado; no es aceptación física. Historial de pruebas en la guía de entrega. |
| CI final | [34291829169](https://github.com/ncvicchi/capibloques/actions/runs/34291829169), commit `668be43`: cuatro jobs correctos. 174 pruebas Chromium más dos regresiones rápidas, 179 backend/persistencia, siete Arduino y siete ESP-IDF. Reporte sin flaky. |
| Documentación y entornos | Los commits de documentación posteriores no cambian la versión funcional DEV. PRD/gateway/Proxmox/router/Nginx sin cambios; Pages/Sites sin publicación. |

Este corte sustituye al histórico para continuar, sin borrar su trazabilidad. Consultar nuevamente estado remoto si se retoma en otra fecha. El mantenimiento del contexto acompaña cada fase futura autorizada.

### Entrega de fase 13 — 12 de septiembre de 2026

| Evidencia | Resultado |
| --- | --- |
| Código y runtime | `f1944f3`, correcciones operativas `c49f13f` y `1ee0df9`; editor estático Nginx no-root, proxy seguro, firewall y systemd. |
| DEV | `capi-dev` limpio en `2597284` (runtime funcional `1ee0df9`); editor/API/DB saludables, compilador activo, túnel `localhost:3000` conservado y listener LAN `3080` limitado al edge. Reinicio completo verificado. |
| Público | `https://capibloques.dev.nvicchi.com/` y `/api/health/ready/` HTTP 200; certificado válido hasta 2026-12-11 y ensayo de renovación correcto. Producción continúa sin vhost/certificado CapiBloques. |
| Pruebas | 197 backend PostgreSQL, 8 contratos, build de 10 páginas y 18/18 Chrome/Edge externos. PRD no pudo acceder directamente al puerto 3080. |
| Acceso DEV | Login de CapiBloques sin segunda Basic Auth, decisión documentada; datos sintéticos, rate-limit, cookies Secure, allowlists y proxy confiable acotados. El 12 de septiembre se verificó el ingreso real por HTTPS de la cuenta `administrador` después de restablecer su clave; la clave no se documenta ni se transfiere. |

Próxima fase posible: **14, ejecución visual dentro de bloques y paralelo vertical**. Requiere autorización expresa; no iniciar 15–18 ni la Fase final.

Validación documental de cierre: **130 destinos locales en ocho documentos**, sin archivos faltantes ni diferencias de mayúsculas/minúsculas; las anclas operativas del túnel y compilador también se contrastaron. Los únicos recursos gráficos publicados son las dos capturas de fixtures sintéticos enlazadas desde la guía.

Al terminar esta entrega se cerró la sesión SSH administrativa y finalizaron las pruebas locales. Se conserva el túnel habitual para navegar DEV; apagar la PC sólo corta ese acceso local, no detiene los servicios de la VM. Los archivos de diagnóstico quedan ignorados en `work/`/`test-results/`; no son parte necesaria del traspaso ni deben publicarse indiscriminadamente.

### Corrección documental — 12 de septiembre de 2026

Autorización del propietario: **«Corregi la documentacion, luego dame una lista de las fases pendiente»**. Se corrigen el estado de fase 13, la disponibilidad de USB y las recetas de operación anteriores al runtime público. La [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) se contrasta con el código del runtime; las guías antiguas conservan su evidencia histórica y remiten a ella.

Esta entrega sólo cambia documentación. El punto de partida local es `a74b427`, rama `main`, árbol limpio; el commit de corrección queda identificado en Git. La validación documental abarca diff y coherencia, más **189 enlaces locales y 37 anclas en 28 documentos**, con comprobación de nombres exactos y repetición desde un checkout limpio antes de publicar. No se repiten pruebas de aplicación ni consultas a las VMs: el último registro remoto sigue siendo `2597284`, runtime funcional `1ee0df9`, observado al cierre de fase 13. No corresponde desplegar por estos cambios.

Pendientes sin cambio: aceptación física de fase 10; fases 14–18 sin autorización y Fase final postergada. El script de pruebas backend conserva una limitación operativa: `--restart` no carga la configuración pública; su uso directo queda excluido de la receta DEV vigente, sin afirmar que el script se haya corregido.

## 4. Arquitectura y mapa de archivos

| Área | Punto de entrada y responsabilidad |
| --- | --- |
| Rutas y UI | [app](../app), [capiblocks-app](../components/capiblocks-app.tsx), estilos [globals.css](../app/globals.css). React, Vinext/Vite y componentes Base UI existentes; conservar lockfile. |
| Identidad del editor | [editor-access](../components/editor-access.tsx), [account-session](../lib/account-session.ts), [session-polling](../lib/session-polling.ts), [accounts](../backend/accounts). Sesión/CSRF y borrador ligado a UUID, no al alias; reloj periódico sin consultas por foco. |
| Escena | [scene-model](../lib/scene-model.ts), [scene-builder](../components/scene-builder.tsx), [scene-stage](../components/scene-stage.tsx). Modelo lógico, edición pendiente separada y vista/simulación. Cámara transitoria en [scene-viewport](../components/scene-viewport.tsx) y [scene-camera](../lib/scene-camera.ts). |
| Bloques y generación | [blockly-workspace](../components/blockly-workspace.tsx), [blockly-engine](../lib/blockly-engine.ts), [capiblocks](../lib/capiblocks.ts). Workspace → programa/grafo → simulador y generadores. |
| Simulación | [simulator.worker](../lib/simulator.worker.ts), [execution-panel](../components/execution-panel.tsx). Worker cooperativo, tiempos lógicos/trazas separados de presentación. |
| Pantallas y cableado | [display-model](../lib/display-model.ts), [display-arduino](../lib/display-arduino.ts), [display-idf](../lib/display-idf.ts), [wiring-guide](../components/wiring-guide.tsx). Validación compartida y revisión eléctrica explícita. |
| Imagen Wemos | [wemos-board UI](../components/wemos-board.tsx), [mapa físico](../lib/wemos-board.ts), [referencias contrastadas](REFERENCIA_WEMOS.md). Listado/dibujo comparten conexiones; ilustración propia, no certificación eléctrica. |
| Recuperación | [project-recovery](../lib/project-recovery.ts), [scene-recovery](../lib/scene-recovery.ts), [local-exit](../lib/local-exit.ts), [use-project-autosave](../components/use-project-autosave.ts). IndexedDB/CAS, envíos pendientes y ACK. |
| Backend | [config/urls](../backend/config/urls.py); módulos [projects](../backend/projects), [courses](../backend/courses), [school](../backend/school), [compiler](../backend/compiler). Django/PostgreSQL. |
| Compilación | [ops/compiler](../ops/compiler), [compiler-generate](../scripts/compiler-generate.mjs), [firmware-builds](../components/firmware-builds.tsx). Cola durable, planificador confiable y ejecutor efímero aislado. |
| USB | [usb-board](../components/usb-board.tsx), [usb-firmware](../lib/usb-firmware.ts), [usb-session](../lib/usb-session.ts), [usb-esptool](../lib/usb-esptool.ts). ZIP/hashes, autorización, exclusividad, cancelación y adaptador. |
| Verificación | [scripts](../scripts), [tests](../tests), [backend/tests](../backend/tests), [CI](../.github/workflows/ci.yml), [Playwright](../playwright.config.ts). Pruebas sintéticas separadas de datos reales. |

Versiones fijadas: Node 22.23.2 en la etapa de construcción del frontend, React 19.2.8, Blockly 12.5.1, Vinext 1.0.0-beta.9, Django 5.2.17, PostgreSQL 17.11 observado, Arduino CLI 1.5.1/core ESP32 3.3.11 y ESP-IDF 5.5.5. El contenedor público `editor` sirve archivos estáticos y no ejecuta Node. Confirmar declaraciones en [package.json](../package.json), lockfile, [requirements](../backend/requirements.txt), Compose y Dockerfiles. Node local observado al iniciar: 22.20.0/npm 11.10.0, no idéntico al builder. No actualizar versiones incidentalmente.

## 5. Contratos críticos y riesgos de regresión

- Permisos frescos dentro de `access_lock()`, revisiones optimistas y operaciones idempotentes. No mutar cuentas/membresías/proyectos por SQL o bulk saltando servicios. Conservar último administrador y revocación.
- JSON portable sin identidad remota, credenciales ni estado transitorio. Importar/nuevo/ejemplos desvinculan la biblioteca después de confirmar reemplazo. No resucitar papelera ni sobrescribir cambios concurrentes.
- Guardar pendiente conserva operación/documento ante respuestas perdidas. IndexedDB por cuenta/copia, CAS entre pestañas, ACK y documento posterior atómicos. No limpiar storage global ni una cuenta real para probar.
- Desconexión permite continuar sólo el proyecto ya cargado, con sesión no vencida y consentimiento cuando corresponde. No autenticar offline ni hacer peticiones con permisos conocidos retirados. Desde fase 12, reloj compartido de 60 segundos, sin consultas por foco/visibilidad ni desmontar el editor por una sesión igual. Mantener expiración conocida, señales de salida/cambio de cuenta, BFCache, recuperación de conexión y autorización fresca de cada operación.
- Escena pendiente no es proyecto confirmado. Guardar/Cancelar esperan persistencia; deshacer/rehacer no deben publicar cambios automáticamente. Referencias de dispositivos/zonas retirados se diagnostican, no se reasignan a escondidas.
- Cámara de escena fuera del JSON, guardado e historial; conservar encuadre al ejecutar/pasar de pestaña y coordenadas inversas al arrastrar. Un primer frame sin movimiento efectivo no abre un grupo de Deshacer sin instantánea inicial. El catálogo temporal no debe bloquear el arrastre ni ocultar cómo cerrarlo.
- `ExecutionPanel` debe permanecer montado: confirma cuadros de ejecución guiada. Trasladar su UI no permite retirar ese ACK. Los errores de almacenamiento deben dejar Exportar y salida alcanzables inmediatamente.
- Revisiones comentadas quedan protegidas. Bajas/purgas exigen conteo, confirmaciones y respaldo vigente; no cascadas incidentales. Los ZIP administrativos restauran contenido por importación, no identidad de cuenta/membresías.
- Compilador: límite global compartido, no liberar cupo sólo por lease vencido; confirmar terminación del contenedor. No ampliar red/montajes/socket/privilegios para resolver un build. Wi-Fi no reutiliza caché.
- USB: validar SHA-256/manifiesto/segmentos y chip/capacidad antes de escribir, verificar transferencia, un dueño del puerto, revalidar acceso. Cancelar no garantiza firmware válido; cerrar pestaña no detiene hardware.
- La compilación y los dobles de pruebas no certifican funcionamiento físico ni seguridad eléctrica. Usar drivers/alimentación adecuados y avisos existentes, sin enseñar conexiones directas engañosas.

## 6. Entornos y operación

### Límites de autorización

VM 112 `capi-dev`, desarrollo; VM 113 `capi-prd`, producción. Ambas preparadas con Ubuntu Server 24.04; recursos limitados. **Gateway sólo salto TCP SSH, jamás comandos/configuración/instalación/reinicio ni copia de claves.** La [fase 13 entregada](FASE_13_ACCESO_EXTERNO_DEV.md) modificó de forma acotada la VM Nginx autorizada; nunca el gateway, host Proxmox, router, PRD u otros sitios.

### Acceso de desarrollo desde Windows

El checkout de la VM está en `/home/capi/capibloques`. El propietario configura el archivo SSH privado fuera de Git, alias `capibloques-dev`; [plantilla y túnel](FASE_0B_DESARROLLO.md#conectarse-desde-windows). No incluir aquí hosts del salto, contraseñas ni rutas de claves.

```powershell
.\scripts\connect-dev.ps1
# Sólo estando realmente en LAN:
.\scripts\connect-dev.ps1 -DirectLan
```

La entrada normal de DEV es `https://capibloques.dev.nvicchi.com/`; salud pública: `/api/health/live/` y `/api/health/ready/`. El túnel dedicado a `http://localhost:3000/` se conserva sólo para recuperación y tareas acotadas: reutilizar el existente y no arrancar duplicados. `localhost` es una entrada local al servidor remoto, no evidencia de un servidor en la PC. Ambos son orígenes distintos y no comparten IndexedDB, borradores ni preferencias del navegador.

No hay autenticación SSH desatendida garantizada: durante el traspaso la conexión sin contraseña fue rechazada y se ingresó interactivamente. Que GitHub funcione por SSH en la VM no significa que el acceso a la VM use la misma autenticación. Si faltan credenciales, pedir al propietario que las configure por canal privado; no rotarlas ni crear una cuenta del asistente.

### Consultas seguras en DEV, después de autenticar

```sh
test "$(hostname)" = capi-dev || exit 1
cd /home/capi/capibloques
git status --short --branch
git rev-parse HEAD
sudo capibloques-dev-runtime status
sudo capibloques-dev-runtime validate
systemctl is-active capibloques-compiler
df -h /
free -m
curl --fail --max-time 12 http://127.0.0.1:3000/api/health/ready/
```

No imprimir `.env`, secretos, logs de proyectos/credenciales ni configurar `set -x`. `ps` y comprobaciones de salud no reemplazan pruebas funcionales.

### Cambios de DEV: procedimientos, no ejecutarlos automáticamente

- La fuente operativa es [fase 13: operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). El runtime combina **tres Compose** y la configuración privada: [editor](../compose.dev.yaml), [backend](../compose.backend.dev.yaml) y [compilador](../compose.compiler.dev.yaml). Conserva el montaje privado de firmware, API/DB sin puertos públicos y el origen LAN restringido al edge.
- Antes de actualizar código o construir, confirmar identidad y árbol limpio; pausar admisión, dejar terminar trabajos y detener el planificador. El backend está montado desde el checkout: si cambia, preparar una ventana específica y respaldo antes del pull. El runtime público no usa HMR; el builder Node no se solapa con editor ni con compilaciones de proyectos.
- Para una actualización sólo de frontend, actualizar por avance rápido y usar `sudo capibloques-dev-runtime deploy`. El runtime construye la imagen versionada, gestiona la parada/arranque mediante systemd y espera salud. No ejecutar `npm ci` dentro de `editor` ni levantarlo manualmente con Compose. Tras verificar versión, salud y recorrido funcional, restituir planificador/admisión según la guía.
- Si cambia backend o la configuración de confianza del proxy, revisar respaldo, imagen/dependencias y migraciones antes de `deploy --with-api`. Esa opción recrea API con el entorno privado, pero **no construye su imagen ni ejecuta migraciones**. Las recetas antiguas de fases 1/2/9 no sustituyen el procedimiento público vigente.
- Si cambia receta/compilador, conservar además los contratos de [fase 9](FASE_9_COMPILACION_Y_DESCARGA.md#operación-dev). No invalidar intentos ni liberar reservas a mano. Mantener concurrencia/techo 1.
- `rollback <tag>` sólo revierte la imagen frontend; no revierte backend, checkout ni datos. No usar `down -v`, `docker system prune`, `git reset --hard`, regeneración de secretos ni borrado de checkout para recuperar. No restaurar sobre la base real como prueba.

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

Backend en DEV: `sudo sh scripts/verify-backend-dev.sh`, **sin `--restart`**, usa API/DB ya iniciadas y migradas, con base separada `test_capibloques`; puede crear esa base de pruebas. El script no carga la configuración privada de fase 13: su opción `--restart` recrearía API/DB sin conservar necesariamente hosts, CSRF, proxies y cookies del entorno público. No usarla tal cual en DEV; CI la usa en su entorno aislado. Toda recreación pública debe preservar los tres Compose y el entorno privado, con mantenimiento y verificaciones de [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). CI no despliega en Proxmox ni Pages. Los casos de UI nunca deben modificar proyectos o contraseñas de personas reales.

## 7. Datos, respaldo y recuperación de acceso

Datos permanentes: PostgreSQL (cuentas, colegio/logo, cursos, proyectos, historial/devoluciones) y secretos externos al checkout. Volumen persistente no es respaldo. Hay registros de dumps privados en DEV y verificación de catálogo; **no hay ensayo de restauración integral ni backup externo certificado**. Eso permanece en Fase final antes del piloto con datos reales.

Datos locales: IndexedDB y preferencias de cada cuenta/origen/perfil de navegador. Otra cuenta de la herramienta de desarrollo no migra esos datos. Exportar desde CapiBloques si el propietario cambia navegador/equipo; no copiar todo el perfil ni tokens. JSON no restaura cuentas o permisos.

Recuperar acceso mediante [guía de cuentas](FASE_2A_ACCESO.md) y [script del administrador](../scripts/setup-dev-admin.ps1), sólo con nueva petición explícita si implica restablecer contraseña. El alias elegido fue `Administrador`; no existe contraseña pública vigente y el chat no es un almacén de credenciales. No borrar/recrear usuario: cambiaría UUID y propiedad de datos.

Artefactos compilados caducan y pueden contener Wi-Fi; no subirlos como contexto ni respaldarlos rutinariamente. Logs, traces, capturas y `work/outputs` locales tampoco se suben indiscriminadamente. Sólo fixtures sintéticos y documentación saneada en Git.

## 8. Qué está pendiente

El [plan detallado](PLAN_FASES_BACKLOG.md) define aceptación y el [backlog](BACKLOG.md) conserva la intención original. Resumen:

- 10: prueba física Wemos de ambos frameworks y recuperación USB.
- 11: entregada y comprobada; mantenimiento obligatorio en futuras fases, no requiere reiniciar el traspaso.
- 12: **entregada y verificada en DEV/CI**; [guía, pruebas y cierre](FASE_12_MESA_DE_TRABAJO.md). Encabezados/catálogo reorganizados, zoom/desplazamiento de escena, imagen técnica Wemos sincronizada y chequeo periódico sin interrupciones por foco.
- 13: **entregada y verificada externamente**; [acceso persistente a DEV](FASE_13_ACCESO_EXTERNO_DEV.md), HTTPS mediante VM Nginx, runtime como servicio y origen restringido. DNS, certificado, reinicio y acceso Chrome/Edge están comprobados.
- 14: paralelo vertical, lienzo de bloques estático e indicadores locales de progreso.
- 15: TX/RX serial configurable con mensajes completos, espera no bloqueante y bifurcación.
- 16: DevKit S3 exacta, perfiles, imagen de conexiones, fuentes/compilación/USB.
- 17: Waveshare S3 5 pulgadas exacta, pantalla/entrada y guía visual de conectores.
- 18: escena y controles locales en display, prioridad manual/programa explícita.
- Final: producción/HTTPS, restauración/backups externos, carga, monitoreo, rollback y piloto; postergada.

La próxima fase de desarrollo posible es **14, aún no autorizada para ejecución**. No esperar hardware para mejorar esa ejecución visual, pero conservar separada la aceptación física pendiente de fase 10. Sí exigir modelo/documentación y ensayo físico antes de anunciar soporte de una placa nueva. El diagrama Wemos fue contrastado con las fuentes enlazadas; conservar esa verificación al ampliarlo, porque existen pinouts públicos contradictorios. No convertir una ilustración en fuente única de verdad.

## 9. Mensaje listo para otra conversación

> Continuá CapiBloques desde este repositorio. Primero leé AGENTS.md y docs/CONTEXTO_PARA_CONTINUAR.md, luego el plan y la guía de la fase vigente. Confirmá rama, cambios locales y versión desplegada antes de operar. Las fases 11–13 están entregadas; DEV funciona públicamente en https://capibloques.dev.nvicchi.com/ y la próxima fase posible es 14, pero no está autorizada. No infieras autorización por estar en el backlog. Trabajá una fase completa por vez, informá avances, probá, hacé commit/push y actualizá este contexto al terminar. Producción es la Fase final y está postergada. El gateway es exclusivamente un salto SSH y está prohibido modificarlo; tampoco modifiques Proxmox, router, PRD u otros sitios. No copies secretos, no documentes contraseñas ni borres datos para recuperar acceso. La aceptación física de fase 10 sigue pendiente salvo evidencia posterior explícita. Decime qué contexto o acceso privado falta sin pedir credenciales en Git o documentación.

## 10. Lista de cierre y mantenimiento obligatorio

1. Registrar autorización exacta y alcance entregado; distinguir pendiente, bloqueado y postergado, sin porcentajes ficticios.
2. Actualizar este corte con commits funcionales, pruebas y resultados reales, límites/mocks, fecha de verificación remota y versión desplegada. No adjudicar a un commit una prueba corrida sobre otro.
3. Enlazar la guía de entrega nueva y actualizar plan, backlog, README/AGENTS cuando cambie su estado. Mantener enlaces históricos sin llamar completas funciones no verificadas.
4. Revisar que no haya credenciales, datos infantiles, artefactos privados o rutas de claves en el diff. Verificar enlaces desde un checkout limpio y comandos de consulta, sin ejecutar operaciones destructivas como prueba.
5. Hacer commit/push de cambios verificados, confirmar árbol limpio y remoto. No desplegar si sólo cambió documentación; cambios de aplicación se verifican en DEV según su alcance.
6. Dejar próximos pasos concretos, procesos/túneles normales retenidos y trabajos temporales terminados o explícitamente pendientes. No dejar una prueba que requiere atención corriendo sin informar.

La documentación de fase 11 **no se congela** al completar su primera entrega: es el punto de continuidad obligatorio para la fase 12 y todas las siguientes que autorice el propietario.
