# Fase 27 — Familia Otto

Estado: **familia genérica entregada en software; aceptación física pendiente**.

## Configuraciones disponibles

Un único componente `Robot Otto` cambia de capacidad desde su inspector, sin llenar el catálogo con robots casi iguales:

| Configuración | Capacidades |
| --- | --- |
| Bípedo | Cuatro servos: piernas y pies |
| Bípedo + sonido | Cuatro servos y buzzer pasivo |
| Explorador | Lo anterior más distancia ultrasónica |
| Expresivo | Lo anterior más una boca/cara MAX7219 de 8×8 |
| Humanoide expresivo | Seis servos, incluidos ambos brazos, sonido, distancia y expresión |

Al cambiar a una configuración menor se desconectan automáticamente los pines que ya no usa. Cada servo permite ajustar su centro entre 45° y 135° e invertir su sentido. La matriz tiene brillo configurable. Un Otto expresivo cuenta como la única salida visual admitida por el proyecto.

Estos perfiles son arquitecturas genéricas para ESP32 y no certifican todavía un kit HP Robots/Otto concreto ni una controladora oficial. La referencia conceptual fue la biblioteca [OttoDIYLib](https://github.com/OttoDIY/OttoDIYLib); el runtime generado por CapiBloques es propio y cooperativo.

## Bloques infantiles

- `Mover Otto`: centro, caminar, girar, bailar, saltar, balancearse, puntas de pie, temblar, moonwalk, inclinarse, sacudirse y aletear. Tiene potencia/velocidad y repeticiones.
- `Sonido de Otto`: ocho gestos sonoros prearmados y no bloqueantes.
- `Cara de Otto`: siete expresiones, incluido apagar la matriz.
- `Brazos de Otto`: abajo, arriba, uno arriba o abiertos.
- `Distancia de Otto`: valor numérico en centímetros, combinable con variables, comparadores y textos.

El editor sólo ofrece cada bloque a configuraciones que realmente poseen esa pieza. Los movimientos esperan únicamente dentro de su camino; `Al mismo tiempo` continúa ejecutando los demás. Un segundo camino puede reemplazar el movimiento del mismo robot y `volver al centro` lo cancela.

## Simulación y firmware

La escena muestra movimiento, fase, expresión, brazos, distancia y sonido. La distancia se modifica con un control de simulación y los sonidos usan el audio del navegador. JSON, deshacer/rehacer, favoritos, validación del servidor y revisión docente conservan la misma semántica.

Arduino y ESP-IDF generan el mismo comportamiento sin `delay`: secuencias de sonido y medición ultrasónica avanzan desde un servicio cooperativo. La CI genera y compila una configuración humanoide completa en ambos frameworks, además de probar las reglas de los cinco perfiles.

## Cableado y aceptación pendiente

Los servos necesitan una fuente externa de 5 V adecuada y masa común con el ESP32. Si se usa un HC-SR04 de 5 V, su señal ECHO debe reducirse a 3,3 V antes del GPIO del ESP32.

Falta la prueba física para ajustar centros, inversiones, amplitudes y tiempos sin forzar la mecánica. También quedan fuera de esta entrega:

- Wheels, porque su cinemática de ruedas no es un perfil bípedo.
- configuraciones oficiales Ninja u otras cuya placa, cantidad exacta de servos y periféricos todavía no se hayan inventariado;
- comunicación Bluetooth u otro firmware/controlador propio del fabricante.

Sólo después de identificar y ensayar una unidad se declarará compatible con ese modelo comercial concreto.
