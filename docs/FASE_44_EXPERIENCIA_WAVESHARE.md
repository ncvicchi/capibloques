# Fase 44 — Laboratorio interactivo y autónomo en Waveshare

Estado: **pendiente; planificada el 26 de septiembre de 2026**. Esta fase no
está autorizada por quedar documentada.

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

