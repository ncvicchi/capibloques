# GorillaBot evolutivo — fases 58 a 64

19 de octubre de 2026. El propietario autorizó documentar toda la progresión y
**empezar sólo fase58**. No ejecutar las siguientes sin autorización propia.
Base de fase58: origin/dev1 `481854cf239f3cc41fc247be8ffc1804646743f1`, rama
`codex/fase-58-gorillabot-banco`. No modificar main/dev2 ni operar servidores.

## Visión y decisiones

Un perfil GorillaBot de ocho servos dentro de la evolución futura de robots
cuadrúpedos, no una copia de Otto ni ocho componentes sueltos sin identidad.
Cuatro patas: delantera izquierda/derecha y trasera izquierda/derecha; motor A/B
en cada una. Selección, nombres, calibración y movimiento comparten ese mapa.

Referencia mecánica: [GorillaBot, Sebastian Coddington](https://www.hackster.io/SebastianCoddington/gorillabot-974dd7).
El autor describe dos servos por pata y un mecanismo de cinco barras. No son
una cadera y rodilla en serie. La controladora original, Nano, RF24 y bibliotecas
del tutorial no son dependencias nuestras: base acordada Wemos D1 R32 + PCA9685,
compatible con el perfil DevKit ESP32-S3 existente. Alimentación de servos externa,
masa común y adaptación a lógica de3,3V según módulo. No elegir batería ni
certificar potencia/servo/montaje sin identificar y probar la unidad.

Código e ilustraciones propios; no importar modelos3D, código, imágenes ni
trayectorias del proyecto de terceros con su licencia CC BY-NC-SA por inferencia.
El banco representa el mecanismo de forma ilustrativa, no certifica sus medidas.
Faltan longitudes, posiciones de ejes, rama de montaje y centros de la unidad real
para implementar cinemática cartesiana fiable y validar recorridos.

Se agregan abstracciones por niveles sin quitar las anteriores. Un niño puede
usar una postura/movimiento preparado, estudiar su procedimiento y crear otro.
Favorecer velocidad, amplitud, posición y tiempo: «potencia» no describe bien un
servo posicional. Nunca confundir orden con medición de posición real.

## Fases completas y orden

| Fase | Entrega | Estado y dependencia |
| --- | --- | --- |
| 58 | Perfil, calibración, banco de pruebas, motor individual y par de una pata | Autorizada ahora; [guía](FASE_58_GORILLABOT_BANCO.md) |
| 59 | Posturas y trayectorias de una pata | Pendiente; validar mecánica de58, medidas y rama del mecanismo |
| 60 | Marcha y pista de misiones GorillaBot | Pendiente; posturas/recorridos59 y aceptación física de apoyo/pasos |
| 61 | Autonomía sensorial y recuperación | Pendiente; marcha60 y perfiles/sensores efectivamente disponibles |
| 62 | Mando web/celular y modos manual/autónomo/mixto | Pendiente; reutilizar fase24 y transporte33; permisos/tipos y watchdog |
| 63 | Mando físico ESP32 | Pendiente; protocolo62 y joystick/botones38; transporte a elegir/validar |
| 64 | Mando/pantalla Waveshare | Pendiente; integrar34/44, misma autoridad y protocolo62 |

No renumerar fases anteriores ni presentar58 como marcha/autonomía/teleoperación.
La Fase final continúa postergada. Estas fases son de GorillaBot: no cierran
automáticamente fases24/33/34/44 ni certifican hexápodos/otros cuadrúpedos.

### 58 — Primeros motores

Perfil con canales únicos PCA9685, centros, inversión y límites; banco con vista
de cuatro patas y ampliación del par seleccionado. Preparar controlador no centra
ocho motores. Bloques para un servo o dos servos coordinados de una pata, referencia
0 relativa a su centro, movimientos pequeños y tiempos. Estados ordenados
consultables, procedimientos y dos ejemplos completos. Detalle en guía58.

En esta primera fase «mover una pata» significa mandar su par A/B explícitamente,
no introducir un bloque «subir pie» basado en dimensiones no conocidas. El plano
ilustrativo explica cómo se combinan; la cinemática medida queda en59.

### 59 — Posturas, recorridos y cinemática

**Entrega posterior19/10:** el propietario aportó STL/3MF/manual y confirmó MG90S v3. [Cinemática y trayectorias](FASE_59_GORILLABOT_CINEMATICA.md) implementadas en software, medidas nominales50/100/46mm y herramienta de medición propia. Runtime1.13.0. Sustituye el bloqueo por medidas de la decisión inicial inferior. Mantiene pendientes calibración/aceptación física y SDK completo; no autoriza marcha60.

**Decisión19/10:** implementar primero [posturas por ángulos](FASE_59_GORILLABOT_POSTURAS.md), con transiciones coordinadas y dos ejemplos. Trayectorias físicas por coordenadas/IK quedan pendientes hasta disponer de medidas reales. No publicar de pie/agachado/saludo con ángulos arbitrarios ni usar la geometría ilustrativa58 para motores reales. Esta entrega no cierra todo59.

- Confirmar longitudes, distancia entre ejes, montaje/espejos y rama de ensamblaje.
  Definir zona alcanzable sin singularidades y límites por articulación; rechazar
  recorridos inalcanzables, no recortar silenciosamente ni saltar de rama.
- Agregar coordenadas del pie adelante/atrás y arriba/abajo; identidad/sentidos
  consistentes desde el cuerpo, no desde el cable invertido de cada servo.
- Editor de posturas con nombre propio, vista previa, guardar/cancelar/undo/redo;
  unir posturas por tiempos y repeticiones, transiciones coordinadas de varios
  servos, sin dos escritores que se disputen el mismo actuador.
- Posturas de referencia, de pie, agachado/descanso y saludo, sólo cuando la
  mecánica real las admita; «sentarse» no implica asiento humano ni equilibrio.
- Ejemplos completos: secuencia directa y modular con tareas editables. Ajuste
  de límites por unidad antes de pasar a movimientos completos del cuerpo.

### 60 — Marcha y pista

- Construir «un paso» a partir de recorridos; apoyo y recuperación, coordinación
  de patas, bucles/fases, pausa y finalización en apoyo validado.
- Avanzar/retroceder/girar, velocidad y longitud de paso independientes. No
  prometer desplazamiento lateral u omnidireccional de este mecanismo planar.
- Presets de caminar visibles/descomponibles en tareas, además de control bajo
  nivel. Marcha lenta primero; trote/sprint sólo tras validación física explícita.
- Pista con estaciones, recorridos, obstáculos y misiones; no reutilizar física
  de ruedas como si ocho servos fueran motores diferenciales.
- Simulación articulada y desplazamiento idealizados, no equilibrio, adherencia,
  contacto/deformación y caídas físicamente fiables; no confundir simulación con
  certificación de un paso seguro en piso real.

### 61 — Autonomía

- Ultrasonido/distancia para detenerse y evitar obstáculos, según montaje real.
- Borde sólo con sensor orientado y perfil apropiado; un frontal no ve el vacío.
- IMU/brújula si se incorpora: identificar QMC5883L o HMC5883L, no asumir drivers
  intercambiables ni orientación inferida desde PWM. Su perfil/driver/ayuda y
  calibración son parte del alcance futuro, no componentes implementados aquí.
- Estados de misión, búsqueda limitada, timeout, parada y recuperación; medir
  posición absoluta requiere sensores adecuados, no sumar pasos como odometría
  exacta. Elegir estaciones/llegadas según entradas disponibles.
- Ejemplos directos/modulares y ensayos de sensor ausente, lectura inválida,
  obstáculo persistente y misión que no puede completarse.

### 62 — Web/celular

Un solo programa/planificador en la placa. Panel local responde desde teléfono o
navegador; no necesita servidor de desarrollo para cerrar el lazo de movimiento.
Reusar fase24 y comunicación33, no montar un segundo sistema incompatible.

- Órdenes tipadas comunes: dirección, velocidad, botones, misión y modo solicitado.
  No GPIO remoto, código arbitrario ni parámetros fuera de límites calibrados.
- Manual, autónomo y mixto explícitos; un único árbitro de movimiento. El mando
  puede seleccionar una misión sin transmitir cada posición de cada servo.
- Identidad de pareja, sesión, secuencia/edad y expiración; mensajes duplicados,
  atrasados o de otro mando no retoman un movimiento viejo. Un dueño de control.
- Hombre muerto/watchdog: al perder enlace cesar marcha y terminar/retener apoyo
  según postura físicamente validada. No cortar todos los servos indiscriminadamente
  y provocar caída. Separar mantener apoyo, detener marcha y desenergizar en banco.
- Configurar AP/cliente sin exponer secretos en JSON/historial/Git. Acordar
  transporte y medir latencia; no enviar la animación desde un servidor remoto.

### 63 — Mando ESP32

Placa con joystick y botones ya soportados; programa propio de mando y ejemplos
emisor/receptor. Misma interfaz tipada62 para intercambiar celular por mando sin
reescribir toda la lógica. Wi-Fi/mensajes es candidato inicial; ESP-NOW puede
analizarse pero no se declara implementado ni más rápido sin medición. Umbral
central, velocidad, botón habilitador, desconexión, emparejamiento y varios puestos
de aula. Control remoto no convierte los servos del robot en salidas del mando.

### 64 — Waveshare

Pantalla central con joystick/botones touch, estado/misión y calibración sólo
cuando exista un recorrido adulto seguro. Reusar34/44 y el árbitro62: Wemos/DevKit
conserva autoridad, pantalla sólo visualiza/pide acciones. Corte Wi-Fi se muestra
como dato vencido y deshabilita acciones; no ejecutar una segunda simulación como
si fuera realimentación del robot. Renderer del banco y pista también requieren
implementación propia; no son automáticamente compatibles por agregar un perfil.

## Criterios transversales

JSON y biblioteca/revisión estrictos; calibraciones por proyecto/unidad y cambios
confirmados; un reloj, movimientos cooperativos, recursos acotados y reglas sobre
concurrencia. Ayuda8–12años con ilustraciones declaradas, conexión por placa y
distinción entre órdenes y sensores. Un ejemplo se ejecuta completo; un desafío
deja trabajo por resolver. Arduino/IDF e intérprete conservan contratos iguales;
firmware mínimo/capacidades se verifican antes de enviar reglas.

Validación por capas: geometría/límites, programas reales en worker, navegador,
drivers compilados con dobles HAL, SDK real y robot físico por separado. No
borrar cachés/objetos SDK ni compilar por proyecto si usa intérprete.
