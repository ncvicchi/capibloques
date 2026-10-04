# Fase 44 — Laboratorio interactivo y autónomo en Waveshare

Estado al 4 de octubre de 2026: **en curso; núcleo local implementado en
software**. Por decisión del propietario, la compilación y las pruebas físicas
del runtime 1.6.0 quedan **postergadas y registradas como pendientes**, sin
bloquear el inicio de otra fase. También continúan pendientes los escenarios,
el detalle del bloque actual por camino, controles táctiles especializados y el
tramo remoto dependiente del canal de fase 34.

## Entrega de software 1 — runtime 1.6.0

- CapiLink y el intérprete incorporan `STEP`. Puede iniciar desde reposo o
  avanzar desde pausa y concede una sola instrucción pedagógica a un solo
  camino; los demás caminos permanecen detenidos. Las operaciones cooperativas
  largas terminan su unidad antes de devolver el permiso.
- La barra principal y el asistente conservan **Paso** y **Reiniciar** en modo
  Placa. El espejo web recibe las mismas órdenes. Los controles hechos sobre la
  pantalla se publican como telemetría amigable y actualizan el estado web si el
  navegador sigue conectado.
- La Waveshare muestra una franja táctil permanente con Ejecutar/Pausa,
  Paso, Detener y Reiniciar. Las últimas reglas válidas ya podían arrancar sin
  navegador; ahora también pueden gobernarse desde la propia pantalla.
- El botón **Datos/Escena** alterna un inspector local con contador, variables
  por su nombre, temporizadores con tiempo restante, cantidad de caminos activos
  y estado general. Se refresca a 5 Hz y no expone identificadores internos.
- El GT911 integrado se lee cada 16 ms usando el mismo I2C inicializado con la
  secuencia de reset de la placa. En una escena virtual, tocar un botón lo
  mantiene presionado hasta soltar; tocar una barrera o PIR alterna su estado;
  arrastrar sobre luz/potenciómetro entrega 0–4095 y sobre joystick entrega X/Y
  0–4095. Estas lecturas alimentan `sensorValue`, `buttonValue`,
  `barrierValue` y `componentValue` en vez de intentar leer GPIO de la placa.
- La escena indica visualmente esos controles. `HELLO` negocia las capacidades
  `step`, `touch-inputs` y `autonomous-controls`; la web exige firmware 1.6.0 y
  ofrece actualizar una versión anterior.
- Reiniciar detiene caminos, animaciones y salidas, restablece contador,
  variables, temporizadores y entradas virtuales a la configuración guardada,
  sin borrar las reglas A/B.

Pasaron contrato de CapiRules/CapiLink, contrato de fuente, TypeScript y lint.
El equipo local no tiene Docker/ESP-IDF: la compilación de los tres firmwares se
ejecutará en la actualización DEV antes de probar el touch real.

Continúan pendientes dentro de esta fase: detalle del bloque actual por camino,
editor/grabador de escenarios, controles táctiles especializados para el resto
del catálogo y las actividades entre placas. Esto último necesita primero el
transporte autenticado y la instantánea remota de la fase 34; no se implementa
como un segundo ejecutor.

## Objetivo

Hacer que ejecutar en la Waveshare aporte interacción física, depuración y
autonomía reales, en lugar de ser solamente una copia más pequeña del simulador
web. La experiencia conserva dos modos inequívocos: **Simulador web** y
**Placa**.

## Alcance

### Touch como fuente de entradas

- Cada entrada declara fuentes compatibles: sensor físico, control web, control
  táctil Waveshare o escenario de prueba. El programa consume el mismo valor
  tipado sin depender de su origen; la interfaz siempre muestra cuál está activo.
- Controles infantiles por capacidad: botón momentáneo, interruptor, deslizador,
  perilla, joystick X/Y, toque/posición X/Y, distancia, temperatura, humedad,
  luz, barrera libre/interrumpida y selección de mensajes predefinidos.
- Tocar un componente permite inspeccionarlo y, sólo si publica una entrada o
  servicio autorizado, actuar sobre él. No habilita GPIO remoto ni reemplaza
  silenciosamente un sensor físico.
