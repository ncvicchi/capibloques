# Fase 7 — Mensajes y pantallas

Autorizada el 7 de septiembre de 2026. **En implementación; no entregada ni verificada todavía.**

## Alcance acordado

- Conservar consola simulada y Serial de Arduino como destino explícito, independiente de las pantallas.
- Texto directo a pantallas de caracteres o a componentes de texto dentro de una pantalla gráfica.
- Bloques y contenido independientes del controlador físico; cada destino tiene identidad, dimensiones y contenido propio.
- Agregar/configurar pantallas y zonas de texto, con Guardar/Cancelar y deshacer/rehacer, simulación normal/guiada, JSON y generación Arduino para la Wemos D1 R32 actual.
- Una sola pantalla por escena/proyecto (aclaración del propietario). En una pantalla gráfica puede haber varias zonas de texto; no implementar gestión de múltiples pantallas ni buses compartidos.
- Validar límites de texto, layout y conexiones; fallos o ausencia de pantalla no pueden introducir esperas indefinidas.
- Probar contratos de persistencia/backend, simulación, compilación real de fixtures y recorridos en Chrome/Edge contra DEV. La compilación no sustituye la prueba física de cada módulo.

El propietario confirmó LCD I2C 16×2/20×4 y OLED SSD1306 128×64, y pidió sumar controladores ILI por SPI. Se incluyen ILI9341 e ILI9488 (SPI de 18 bits), con perfiles concretos; no un controlador ILI genérico. La estructura de mensajes y componentes es independiente del modelo.

Fuera de esta fase: Waveshare de 5 pulgadas, ESP32-S3, representar la escena completa/controlar actuadores desde un display, TX/RX configurable, rediseño general de interfaz, ESP-IDF, servidor compilador y USB. Siguen en el plan/backlog; el usuario autorizó ahora específicamente mensajes de texto.

## Fuentes técnicas revisadas

- [I2C en Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html): pines explícitos y timeout de transacciones.
- [Referencia U8x8](https://github.com/olikraus/u8g2/wiki/u8x8reference): texto por celdas en displays gráficos y configuración de dirección I2C.
- [hd44780](https://github.com/duinoWitchery/hd44780): familias de controladores LCD, retorno de errores y precaución con niveles de 5 V. Biblioteca evaluada, no elegida todavía.
