# CapiBloques — contexto para continuar

Documento vivo de **fase 11**. Actualización: **20 de septiembre de 2026**. Leerlo desde el checkout vigente; no hace falta el historial del chat. Al terminar **cada fase solicitada**, actualizar aquí estado, pruebas, despliegue, pendientes y próxima autorización, junto con el plan y su guía de entrega.

## 1. Punto de entrada y autorización actual

- Repositorio: [ncvicchi/capibloques](https://github.com/ncvicchi/capibloques). Rama de trabajo actual: `main`. Nuevas ramas, si hacen falta: prefijo `codex/`. Respetar el árbol existente, sin reset/force ni descartar cambios ajenos.
- El propietario autoriza una entrega a la vez y pidió diseñar primero los componentes. Fases 11–16 fueron autorizadas y ejecutadas; además autorizó específicamente implementar el componente Matriz LED de fase 23 y la fase 29 de variables. Esa autorización no abre el resto de la fase 23 ni las demás fases.
- **Fases 11–14, 28 y 29 entregadas en software; fases 15 y 16 terminadas en software; fase 23 en curso.** Mensajes, DIYmall S3 y barrera infrarroja conservan aceptación física pendiente. La Matriz LED 32 × 8 tiene editor, bloques, simulación y Arduino/ESP-IDF desplegados; faltan su ensayo eléctrico y la aceptación física de los displays existentes.
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
- Placas implementadas en software: Wemos D1 R32 y la unidad exacta DIYmall ESP32-S3-DevKitC V1.0 N16R8. Waveshare 5 pulgadas sigue pendiente de modelo/revisión exactos. No extrapolar pines, memoria ni offsets entre perfiles.

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

La fase 15 fue implementada en software y su [guía](FASE_15_MENSAJES.md) registra el contrato. La matriz de fase 23 también está implementada en software; ambas conservan aceptación física pendiente. No iniciar 16–22, 24–26, completar el resto de 23 ni avanzar a la Fase final por inferencia.

Validación documental de cierre: **130 destinos locales en ocho documentos**, sin archivos faltantes ni diferencias de mayúsculas/minúsculas; las anclas operativas del túnel y compilador también se contrastaron. Los únicos recursos gráficos publicados son las dos capturas de fixtures sintéticos enlazadas desde la guía.

Al terminar esta entrega se cerró la sesión SSH administrativa y finalizaron las pruebas locales. Se conserva el túnel habitual para navegar DEV; apagar la PC sólo corta ese acceso local, no detiene los servicios de la VM. Los archivos de diagnóstico quedan ignorados en `work/`/`test-results/`; no son parte necesaria del traspaso ni deben publicarse indiscriminadamente.

### Corrección documental — 12 de septiembre de 2026

Autorización del propietario: **«Corregi la documentacion, luego dame una lista de las fases pendiente»**. Se corrigen el estado de fase 13, la disponibilidad de USB y las recetas de operación anteriores al runtime público. La [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente) se contrasta con el código del runtime; las guías antiguas conservan su evidencia histórica y remiten a ella.

Esta entrega sólo cambia documentación. El punto de partida local es `a74b427`, rama `main`, árbol limpio; el commit de corrección queda identificado en Git. La validación documental abarca diff y coherencia, más **189 enlaces locales y 37 anclas en 28 documentos**, con comprobación de nombres exactos y repetición desde un checkout limpio antes de publicar. No se repiten pruebas de aplicación ni consultas a las VMs: el último registro remoto sigue siendo `2597284`, runtime funcional `1ee0df9`, observado al cierre de fase 13. No corresponde desplegar por estos cambios.

En ese corte documental del 12 de septiembre seguían pendientes la aceptación física de fase 10 y las fases 14–18; la entrega posterior de fase 14 se registra debajo. El script de pruebas backend conserva una limitación operativa: `--restart` no carga la configuración pública; su uso directo queda excluido de la receta DEV vigente, sin afirmar que el script se haya corregido.

### Entrega de fase 14 — 13 de septiembre de 2026

| Evidencia | Resultado |
| --- | --- |
| Código y recursos | Funcional `897c6e0`; documentación y conceptos de avatar incorporados hasta `c681af2`. El detalle funcional está en la [guía de fase 14](FASE_14_EJECUCION_VISUAL.md). |
| Comportamiento | «Al mismo tiempo» presenta caminos verticales; la ejecución conserva la cámara de Blockly y muestra progreso independiente en el bloque y el dispositivo. El estado visual no entra al JSON, autoguardado, historial ni firmware. |
| Pruebas locales | Typecheck, lint, smoke y build correctos. Playwright afectado 4/4 en Chrome/Edge; la corrida Chromium completa detectó una lectura anticipada de pausa, se estabilizó la espera y el caso pasó. |
| CI | [34735466824](https://github.com/ncvicchi/capibloques/actions/runs/34735466824), commit `c681af2`: cuatro jobs correctos, incluidos backend, firmware y ESP-IDF. |
| DEV desplegado | `capi-dev` actualizado por avance rápido a `c681af2c527b90eeb602f37f3a289235dc6e3317`; editor `capibloques-editor-dev:c681af2c527b`, API y DB saludables. API/base no fueron recreados. |
| Verificación posterior | Salud local y pública `ok`; Compose/firewall válidos; 4/4 Playwright externo Chrome/Edge. Admisión restaurada con cero trabajos activos y planificador `active`. |
| Límites operativos | No se modificaron PRD, gateway, Proxmox, router ni Nginx. La Fase 14 no demuestra funcionamiento físico ni agrega seguimiento del firmware. |

Los recursos 2D de avatar se conservaron en versiones [detalladas](../public/avatars/full-body/README.md) y [simples](../public/avatars/full-body-simple/README.md). Son conceptos de cuerpo completo para una futura adaptación a impresión 3D; no son STL ni quedaron integrados como animaciones. Las reacciones de avatar siguen como pedido separado del backlog.

### Corrección de la barra del catálogo — 13 de septiembre de 2026

El propietario autorizó «corrijamo la barra residual del catalogo». La revisión funcional `d096fd9` oculta la barra propia de Blockly junto con el catálogo y conserva las barras del programa. La regresión cubre botón, Escape, arrastre, categorías cortas y largas, escritorio de altura limitada y móvil; pasó en Chrome y Edge localmente y 2/2 contra DEV público. Typecheck, lint, smoke y build fueron correctos. El CI completo [34737668650](https://github.com/ncvicchi/capibloques/actions/runs/34737668650) pasó sus cuatro trabajos, incluidos backend, firmware, ESP-IDF y runtime público.

`capi-dev` avanzó de `c681af2` a `d096fd9f5410bd35ee880cbc94870ee7d9c12aa2` mediante `capibloques-dev-runtime deploy`; el editor `capibloques-editor-dev:d096fd9f5410`, API y PostgreSQL quedaron saludables sin recrear API/base. Las comprobaciones local y pública respondieron `ok`, Compose/firewall fueron válidos y la admisión se restauró con `paused=False`, cero trabajos activos y planificador `active`. No se modificaron PRD, gateway, Proxmox, router ni Nginx. Esta entrega es mantenimiento posterior a la Fase 14: no altera la numeración ni autoriza la Fase 15.

### Corrección del arrastre individual y grupal — 13 de septiembre de 2026

El propietario decidió invertir el gesto de Blockly: arrastrar sin modificadores mueve sólo el bloque señalado y recompone la cadena; `Control` + arrastre mueve también los bloques siguientes, con `Comando` como equivalente en macOS. La revisión funcional `d818093` implementó el comportamiento, la ayuda accesible y Deshacer; `0fc9ff2` difirió la instalación de la estrategia durante el arrastre para conservar la creación desde el catálogo.

La regresión construye tres bloques, comprueba ambas estructuras y restaura cada una con Deshacer. Pasó localmente en Chromium y en Chrome/Edge junto con el caso de arrastre desde el catálogo; también pasaron typecheck, lint, smoke, build y el archivo completo de experiencia de programación. El CI completo [34740573404](https://github.com/ncvicchi/capibloques/actions/runs/34740573404) pasó interfaz, runtime público, backend, firmware Arduino y los siete proyectos ESP-IDF.

`capi-dev` avanzó de `d096fd9` a `0fc9ff2d2eee681a14cc22e276db371e34712e03` mediante `capibloques-dev-runtime deploy`. El editor `capibloques-editor-dev:0fc9ff2d2eee`, API y PostgreSQL quedaron saludables sin recrear API/base; salud local y pública, Compose y firewall fueron válidos. La admisión volvió a `paused=False` con cero trabajos activos y el planificador quedó `active`. Los dos recorridos afectados pasaron **4/4** sobre DEV público en Chrome/Edge. No se modificaron PRD, gateway, Proxmox, router ni Nginx; la Fase 15 sigue sin autorización.

### Corrección del guardado durante el arrastre — 15 de septiembre de 2026

El error «Una conexión del bloque … apunta a un bloque vacío» se reprodujo manteniendo un bloque sobre un punto de inserción más allá de los temporizadores de cambio y autoguardado. Blockly serializaba su marcador transitorio como `block: null`; el estado inválido alcanzaba el guardado local y podía desmontar React. La revisión `2b97af9` conserva la última instantánea estable durante el gesto y publica el resultado al soltar, sin aceptar conexiones vacías en archivos importados.

Pasaron typecheck, lint, smoke, build, 6/6 del archivo de experiencia en Chromium y la regresión específica en Chromium/Chrome/Edge. El CI completo [34974885825](https://github.com/ncvicchi/capibloques/actions/runs/34974885825) pasó backend, interfaz/runtime, Arduino y ESP-IDF. `capi-dev` avanzó de `0fc9ff2` a `2b97af95051e47566167bcbfb2117757d37a192b`; editor, API y PostgreSQL quedaron saludables, Compose/firewall válidos y salud local/pública `ok`. La admisión se restauró con `paused=False`, cero trabajos activos y planificador `active`; el caso pasó 2/2 sobre DEV público en Chrome/Edge. API/base no fueron recreados y no se modificaron PRD, gateway, Proxmox, router ni Nginx.

### Fase 15 — Mensajes — 19 de septiembre de 2026

Los commits funcionales `036fe61` y `b2ebd05` incorporan el componente **Mensajes**, sus modos Enviar/Recibir/Ambos, lista predefinida, velocidad y pines configurados en escena, bloques de envío y recepción condicional cooperativa, simulación por botones y trama protegida común a Arduino/ESP-IDF. Los ejemplos Robot y Semáforo por mensajes están incluidos. El contrato y los límites se conservan en [FASE_15_MENSAJES.md](FASE_15_MENSAJES.md).

El CI completo [35444477812](https://github.com/ncvicchi/capibloques/actions/runs/35444477812) pasó interfaz/runtime, 200 pruebas de backend, Wemos Arduino 3.3.11 con los cinco perfiles de pantalla y siete proyectos ESP-IDF 5.5. DEV avanzó a `b2ebd05bf91f9a8e94267155c21da5f532b9f99c`; editor, API y PostgreSQL quedaron saludables, Compose/firewall válidos y salud pública `ok`. La admisión se restauró con `paused=False`, concurrencia 1 y cola vacía; la prueba específica pasó **4/4** en Chrome/Edge contra DEV público. No se modificaron PRD, gateway, Proxmox, router ni Nginx. La prueba eléctrica con Wemos sigue pendiente y no se confunde con compilación.

### Consolidación de Pantalla de texto — 19 de septiembre de 2026

Al retomar el componente LCD se comprobó que los perfiles PCF8574 16 × 2 y 20 × 4 ya estaban implementados junto con OLED/TFT. El commit `2c1f564` corrige el nombre visible de **Pantalla de mensajes** a **Pantalla de texto**, sin cambiar el tipo JSON `display` ni duplicar el componente. Typecheck, lint, smoke, driver C++, build, **12/12 pruebas de pantalla** y **4/4 de matriz** pasaron localmente en Chrome/Edge. El [CI completo 35451594869](https://github.com/ncvicchi/capibloques/actions/runs/35451594869) finalizó correctamente.

DEV avanzó por fast-forward desde `fa9ec15` hasta `2c1f56455ea33d87df3ebe4324cf4b1a4d214a7c`; la imagen declara la misma revisión. Runtime, Compose, firewall y salud local/pública quedaron correctos, y la suite afectada pasó nuevamente **12/12** contra `https://capibloques.dev.nvicchi.com/` en Chrome y Edge. El planificador quedó `active`, admisión `paused=False`, concurrencia/techo 1 y cola vacía, revisión administrativa 20. API y base no fueron recreadas; no se modificaron PRD, gateway, Proxmox, router ni Nginx. La aceptación física de LCD/OLED/TFT continúa pendiente.

### Dibujos y animaciones de Pantalla de texto — 19 de septiembre de 2026

El commit funcional `5158e1f` amplió el mismo componente `display`, sin crear otro dispositivo: LCD anima texto; OLED/TFT también muestran figuras predeterminadas o hasta 12 dibujos propios de 16 × 8. La escena conserva la velocidad y los dibujos; los bloques eligen efecto y contenido. Simulador, Arduino y ESP-IDF usan avance cooperativo y el backend acepta tanto JSON histórico como el contrato ampliado. Figuras incluidas: corazón, estrella, sonrisa, capibara, robot, gato y flor.

La semántica posterior es no bloqueante también dentro del mismo camino: texto, dibujos y Matriz LED arrancan en segundo plano y continúan con el bloque siguiente. Cada animación permite una vez, 2–100 repeticiones o `sin parar`. `Esperar a que termine [pantalla]` sincroniza explícitamente; escribir, borrar, mostrar otra figura o iniciar otra animación cancela la vigente. Una espera combinada con `sin parar` produce una advertencia, porque necesita que otro camino la reemplace. El contrato histórico sin campos de repetición se interpreta como una sola vez.

El [CI completo 35471186348](https://github.com/ncvicchi/capibloques/actions/runs/35471186348) pasó sus cuatro trabajos: 204 pruebas backend, 182 de interfaz Chromium, los cinco perfiles Arduino y ocho proyectos ESP-IDF. DEV avanzó a `5158e1f84f6bd7a16c2036e049e3034103bbbf8f`; imagen y checkout coinciden, 204 pruebas backend y el recorrido nuevo **2/2** en Chrome/Edge pasaron, salud interna/pública quedó `ok`, planificador activo, admisión `paused=False`, concurrencia/techo 1 y cola vacía (revisión 22). No se modificaron PRD, gateway, Proxmox, router ni Nginx. No declarar prueba física.

### Fase 23 en curso — Matriz LED — 19 de septiembre de 2026

El commit funcional `fa9ec15` incorpora una unidad **Matriz LED** 32 × 8 de cuatro MAX7219: configuración de brillo/orden/giro, editor de hasta 12 dibujos, cuatro bloques, simulación cooperativa, ejemplo Cartel luminoso, cableado y generación común para Arduino/ESP-IDF. El alcance y lo que sigue abierto están en [FASE_23_MATRIZ_LED.md](FASE_23_MATRIZ_LED.md); no se declara terminada toda la fase 23.

El CI completo [35449365576](https://github.com/ncvicchi/capibloques/actions/runs/35449365576) pasó sus cuatro trabajos, incluida la compilación nativa de ocho proyectos Arduino y ocho ESP-IDF. En DEV pasaron 202 pruebas Django y el recorrido específico **4/4** en Chrome/Edge. `capi-dev` avanzó a `fa9ec1534571e7afc194ecda5e28dc827cb237b8`; editor `capibloques-editor-dev:fa9ec1534571`, API y PostgreSQL quedaron saludables, Compose/firewall válidos y salud interna/pública `ok`. La admisión quedó `paused=False`, concurrencia/techo 1, cola vacía y planificador activo. No se modificaron PRD, gateway, Proxmox, router ni Nginx. Falta probar la matriz física y los displays LCD/OLED/TFT.

La exclusividad Matriz LED/Pantalla de texto es deliberada. Tras una observación de UX, el catálogo pasó a explicar en un aviso visible qué salida visual existente bloquea las tarjetas grises, cómo reemplazarla y a mostrar el motivo dentro de cada tarjeta; no se amplió la cantidad permitida.

La escena también expone un tachito en la cabecera para el objeto seleccionado. `Supr/Delete` o `Backspace`, fuera de campos de texto, abren la misma confirmación. Quitar sigue siendo reversible desde deshacer y deja los bloques huérfanos visibles para elegir otro destino; no los elimina a escondidas.

Esta mejora quedó en `7afdf2a` y su ajuste E2E en `94f2112`. La CI completa 35473606856 pasó los cuatro trabajos. DEV fue desplegado en `94f21129f577ddc64fd55f0ff1fac3920a895f7d`, con salud interna/pública correcta y E2E específico **8/8** en Chrome/Edge públicos. El compilador quedó activo, admisión abierta en revisión 24 y cola vacía.

El 20 de septiembre de 2026 se confirmó el hardware disponible para continuar la aceptación: LCD Keypad Shield 16 × 2 paralelo con cinco botones por ADC, LCD 20 × 4 con mochila I2C, TFT ILI9341 SPI y matriz 32 × 8 con cuatro MAX7219. El Keypad Shield necesita un perfil combinado nuevo —pantalla más cinco botones lógicos— y no corresponde al `lcd1602` I2C vigente. El propietario confirmó que la pantalla 16 × 2 y sus botones funcionan correctamente; queda integrarlos y probar el firmware de CapiBloques. El orden acordado está en [FASE_23_MATRIZ_LED.md](FASE_23_MATRIZ_LED.md).

### Animaciones no bloqueantes y despliegue reanudable — 19 de septiembre de 2026

La implementación funcional de animaciones cooperativas quedó en `6999242` y el ajuste de prueba en `08b67e3`. Texto, dibujos y desplazamiento de Matriz LED continúan en segundo plano; cada bloque permite una vez, N veces o sin parar, y el bloque `esperar a que termine` es la sincronización explícita. La CI completa [35476496407](https://github.com/ncvicchi/capibloques/actions/runs/35476496407) pasó backend, interfaz/runtime, ocho Arduino y ocho ESP-IDF. La aceptación física continúa pendiente.

Una corrección posterior de robustez limita el texto desplazable desde el propio campo: el bloque muestra `N/32`, señala cuándo llegó al máximo y no conserva caracteres adicionales. El compilador vuelve a acotarlo como defensa. Esto evita que un proyecto con más de 32 caracteres sea rechazado por el simulador después de que la interfaz anunciara engañosamente que había comenzado. La regresión importa deliberadamente un proyecto excedido y comprueba recorte, indicador y ejecución.

Un corte eléctrico ocurrió antes de autenticar la ventana de despliegue: no se había pausado, actualizado ni detenido DEV, cuyo último estado observado seguía en `94f2112`, saludable, admisión abierta en revisión 24 y planificador activo. No afirmar un despliegue posterior sin volver a auditarlo al encender.

Para evitar operación manual repetitiva se agregaron `scripts/update-dev.sh`, `scripts/deploy-dev.ps1` y el orquestador remoto reanudable. El modo normal `--fast` espera sólo las verificaciones que corresponden a los archivos modificados; `--full` dispara mediante una etiqueta Git temporal y espera backend, web/E2E, Arduino y ESP-IDF completos para el mismo commit. La etiqueta se elimina al terminar. Ambos informan cada estado, avance aproximado, cantidad restante y tiempo transcurrido, y esperan sin timeout por defecto. Los errores transitorios de consulta se reintentan. Luego el despliegue pausa de forma auditada, elige API automáticamente cuando corresponde, prueba, valida y restaura el estado previo. Toda salida termina con un banner inequívoco de despliegue completado o fallido; la validación oculta el detalle normal del firewall y la reconstrucción usa salida resumida. Si el checkout aún contiene un actualizador antiguo, se inicia una vez con `git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast`; después vuelve a servir `./scripts/update-dev.sh --fast`. La actualización acumulada desde `f772026` reconoce específicamente la migración aditiva `compiler.0002` y la nueva receta Wemos/S3: respalda PostgreSQL, reconstruye el compilador, migra y registra su imagen; cualquier otra migración o infraestructura continúa bloqueada y se enumera. Un marcador privado permite repetir la misma orden después de un corte. La guía y límites están en [FASE_13_ACCESO_EXTERNO_DEV.md](FASE_13_ACCESO_EXTERNO_DEV.md).

El 21 de septiembre se comprobó que el checkout podía quedar avanzado mientras
el contenedor web continuaba en una imagen anterior. El cierre del orquestador
ahora exige que la imagen activa y su etiqueta OCI coincidan con el commit
objetivo; sin esa evidencia informa fallo y conserva el mantenimiento
reanudable. Esta corrección no convierte el intento incompleto observado en un
despliegue exitoso: DEV debe completar nuevamente el comando normal.

El propietario ejecutó la primera actualización mediante `deploy-dev.ps1 -DirectLan` y no informó errores; según el acuerdo operativo vigente, se registra DEV actualizado a `f772026f711782d0c3cd04401d3974ddcba0ea64`. Su [CI completa 35477573114](https://github.com/ncvicchi/capibloques/actions/runs/35477573114) terminó correcta. Esta confirmación procede del operador, no de una nueva inspección remota del asistente. Desde ahora el asistente implementa, prueba, commitea y pushea, pero entrega la orden de despliegue para que la ejecute el propietario; si éste no informa un problema, se considera exitosa. La orden normal dentro de DEV es `cd /home/capi/capibloques && ./scripts/update-dev.sh`.

### Fase 16 — DIYmall ESP32-S3 N16R8 — 19 de septiembre de 2026

La placa conectada se inspeccionó sin escribir: ESP32-S3 revisión 0.2, flash Quad 16 MiB, PSRAM Octal 8 MiB, cristal 40 MHz y puente USB-UART CP210x. El recorrido de software se documenta en [FASE_16_ESP32_S3_DEVKIT.md](FASE_16_ESP32_S3_DEVKIT.md): target JSON cerrado, selector transaccional de placa, pines/capacidades, ilustración propia, Arduino/ESP-IDF, cola/caché/manifiesto y USB ligados al perfil exacto. GPIO35–37 quedan fuera por la PSRAM Octal. Wemos mantiene su JSON y comportamiento histórico.

Las pruebas locales de tipos, lint, smoke/modelo S3, ZIP IDF, USB e aislamiento de compilador pasan; CI compila además un semáforo S3 real con ambas toolchains. Registrar aquí hash y ejecución CI después del push. No se grabó la placa: faltan autorización y ensayo físico de arranque, consola, PWM y TX/RX; no declarar certificación de hardware.

### Inventario para fase 17 — Waveshare de 5 pulgadas — 19 de septiembre de 2026

El propietario identificó la segunda unidad con la [página oficial](https://docs.waveshare.com/ESP32-S3-Touch-LCD-5): **Waveshare ESP32-S3-Touch-LCD-5, SKU 28117**. Es un ESP32-S3-WROOM-1-N16R8 con panel RGB de 5 pulgadas, táctil capacitivo GT911 por I2C y expansor CH422G. La consulta física de `COM12` mediante USB nativo, sin escritura, confirmó ESP32-S3 rev. 0.2, flash Quad 16 MiB, PSRAM 8 MiB, 3,3 V y cristal de 40 MHz. No registrar identificadores únicos del chip.

La fase 17 no está implementada. Antes de fijar su perfil hay que confirmar en la unidad resolución 800 × 480 o 1024 × 600 y revisión de PCB, y contrastar esquema/serigrafía. La pantalla ocupa la mayoría de GPIO; USB usa 19/20, I2C/GT911/RTC/CH422G usa 8/9, TF usa 11–13 más EXIO4, RS485 43/44 y CAN 15/16. No reutilizar el mapa de la DevKit ni tratar el panel RGB como ILI/SPI.

## 4. Arquitectura y mapa de archivos

| Área | Punto de entrada y responsabilidad |
| --- | --- |
| Rutas y UI | [app](../app), [capiblocks-app](../components/capiblocks-app.tsx), estilos [globals.css](../app/globals.css). React, Vinext/Vite y componentes Base UI existentes; conservar lockfile. |
| Identidad del editor | [editor-access](../components/editor-access.tsx), [account-session](../lib/account-session.ts), [session-polling](../lib/session-polling.ts), [accounts](../backend/accounts). Sesión/CSRF y borrador ligado a UUID, no al alias; reloj periódico sin consultas por foco. |
| Escena | [scene-model](../lib/scene-model.ts), [scene-builder](../components/scene-builder.tsx), [scene-stage](../components/scene-stage.tsx). Modelo lógico, edición pendiente separada y vista/simulación. Cámara transitoria en [scene-viewport](../components/scene-viewport.tsx) y [scene-camera](../lib/scene-camera.ts). |
| Bloques y generación | [blockly-workspace](../components/blockly-workspace.tsx), [blockly-engine](../lib/blockly-engine.ts), [capiblocks](../lib/capiblocks.ts). Workspace → programa/grafo → simulador y generadores. |
| Simulación | [simulator.worker](../lib/simulator.worker.ts), [execution-panel](../components/execution-panel.tsx). Worker cooperativo, tiempos lógicos/trazas separados de presentación. |
| Pantallas, matriz y cableado | [display-model](../lib/display-model.ts), [led-matrix](../lib/led-matrix.ts), [firmware matriz](../lib/led-matrix-firmware.ts), [wiring-guide](../components/wiring-guide.tsx). Validación compartida, simulación y revisión eléctrica explícita. |
| Imagen Wemos | [wemos-board UI](../components/wemos-board.tsx), [mapa físico](../lib/wemos-board.ts), [referencias contrastadas](REFERENCIA_WEMOS.md). Listado/dibujo comparten conexiones; ilustración propia, no certificación eléctrica. |
| Perfiles de placa y S3 | [board-profiles](../lib/board-profiles.ts), [s3-board UI](../components/s3-board.tsx), [mapa físico S3](../lib/s3-board.ts), [guía de fase 16](FASE_16_ESP32_S3_DEVKIT.md). Identidad, memoria, pines, target y manifiestos comparten perfil; no generalizar N16R8. |
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
- 14: **entregada y verificada en DEV/CI**; [paralelo vertical, lienzo estático e indicadores locales](FASE_14_EJECUCION_VISUAL.md).
- 15: **software entregado y verificado en DEV/CI**, componente Mensajes con modos Enviar/Recibir/Ambos, trama protegida, simulación por botones y ambos generadores; falta aceptación física Wemos.
- 16: **entregada en software** para DIYmall ESP32-S3-DevKitC V1.0 N16R8; [perfil, evidencia e integración](FASE_16_ESP32_S3_DEVKIT.md). Chip/flash/PSRAM se identificaron físicamente sin escribir. Falta grabación y ejecución física de consola/PWM/TX-RX, más comparación física Wemos.
- 17: Waveshare S3 5 pulgadas exacta, pantalla/entrada y guía visual de conectores.
- 18: escena y controles locales en display, prioridad manual/programa explícita.
- 19: desafíos progresivos, con primeros retos utilizables sin hardware obligatorio.
- 20: compilación/grabación guiadas, estados reales, medición, Guardar integrado y reinicio posgrabación validado.
- 21: claridad y ergonomía educativa: superposición de bloques, borrador de escena, operadores/menús/emojis, textos, advertencias y nueva auditoría de interfaz.
- 22: avatar acompañante con reacciones accesibles ante desafíos, compilación y grabación.
- 23: **en curso**; matriz 32 × 8 con cuatro MAX7219 implementada en software. El componente existente de LCD/OLED/TFT se presenta como **Pantalla de texto**; se está incorporando el hardware confirmado LCD Keypad Shield 16 × 2 como perfil combinado de pantalla paralela y cinco botones lógicos. El propietario confirmó que esa pantalla y sus botones funcionan; falta validar el firmware generado por CapiBloques y los otros módulos físicos.
- 24: panel web local para un celular emparejado, misma LAN, vistas Escena/Controles e inputs relacionados mediante bloques.
- 25: compartir proyectos por enlace/QR con copia/vista, caducidad y revocación.
- 26: acceso de aula sin contraseña y asistencia con identidad, sesión y revocación explícitas; el logo y nombre del colegio deben ser el centro visual del ingreso normal y supervisado.
- 27: **software genérico entregado; aceptación física pendiente**. Cinco configuraciones cubren bípedo de cuatro servos, sonido, ultrasonido, matriz expresiva y humanoide de seis servos; incluyen 17 movimientos, brazos, expresiones y distancia como dato en simulación, JSON, Arduino y ESP-IDF. Ninja y Wheels siguen pendientes como variantes específicas. Ver [FASE_27_OTTO.md](FASE_27_OTTO.md).
- 28: **implementada en software**; barrera infrarroja digital como sensor «libre / interrumpida», con polaridad configurable en escena, dato sí/no reutilizable, simulación, JSON, validación y generación Arduino/ESP-IDF. Contrato en [FASE_28_BARRERA_INFRARROJA.md](FASE_28_BARRERA_INFRARROJA.md); falta aceptación física del detector exacto.
- 29: **implementada en software**; datos y variables tipados —número, texto y sí/no—, cuentas/comparación, valores de contador, sensores, botones, Wi-Fi y último mensaje recibido, composición reutilizable en consola, pantallas y Mensajes. Contrato en [FASE_29_VARIABLES.md](FASE_29_VARIABLES.md).
- El [informe externo del 14 de septiembre](BACKLOG.md#pedidos-externos-a-analizar) queda distribuido entre 20–22 y 25–26. El selector angular con reloj está expresamente descartado y no es trabajo pendiente. La barra residual, el arrastre individual/grupal y el guardado estable ya están corregidos en `d096fd9`, `0fc9ff2` y `2b97af9`.
- Final: producción/HTTPS, restauración/backups externos, carga, monitoreo, rollback y piloto; postergada.

La próxima fase numerada pendiente es **17**, aún no autorizada y dependiente del modelo/revisión exactos de la Waveshare. Las aceptaciones físicas de fases 10, 15, 16 y 23 siguen separadas. La fase 16 sólo corresponde a la DIYmall N16R8 inspeccionada: no extrapolar a otra DevKit S3. Exigir modelo/documentación y ensayo físico antes de anunciar soporte de una placa nueva. Los diagramas fueron contrastados con las fuentes enlazadas; una ilustración nunca es fuente única de verdad.

## 9. Mensaje listo para otra conversación

> Continuá CapiBloques desde este repositorio. Primero leé AGENTS.md y docs/CONTEXTO_PARA_CONTINUAR.md, luego el plan y la guía de la entrega vigente. Confirmá rama, cambios locales y versión desplegada antes de operar. Las fases 11–14 están entregadas, 15 y 16 están terminadas en software y la 23 está en curso con la Matriz LED implementada; DEV funciona públicamente en https://capibloques.dev.nvicchi.com/. No infieras autorización por estar en el backlog. Trabajá una entrega completa por vez, informá avances, probá, hacé commit/push y actualizá este contexto al terminar. Producción es la Fase final y está postergada. El gateway es exclusivamente un salto SSH y está prohibido modificarlo; tampoco modifiques Proxmox, router, PRD u otros sitios. No copies secretos, no documentes contraseñas ni borres datos para recuperar acceso. Las aceptaciones físicas siguen pendientes salvo evidencia posterior explícita. Decime qué contexto o acceso privado falta sin pedir credenciales en Git o documentación.

## 10. Lista de cierre y mantenimiento obligatorio

1. Registrar autorización exacta y alcance entregado; distinguir pendiente, bloqueado y postergado, sin porcentajes ficticios.
2. Actualizar este corte con commits funcionales, pruebas y resultados reales, límites/mocks, fecha de verificación remota y versión desplegada. No adjudicar a un commit una prueba corrida sobre otro.
3. Enlazar la guía de entrega nueva y actualizar plan, backlog, README/AGENTS cuando cambie su estado. Mantener enlaces históricos sin llamar completas funciones no verificadas.
4. Revisar que no haya credenciales, datos infantiles, artefactos privados o rutas de claves en el diff. Verificar enlaces desde un checkout limpio y comandos de consulta, sin ejecutar operaciones destructivas como prueba.
5. Hacer commit/push de cambios verificados, confirmar árbol limpio y remoto. No desplegar si sólo cambió documentación; cambios de aplicación se verifican en DEV según su alcance.
6. Dejar próximos pasos concretos, procesos/túneles normales retenidos y trabajos temporales terminados o explícitamente pendientes. No dejar una prueba que requiere atención corriendo sin informar.

La documentación de fase 11 **no se congela** al completar su primera entrega: es el punto de continuidad obligatorio para la fase 12 y todas las siguientes que autorice el propietario.