- Se define prioridad explícita entre programa, entrada real y control manual,
  con indicación visible y retorno seguro al control del programa.

### Depuración física educativa

- Incorporar `STEP` a CapiLink y al intérprete. **Paso** avanza una unidad
  pedagógica completa tanto en la placa como en el espejo web, sin desincronizar
  tareas paralelas, temporizadores ni animaciones cooperativas.
- Mantener Ejecutar, Pausar, Reanudar, Detener y reinicio seguro en la barra
  principal y en la pantalla táctil cuando corresponda.
- Mostrar el bloque actual, caminos paralelos, variables, contadores,
  temporizadores y mensajes con vocabulario infantil. Al tocar un componente se
  explica su estado y la última acción que lo cambió, sin `blockId` ni detalles
  internos.
- Distinguir órdenes lógicas de mediciones físicas. Si no hay realimentación, no
  presentar el valor como observado eléctricamente.

### Escena interactiva y funcionamiento autónomo

- Manipular botones, interruptores, joysticks, robots virtuales y demás entradas
  directamente sobre la escena, respetando zoom, tamaño táctil, orientación y
  movimiento reducido.
- Después de cargar firmware y reglas, permitir ejecutar el último proyecto sin
  navegador: iniciar, pausar, detener, reiniciar, cambiar sensores virtuales y
  consultar un registro breve. Un error debe ser comprensible y recuperable.
- La ausencia del navegador o de Wi‑Fi no impide que el último programa válido
  continúe. Los controles que dependan de una pareja remota quedan marcados como
  desconectados, no inventan estados.

### Escenarios de prueba

- Crear listas editables de eventos: presionar un botón, bloquear una barrera,
  variar una medida, recibir un mensaje o perder/recuperar una conexión.
- Ejecutar una vez, repetir o avanzar manualmente; opcionalmente grabar una
  secuencia táctil y reproducirla de manera determinista.
- Conservar escenarios separados de las lecturas reales y del programa. Deben
  poder reiniciarse sin modificar bloques ni escena.

### Pantalla central y actividades entre placas

- Sobre el transporte autenticado de fase 34, la Waveshare muestra telemetría de
  la Placa del proyecto, combina componentes reales y virtuales y publica sólo
  entradas/servicios declarados.
- Permitir actividades acotadas entre placas —por ejemplo, un alumno controla un
  semáforo y otro un robot— con identidad de pareja, mensajes tipados, estado
  antiguo visible y continuidad segura ante desconexión.
- No ejecutar dos copias divergentes del programa: la Placa del proyecto sigue
  siendo la autoridad cuando existe una pareja.

## Arquitectura y dependencias

- Fase 18 aporta renderer local y escena híbrida; fase 20, asistente y modo de
  ejecución; fase 32, valores tipados; fase 34, pareja/telemetría/servicios; fase
  36, intérprete versionado. La fase 45 aporta la escena visual fiel y atractiva.
- Entrada común: `{source, capability, value, timestamp, quality}` con límites
  por tipo. La fuente y calidad no se esconden al alumno/docente.
- Firmware, reglas y web negocian capacidades/versiones. Una placa vieja no
  acepta reglas o controles que no comprende y ofrece actualización.
- Estado autónomo y escenarios usan almacenamiento acotado, escritura atómica y
  última versión válida; no guardan contraseñas Wi‑Fi en el JSON del proyecto.

## Aceptación

- En una Waveshare real, un proyecto usa al menos botón, valor gradual,
  joystick/barrera y mensajes táctiles sin navegador.
- `STEP`, pausa, reanudación y detención mantienen iguales placa y espejo web en
  secuencias, bucles, condiciones, temporizadores y dos caminos paralelos.
- Se inspeccionan variables y componentes con nombres configurados; no aparecen
  identificadores internos.
- Un escenario grabado se reproduce de forma determinista y se distingue de una
  lectura real.
- En pareja Wemos/DevKit + Waveshare, una salida real y una entrada virtual
  conviven; pérdida/reconexión Wi‑Fi conserva ejecución y recupera instantánea.
- Reiniciar sin navegador ejecuta las últimas reglas válidas y nunca un envío
  incompleto. Chrome/Edge y firmware pasan pruebas de contrato y ensayo físico.
