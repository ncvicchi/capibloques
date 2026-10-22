# Fase58 — GorillaBot, calibración y banco de una pata

Autorizada19/10/2026, rama `codex/fase-58-gorillabot-banco` desde origin/dev1
`481854cf239f3cc41fc247be8ffc1804646743f1`. [Plan evolutivo58–64](PLAN_GORILLABOT_EVOLUTIVO.md).
Sin operación remota/main/dev2. Fase57 ya actualizada en dev1 según propietario;
no se presume que haya promovido a main por haber pedido su comando.

## Alcance

Componente `gorilla`, perfil único `GORILLA_PCA9685`: cuatro patas, dos servos
A/B por pata. Wemos D1 R32 o DevKit S3 existente + PCA9685. Una instancia por
proyecto. No se agregan otros modelos de placa, TinyPlan ni controladora original.

Banco nuevo `gorillaBench`, independiente de Otto/pistas existentes. Cuerpo con
cuatro patas identificadas, motor A naranja/B azul y ampliación de la pata elegida.
Mecanismo de cinco barras ilustrativo, no medidas reales ni cadera/rodilla en serie.
Selección de pata y vista previa son UI local, no cambian programa ni hardware.

Tres bloques de Movimiento:

- Preparar GorillaBot: inicia PCA9685, sin mandar los ocho motores al centro.
- Mover motor: seleccionar uno de los ocho, posición relativa −20°..+20°, tiempo.
- Mover pata: seleccionar una de cuatro, posiciones A/B relativas y mismo tiempo.

0° significa centro calibrado, no ángulo absoluto del servo ni giro continuo.
Movimientos esperan sólo su camino, otros procesos siguen; órdenes concurrentes
al mismo robot esperan que quede libre, no reemplazan un movimiento a mitad.
No se garantiza orden FIFO estricto entre solicitantes simultáneos; un único
responsable por robot es el patrón recomendado hasta planificación corporal59–60.
Duración200–10000ms, ampliada si hace falta para no exceder30°/s. Interpolación
lineal compartida con núcleo C++ propio. Preparación obligatoria; orden inválida
no mueve, activa error. No caminar, sentarse, IK cartesiana ni teleoperación todavía.

«Una pata» en58 es su par A/B, no coordenadas del pie: para «subir/adelantar»
con geometría real falta medir y validar el mecanismo; queda explícitamente en59.

## Calibración y conexiones

Inspector dedicado: elegir pata, canal/centro/límites/inversión para cada motor,
dirección I²C y vista previa local. Guardar/Cancelar cambios de objeto y escena
con undo/redo existentes. No hay comandos USB vivos al tocar el inspector.

Canales únicos0–15, predeterminados0–7. Dirección64–119 (0x40 por defecto).
Centro70–110° (90° predeterminado); límites absolutos50–130° con mínimo≤centro≤máximo
(70/110 predeterminados). Polaridad cambia mapeo, no posición lógica solicitada.
Pulsos nominales1000–2000µs para0–180°,50Hz; no son calibración certificada para
un servo concreto. Primer comando puede alcanzar una referencia desde posición
física desconocida: no prometer interpolar desde ángulo real sin realimentación.

La calibración nace «sin verificar». Se puede guardar, simular y estudiar sin
marcarla; enviar reglas/exportar para hardware exige que una persona adulta revise
centros, canales, límites y montaje sostenido. La casilla es una confirmación de
procedimiento, no un permiso de rol ni un certificado. No está ligada al hardwareID:
al copiar un proyecto o cambiar de unidad hay que volver a revisar su calibración. Probar un motor a la vez,
desacoplando varillas si hace falta; no hacer ensayos mecánicos a ciegas.

Pines SDA18/SCL19 en ejemplo Wemos, reasignables. I²C1 dedicado a PCA9685, no ocho
canales LEDC. No compartir esos GPIO con otro componente; conservar validaciones
de pines existentes. Conexión de servos canal0–7 se muestra en calibración/ayuda;
fuente externa adecuada y masa común, no alimentar ocho servos desde un GPIO.
No se cambia batería ni fuente del proyecto real por inferencia.

Preparar configura frecuencia, no emite escrituras de posición a los canales.
El PCA9685 puede conservar pulsos de una ejecución anterior mientras sigue
alimentado. Detener cancela interpolación y conserva último pulso, no desenergiza
ocho servos y hace caer el robot. Reiniciar reinicia estados lógicos; no manda
físicamente centros. La preparación siguiente parte de referencia lógica; sostener
el robot en el banco antes de iniciar. Cortar alimentación es una acción externa.

## Estados y ejemplos

`j0`..`j7`: posición ordenada respecto al centro, redondeada a grados enteros
igual en simulación/exports/intérprete, no posición medida.
`ready`: preparación aceptada; `moving`: movimiento ordenado pendiente;
`error`: rechazo por preparación/límites o fallo de bus. Todos consultables con
valores comunes y comparadores; no se simulan como sensores manuales.

1. **GorillaBot: conocer un motor**: preparar, referencia de delantero izquierdo A,
   +10°, −10°,0° tres veces, pausas. Resto sin nuevas órdenes.
2. **GorillaBot: una pata con procedimientos**: preparar, referencia de par delantero
   izquierdo, tres repeticiones A+8/B−8, A−8/B+8 y referencia; tres procedimientos
   en pestaña Una pata, Principal pequeño. No genera marcha ni traslación oculta.

## Firmware y evidencia

Intérprete mínimo1.11.0, ABI/formato1, capacidad `gorilla-bench`. Estados, acción
única `gorilla` con preparar/motor/par, validación de perfil/pines/calibración y
límites también en firmware. PCA9685 con transferencias I²C acotadas a5ms. Fallo
de bus deja error/sin preparación, cancela movimiento; no continúa como si funcionó.
Pausa congela interpolación, Paso respeta dueño de ejecución, Detener conserva
apoyo ordenado. Runtime y exports comparten motor C++ (`gorilla_core.h`, contrato
de igualdad con `lib/gorilla-core.ts`). Driver nativo IDF y Arduino con bus1 propio.

Sin dependencias nuevas ni migraciones. Hay cambios de firmware: DEV reconstruirá
la aplicación incremental para perfiles existentes y habrá que actualizar la placa;
no borrar objetos SDK ni volver a recompilar dependencias por decisión de esta fase.
El banco Waveshare no está implementado; no declararlo sólo prueba física pendiente.

Pruebas en `scripts/gorilla.test.mjs`, `scripts/gorilla-worker.test.mjs`,
`scripts/gorilla-driver.test.mjs`, `backend/tests/test_gorilla_scene_validation.py`
y `tests/gorilla.spec.ts`. Evidencia local: smoke completo,6pruebas Django58/57 y2JSON reales frontend→Django,
26contratos de empaquetado/entornos/caché, tres recorridos Chromium y repetición
visual del modular, tipos/lint/build10páginas aprobados. HAL C++ compilado con
warnings como errores para Arduino/IDF, y funciones nuevas reales del intérprete
con dobles de JSON/I2C/FreeRTOS: validación, preparación, pausa y parada aprobadas.
No se compiló aquí todo ESP-IDF ni se probó hardware. Detalle en contexto vivo. Aceptación de la mecánica real pendiente y necesaria
antes de avanzar a trayectorias/posturas de la fase59.
