# Referencia del dibujo de Wemos D1 R32

La fase 12 usa un SVG técnico propio, generado por `components/wemos-board.tsx`, con contactos definidos en `lib/wemos-board.ts`. No se incorporaron fotografías, SVG de terceros ni imágenes generadas por IA. Es una vista superior esquemática, USB a la izquierda, no a escala. Se omiten los pads internos porque no se conectan en el perfil actual.

Fuentes contrastadas el 8 de septiembre de 2026:

- [Variante d1_uno32 de Espressif, versión fija Arduino-ESP32 3.3.11](https://github.com/espressif/arduino-esp32/blob/3.3.11/variants/d1_uno32/pins_arduino.h): alias D/A, SDA/SCL, UART y SPI.
- [Fotografía de distribución enlazada por esa variante](https://www.botnroll.com/img/cms/pinOut-R32-compressor.png): orden físico de las cabeceras y orientación. Se consultó como referencia; no se redistribuye la imagen.
- [GPIO de ESP32, documentación Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html): restricciones de entradas, flash y arranque. No extender automáticamente el catálogo de conexiones a todos los contactos del dibujo.

La cabecera superior, de izquierda a derecha, es SCL, SDA, RST, GND, IO18, IO19, IO23, IO5, IO13, IO12; luego IO14, IO27, IO16, IO17, IO25, IO26, TX0, RX0. La inferior es IO0, 5V, RST, 3V3, 5V, GND, GND, VIN; luego IO2, IO4, IO35, IO34, IO36, IO39. El contacto de alimentación puede aparecer rotulado VN/VIN según variante.

Puntos sensibles: A2 = GPIO35, A4 = GPIO36. No copiar diagramas de terceros que indican 36/38 en esos lugares. D2 = GPIO26, no GPIO2. Las leyendas D/A se presentan como alias, no como texto necesariamente impreso en la placa. SDA21/SCL22 se muestran como referencia física; la aplicación conserva sus asignaciones explícitas de bus, no reasigna una pantalla a esos contactos por mostrar el dibujo.

La imagen y la tabla reciben las mismas filas, incluidas las salidas avanzadas. Seleccionar un GPIO destaca todas sus filas, sin ocultar conflictos. Un pin sin ubicación no se dibuja en un lugar inventado. Las capacidades y validaciones siguen en `lib/scene-model.ts`; la imagen no certifica cableado, polaridad, alimentación ni corriente.

El perfil activo sigue siendo Wemos D1 R32. Los dibujos de ESP32-S3 DevKit y Waveshare pertenecen a las fases 16 y 17, aún pendientes.
