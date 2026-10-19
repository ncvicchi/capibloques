# Fase 61 — GorillaBot: distancia frontal y botón

## Alcance aprobado

El 19/10/2026 el propietario aprobó distancia frontal y botón; sensores de
suelo quedan pendientes. Rama `codex/fase-61-gorillabot-autonomia` desde
`origin/dev1` `0c71577f8acde9195a41a7081573dfef8fbd1ea7`.
Fase60 instalada en dev1 según propietario. No se operan servidores, main ni
dev2. Se entrega commit/push y comando para que el propietario actualice dev1.

Se reutiliza la pista de fase60 y su cinemática v3. No hay nuevo tipo de robot,
física de ruedas, navegación oculta, giro autónomo ni elección de ruta por el
mundo. El programa de bloques decide qué hacer con las entradas.

## Sensores y montaje

- Un **HC-SR04 frontal**, TRIG/ECHO reasignables. Se reutiliza Sensor de distancia,
  no otro componente duplicado. Los ejemplos usan GPIO17/34 y PCA9685 en18/19.
- Un **botón** independiente para iniciar o solicitar fin de misión. Ejemplos:
  GPIO4 con pull-up. El programa espera pulsación y liberación antes de caminar.
- En la pista, el único sensor de distancia se monta virtualmente al frente
  del GorillaBot y gira con él. Su tarjeta no queda flotando separada del robot;
  nombre/pines se editan desde la lista de objetos de Armar escena.
- Si hay varios sensores de distancia, la asociación no se adivina: la marcha
  autónoma requiere uno solo, HC-SR04. No habilitar VL53L0X implícitamente.
- El frontal no ve el suelo, un desnivel ni obstáculos detrás del robot.
  Retroceder exige una zona trasera físicamente despejada. No inferir orientación
  real o distancia recorrida contando ciclos.

### Lectura válida y lectura vencida

Nuevo dato derivado de HC-SR04: **lectura válida y reciente**, disponible en
los bloques genéricos de datos sí/no. No se añade al JSON de configuración.
Sin eco, eco fuera de rango, falta de inicialización o lectura vencida producen
validez falsa; distancia numérica de salida0 no significa camino libre.

Driver real cooperativo para este perfil GorillaBot, compartido Arduino/IDF e
intérprete: captura flancos ECHO por interrupción y reloj en microsegundos.
No espera el eco con pulseIn ni mantiene el programa bloqueado hasta recibirlo.
Disparo10µs, intentos separados60ms, espera máxima de eco30ms, rango2–400cm
(limitado además por maxDistance). Frescura máxima250ms desde el flanco de
recepción, no desde que un consumidor tardío procesa el dato. Enteros en cm.
El pulso breve de disparo no es una espera de todo el eco.

Estado de medición separado del planificador de marcha; registros compartidos
con ISR/tareas mediante atómicos. Sólo un HC-SR04 del perfil GorillaBot en esta
entrega. No se certifican los demás drivers de fase38 por este agregado.

## Marcha interrumpible y reglas

Nuevo bloque **avanzar / retroceder hasta que [condición], máximo N segundos**.
N entre1 y120. Revisa la condición durante la marcha y genera ciclos coordinados
de fase60, con un dueño por robot. No espera a que termine una repetición larga
para poder consultar entradas.

La condición es visible y editable. En los ejemplos, un segundo camino:

1. Consulta si la distancia es válida.
2. Consulta si hay un obstáculo, salvo durante el retroceso.
3. Consulta el botón.
4. Enclava la solicitud de terminar; no la retira por un parpadeo de la lectura.

El intervalo de consulta lo decide el programa (50ms en los ejemplos), además
del tiempo del sensor y del planificador. No se promete reacción instantánea.
Si se quitan esas comprobaciones de los bloques, la escena no las repone a
escondidas. Siempre se conserva el tiempo máximo del bloque.

### Finalización cooperativa

Al cumplirse la condición, vencer el tiempo o recibir una solicitud:

- Se cancela la parte de marcha pendiente, sin nuevos empujes hacia adelante.
- Se validan todas las transiciones antes de emitir pulsos de finalización.
- Se bajan los pies levantados hasta el apoyo previsto de fase60, **conservando
  su coordenada longitudinal actual**. No se arrastran los cuatro pies a x0.
- Duración común mínima500ms, limitada por IK, rama, límites y30°/s. Si no se
  puede validar o falla I2C, no se inventa una postura: se retienen las últimas
  órdenes aceptadas y se informa error.
- Si la condición ya está cumplida antes del primer ciclo, no se inicia marcha
  ni una maniobra de apoyo: no hay pulsos de movimiento nuevos.

Nuevo bloque **solicitar terminar marcha autónoma**: permite pedir el fin desde
otro camino. Sólo afecta al bloque anterior mientras está activo; no cancela
retroactivamente futuras órdenes, el banco, las trayectorias de una pata o el
bloque antiguo de N ciclos. No debe confundirse con Detener.

Nuevo dato derivado del GorillaBot, **resultado de la marcha autónoma**:
`ninguno`, `condición`, `tiempo máximo`, `solicitado` o `error`.
Son resultados del controlador, no mediciones de apoyo o equilibrio.

Pausa congela la marcha y sus tiempos. **Detener** sigue siendo inmediato y
mantiene últimas órdenes, sin obligar a completar un paso. Reiniciar limpia
mundo, solicitudes, errores, visitas y ensayos virtuales, no hace homing físico.
El core no conoce la posición física inicial: preparar no centra motores.
Antes de ejecutar o reiniciar hardware se requiere referencia y montaje
comprobados por una persona adulta, comenzando con el robot sostenido.

