# Componentes a implementar

**Estado:** lista maestra planificada. Documentar un componente aquí no lo declara implementado ni autoriza comprarlo, desplegarlo o cerrar su aceptación física.

Esta lista consolida los componentes adicionales recomendados el 23 de septiembre de 2026. Complementa los componentes ya existentes —pantallas, matriz MAX7219, Mensajes, semáforo, robot, Otto, motor DC, LED, servo, buzzers, botón, barrera infrarroja, LDR, potenciómetro y Wi‑Fi— y evita crear entradas dispersas o varios componentes infantiles para módulos que representan el mismo concepto.

## 1. Criterios de selección

Se priorizan componentes que:

- abran una forma nueva de programar —eventos, magnitudes, varios valores, geometría o identificación—;
- puedan simularse con una interacción comprensible para chicos de 8 a 12 años;
- tengan un contrato común en simulador, firmware intérprete, Arduino y ESP-IDF;
- admitan perfiles físicos sin duplicar bloques infantiles;
- ofrezcan estados y valores tipados utilizables en variables, textos, condiciones, timers y procedimientos;
- tengan conexión y alimentación documentables sin presentar como segura una instalación que no lo es.

Cada incorporación incluye escena, configuración, ayuda infantil, simulación, bloques/valores/eventos, validación, importación/exportación, ambos generadores, firmware intérprete cuando exista, pinout por placa, pruebas automatizadas y aceptación física con el módulo real.

## 2. Prioridad inmediata

### 2.1 Luces RGB inteligentes