## Estados y dos ejemplos completos

### GorillaBot: parar ante un obstáculo

`gorillaAutonomy`: preparar sin mover; esperar pulsación/liberación; monitor
de validez, obstáculo y botón en paralelo con marcha adelante hasta solicitud,
máximo40s. Umbral3cm virtuales. Termina apoyado y muestra resultado en consola.
Estados y banderas están en variables visibles, no en una política escondida.
Sin eco al comenzar finaliza con error sin mover motores.

### GorillaBot: explorar con procedimientos

`gorillaAutonomyProcedures`: cinco procedimientos en tres pestañas
(Principal, Misiones, Sensores):

- Preparar y esperar botón.
- Revisar distancia y botón.
- Explorar el corredor.
- Retroceder y esperar.
- Intentar una última vez.

Misma supervisión inicial, máximo40s. Ante obstáculo, sin fallo ni solicitud
manual, retrocede hasta4s, consultando todavía validez y botón. Espera camino
libre hasta5s; umbral de reanudación4cm, distinto del umbral de parada3cm.
Si se libera, hace **un único reintento**, máximo20s. Si persiste el obstáculo,
vence el tiempo, se pierde lectura o se pide terminar, concluye e informa.
No hay bucle infinito de reintentos, vuelta automática o sensor trasero ficticio.
El timeout de4s del retroceso es su cota programada, no un fallo de comunicación.

Ambos ejemplos están completos, incluidos procedimientos/pestañas/variables;
los ejemplos58–60 se conservan. Compilan a reglas de menos de32KiB sin aumentar
el límite del firmware. Importar/exportar conserva el workspace y sólo la
configuración, nunca ensayos o estados dinámicos derivados.

## Pista y ensayos

Sensor virtual: rayo frontal contra obstáculos circulares y límites de la pista,
desde el borde frontal del chasis. Modelo didáctico de un rayo, no cono acústico
ni materiales/reflectividad reales. Se conserva la escala didáctica de fase60,
40 unidades de escena/cm: no es una predicción de distancia física ni odometría.
Obstáculo inicial(430,355), radio28; configuración editable antes de correr.

Debajo de Escena aparece **Pulsar y soltar botón de misión**, un pulso virtual
de250ms; el botón también se puede mantener desde Estado. Los ensayos de sensor
y obstáculos quedan plegados para no recargar la interfaz:

- Lecturas normales, sin eco/desconectado o lectura vencida.
- Retirar/restituir obstáculos de prueba sin cambiar el proyecto guardado.
- Sensor ligado al mundo, sin deslizador manual que compita con él.

Ensayos se conservan al preparar Simular/Paso sobre el mismo borrador y se
limpian en Reiniciar. Están deshabilitados en modo Placa: no simulan lecturas
físicas en el controlador. El espejo web no se convierte en telemetría medida.
Colisiones y visitas conservan reglas60; el mundo no frena anticipadamente por
un sensor. Un programa incorrecto todavía puede provocar contacto.

## Contratos y verificación

Runtime mínimo **1.15.0**, ABI1. Capacidades nuevas `gorilla-autonomy` y
`sonar-hcsr04`; se conserva todo lo previo y `component-state`.
Op `gorilla`, acciones `walk` (condition, timeoutMs, index0/1, a/b/phase) y
`finish`. El núcleo C++ es idéntico en exportaciones e intérprete, con
planificador de marcha separado de sus políticas sensoriales.
No hay migraciones, dependencias nuevas ni borrado de cachés u objetos SDK.

Evidencia local:

- Ambos workspaces reales ejecutados a1×/4×, en cinco escenarios cada uno:
  obstáculo, botón, sin eco, dato vencido y timeout sin obstáculos.
- Sin lectura al inicio: ningún movimiento de articulación. Contactos0 en
  los ejemplos. Recuperación y reintento acotados; RESET restablece todo.
- Apoyo final TS↔C++, condición/solicitud/timeout/error, rollover, eco inválido,
  dato vencido y consumidor tardío. Core y adaptador real Arduino/IDF compilados
  con HAL bajo -Wall/-Wextra/-Werror. Esto **no es** SDK completo ni placa real.
- Tipos/lint/smoke completo, empaquetado web10páginas, siete tests backendGorilla
  y packaging. Dos recorridos Chromium de botón, lectura automática, pausa,
  desconexión virtual, cierre y reinicio.

Pendientes: SDK completo, prueba física de HC-SR04/botón/GorillaBot, marcha y
apoyo; aceptación del comportamiento y guiado/STEP físicos con procesos
paralelos; renderer Waveshare64. No certificar equilibrio, posición o seguridad.

### Backlog retenido dentro de fase61

- Sensores de suelo/borde: tipo, montaje, calibración y reglas por acordar.
  Un frontal no detecta caída.
- IMU/brújula: identificar módulo y driver/calibración antes de implementar;
  QMC5883L y HMC5883L no se asumen intercambiables.
- Perfiles alternativos de distancia y sensores traseros, según hardware real.

Web/celular62, mando63 y Waveshare64 permanecen pendientes y no se inician aquí.

## Actualización

Sólo el propietario actualiza dev1, con el SHA completo de la entrega:

```bash
~/.local/bin/capi-dev --env dev1 --branch codex/fase-61-gorillabot-autonomia --commit SHA40
```

Este cambio modifica el intérprete: se reconstruye incrementalmente una vez y
se necesita instalar1.15.0 en la placa para las nuevas capacidades. No compilar
un firmware por proyecto ni activar GitHub Actions como requisito de DEV.