- Nombre infantil: **Luces RGB inteligentes**.
- Perfiles: WS2812B/WS2812 y SK6812 RGB; tira/cadena, barra, aro, figura y matriz.
- Capacidades: conjunto, píxel, tramo, color, brillo, degradado, dibujos y animaciones cooperativas.
- Ya está especificado como [pedido 33 del backlog](BACKLOG.md#33-luces-rgb-inteligentes-ws281x-y-sk6812) y asignado a la fase 35. No duplicar esa fase ni crear componentes diferentes por cada forma.

### 2.2 Sensor de distancia

- Nombre infantil: **Sensor de distancia**.
- Perfiles iniciales: HC-SR04 por Trigger/Echo y VL53L0X por I²C.
- Valor común: distancia, presentada en centímetros; estado adicional configurable «cerca/lejos» derivado de umbrales.
- Simulación: obstáculo arrastrable o control numérico, conservando el mismo valor para bloques y escena.
- Casos: robot, estacionamiento, instrumento, alarma, medición de nivel y conteo por paso.
- El perfil oculta diferencias de protocolo pero no diferencias eléctricas ni rango/precisión. En HC-SR04 se documenta el tratamiento requerido para Echo cuando el módulo opere a 5 V.

### 2.3 Detector de movimiento

- Nombre infantil: **Detector de movimiento**.
- Perfil inicial: PIR HC-SR501 o equivalente de salida digital.
- Estado/condición: «hay movimiento» / «no hay movimiento».
- Eventos: comenzó el movimiento y terminó el movimiento, con tiempo de estabilización/rearme visible en la simulación.
- Casos: luz automática, alarma, contador de presencia y ahorro de energía.

### 2.4 Sensor ambiental

- Nombre infantil: **Sensor ambiental**.
- Perfil inicial: BME280 por I²C; no confundirlo silenciosamente con BMP280, que no mide humedad.
- Valores: temperatura, humedad relativa y presión, con unidades visibles y rangos razonables.
- Simulación: controles independientes y escenarios predefinidos —frío, caluroso, seco, húmedo—.
- Casos: estación ambiental, mensajes en pantalla, alarmas por umbral, registro y envío por Wi‑Fi.

### 2.5 Joystick

- Nombre infantil: **Palanca de control**.
- Hardware: dos ejes analógicos y pulsador.
- Valores/estados: horizontal y vertical normalizados, dirección derivada, centro y botón presionado.
- Simulación: palanca arrastrable que vuelve al centro; admite teclado y táctil.
- Casos: conducir robots, mover servos, dibujar y navegar menús.

## 3. Segunda prioridad

### 3.1 Interruptor de potencia de baja tensión

- Nombre infantil: **Encender aparato**.
- Perfiles: módulo MOSFET para cargas DC y relé de módulo sólo para demostraciones de baja tensión.
- Estado: encendido/apagado; el MOSFET puede ofrecer potencia regulable cuando el perfil y la carga lo permitan.
- Casos: ventilador, bomba pequeña, solenoide y tira de luz no direccionable.
- Alcance obligatorio: no enseñar, ilustrar ni validar conexiones directas a 110/220 V. CapiBloques no convierte un relé en una instalación segura.

### 3.2 Sensor de inclinación y movimiento

- Nombre infantil: **Sensor de movimiento e inclinación**.
- Perfil inicial: MPU6050 por I²C.
- Valores: aceleración y giro en tres ejes; estados derivados sencillos como inclinado, quieto, sacudido o caído.
- Simulación: objeto orientable en tres ejes y gestos predefinidos.
- Casos: control gestual, robot que detecta caída, alarma de movimiento y juegos de equilibrio.

### 3.3 Lector de tarjetas

- Nombre infantil: **Lector de tarjetas**.
- Perfil preferido: PN532 NFC/RFID; comenzar por una única interfaz validada y ampliar sólo si existe hardware real.
- Valores/eventos: tarjeta presente, identificador leído y tarjeta retirada.
- Simulación: conjunto editable de tarjetas predefinidas que se acercan mediante botones, sin pedir escritura libre durante la ejecución.
- Casos: acceso, asistencia simulada, objetos identificados y selección de modos.
- El identificador no se presenta como autenticación segura por sí solo ni se registran identificadores reales sin necesidad y permisos.

### 3.4 Sensor de humedad de tierra

- Nombre infantil: **Sensor de humedad de tierra**.
- Perfil preferido: capacitivo; los perfiles resistivos quedan fuera del inicio por corrosión y dependencia de alimentación/calibración.
- Valor: nivel normalizado y estados derivados seco/adecuado/mojado configurables.
- Simulación: maceta con control de humedad y cambios graduales.
- Casos: cuidado de plantas, alarma y riego con bomba de baja tensión.

### 3.5 Perilla infinita

- Nombre infantil: **Perilla infinita**.
- Perfil: encoder rotativo incremental con pulsador opcional.
- Eventos/valores: giró a izquierda, giró a derecha, cantidad acumulada y presionado.
- Simulación: perilla girable, botones accesibles y teclado.
- Casos: menús, volumen, selección de color/modo y ajuste de consignas.

## 4. Tercera prioridad

### 4.1 Motor paso a paso

- Nombre infantil: **Motor de pasos**.
- Perfil inicial: 28BYJ-48 con ULN2003; otros controladores requerirán perfiles explícitos.
- Controles: dirección, velocidad y cantidad de pasos o vueltas; movimiento cooperativo y cancelable.
- Casos: agujas, plataformas, dispensadores y posicionamiento repetible.

### 4.2 Sensor de color

- Nombre infantil: **Sensor de color**.
- Perfil propuesto: TCS34725 por I²C.
- Valores: rojo, verde, azul, claridad y color aproximado; la aproximación se distingue de una identificación exacta.
- Casos: clasificación, semáforos, lectura de tarjetas de colores y robots seguidores de consignas.

### 4.3 Sensor de sonido

- Nombre infantil: **Nivel de sonido**.
- Primera versión: magnitud normalizada y evento de aplauso/umbral; no captura, conserva ni transmite audio.
- Los módulos con salida analógica o comparador digital se modelan como perfiles distintos si cambian las capacidades.
- Casos: luces por aplauso, medidor visual y disparador de acciones.

### 4.4 Teclado matricial

- Nombre infantil: **Teclado de números y teclas**.
- Perfil inicial: matriz 4 × 4; admitir 3 × 4 después sin duplicar el componente.
- Valor/evento: tecla actual y tecla presionada/liberada.
- Casos: menús, códigos de juego, calculadora y entrada de parámetros.

### 4.5 Sensor de agua o lluvia

- Nombre infantil: **Detector de agua**.
- Valores: nivel normalizado cuando el módulo sea analógico y mojado/seco cuando sólo ofrezca salida digital.
- Casos: alarma de lluvia, fuga y nivel básico.
- Debe explicar corrosión, calibración y que no es un dispositivo de seguridad certificado.

### 4.6 Balanza

- Nombre infantil: **Balanza**.
- Perfil inicial: celda de carga con HX711.
- Valor: peso calibrado y estado sobre/bajo un umbral.
- Simulación: objetos predefinidos o control de peso; calibración separada de los bloques infantiles.
- Casos: clasificación, dosificación y experimentos de medición.

### 4.7 Ubicación GPS

- Nombre infantil: **Ubicación GPS**.
- Valores: posición, altura, velocidad, hora y estado de señal; las coordenadas se exponen sólo cuando exista solución válida.
- Simulación: recorridos predefinidos y posiciones ficticias, nunca la ubicación real del alumno por defecto.
- Casos: recorridos, telemetría exterior y geocercas didácticas.
- Requiere política de privacidad y permisos antes de cualquier función que use ubicación real.

## 5. No recomendados para la primera implementación

Se conservan en la lista para impedir que reaparezcan sin analizar, pero no forman parte del alcance inicial:

- **DHT11:** no priorizar; BME280 ofrece más magnitudes y una interfaz digital reutilizable. Podría existir más adelante como perfil económico si hay módulos físicos que lo justifiquen.
- **Sensores resistivos de suelo:** no priorizar por corrosión y variación con alimentación; preferir capacitivo.
- **Sensores MQ de gas y módulos de llama:** no ofrecer como detectores de seguridad. Exigen calentamiento/calibración y pueden producir confianza indebida.
- **Relés para tensión de red:** fuera de alcance. Sólo cargas didácticas de baja tensión.
- **Cámara, reconocimiento de imágenes y reconocimiento de voz:** postergados; implican captura de datos, privacidad y una arquitectura muy superior a un componente normal.
- **Decenas de modelos equivalentes:** no crear un componente por fabricante. Usar una capacidad infantil común y perfiles físicos comprobados.

## 6. Agrupación en fases

La lista se entrega por familias completas, no por subfases con letras:

- **Fase 35:** Luces RGB inteligentes, ya planificada.
- **Fase 38:** Entradas y control cotidiano: Sensor de distancia, Detector de movimiento, Palanca de control, Encender aparato y Perilla infinita.
- **Fase 39:** Ambiente y medición: Sensor ambiental, Humedad de tierra, Sensor de color, Nivel de sonido y Detector de agua.
- **Fase 40:** Movimiento e identificación: Sensor de movimiento e inclinación, Lector de tarjetas y Teclado de números y teclas.
- **Fase 41:** Actuación y medición avanzada: Motor de pasos, Balanza y Ubicación GPS.

Cada fase se considera terminada sólo cuando todos sus componentes cumplen el contrato común y se prueba físicamente al menos un perfil declarado de cada uno. Si el hardware no está disponible, puede quedar terminado en software, pero no aceptado físicamente; ambos estados se informan por separado.

## 7. Orden recomendado

Después de la fase 35, el orden de mayor retorno educativo es:

1. Sensor de distancia.
2. Detector de movimiento.
3. Sensor ambiental.
4. Palanca de control.
5. Encender aparato de baja tensión.
6. Perilla infinita.
7. Sensor de movimiento e inclinación.
8. Lector de tarjetas.
9. Humedad de tierra.
10. Resto de las fases 39–41 según el hardware físico disponible y los desafíos que se quieran construir.

## 8. Fuentes técnicas iniciales

- [NeoPixel/WS281x/SK6812: formatos y protocolo](https://learn.adafruit.com/adafruit-neopixel-uberguide?view=all).
- [VL53L0X: sensor de distancia ToF](https://learn.adafruit.com/adafruit-vl53l0x-micro-lidar-distance-sensor-breakout).
- [PIR como entrada digital](https://learn.adafruit.com/pir-passive-infrared-proximity-motion-sensor/using-a-pir-w-arduino).
- [BME280: temperatura, humedad y presión](https://www.bosch-sensortec.com/en/products/environmental-sensors/humidity-sensors-bme280).
- [MPU6050: acelerómetro y giróscopo I²C](https://learn.adafruit.com/mpu6050-6-dof-accelerometer-and-gyro?view=all).
- [PN532: NFC/RFID](https://learn.adafruit.com/adafruit-pn532-rfid-nfc/about-nfc).
- [Encoder rotativo incremental](https://learn.adafruit.com/rotary-encoder?view=all).
- [ADC y touch de ESP32-S3](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html).

Las fuentes orientan los perfiles; la especificación final se fija contra el módulo físico concreto, su hoja de datos y las placas CapiBloques admitidas.
