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
- [hd44780](https://github.com/duinoWitchery/hd44780): familias de controladores LCD, retorno de errores y precaución con niveles de 5 V. Evaluada; no incorporada (se usa LiquidCrystal_PCF8574).

## Uso y contrato implementado (verificación final en curso)

1. Abrir **Armar escena → Pantalla de mensajes**. Se admite una por proyecto; no se puede duplicar.
2. Elegir el modelo. Cambiarlo requiere confirmación, reinicia conexiones y retira las zonas gráficas anteriores. **Cancelar cambios** restaura la configuración previa; después de **Guardar cambios**, deshacer/rehacer conserva configuración e identidades.
3. En LCD el destino es «Pantalla completa». En OLED/TFT se configuran hasta 8 zonas con nombre, columna/fila inicial (desde cero), ancho y alto. Deben caber y no superponerse. Quitar una zona conserva su identidad retirada; ningún bloque antiguo se reasigna a otra zona silenciosamente.
4. Asignar pines manualmente o usar **Guardar cambios → Auto conectar**. Guardar la escena para confirmar el proyecto. Una configuración de layout incompleta sigue siendo recuperable localmente, pero no se publica como proyecto válido.
5. En **Mensajes**, usar «escribir en consola», «en [pantalla] zona [destino] escribir» y «borrar zona». Los bloques nuevos pueden agregarse a Favoritos. El ejemplo **Mensajes para la plaza** permite probar una LCD sin configurar todo desde cero.

Cada escritura reemplaza el destino completo y rellena con espacios lo que sobra. El texto se ajusta por celdas y se recorta si no cabe, con aviso. Máximo 512 caracteres por mensaje. Se normalizan tildes, ñ/ü y signos de apertura; los símbolos no compatibles, emojis, barra inversa y tilde ASCII se reemplazan por `?` en todos los perfiles. Estas dos posiciones ASCII no coinciden con las ROM LCD habituales. La consola conserva su comportamiento anterior y su texto original. Los saltos de línea del JSON se respetan; el campo de edición rápida escribe una línea que se ajusta automáticamente.

La simulación conserva el texto al detenerse para poder leerlo; reiniciar o cargar otro programa limpia los destinos. En modo guiado se ve cada escritura y el display resaltado. La apariencia de los glifos del navegador no es una emulación pixel a pixel; las celdas/contenido y el recorte sí comparten el mismo cálculo con el generador.

## Perfiles y bibliotecas Arduino

| Perfil | Destino/celdas | Conexión | Biblioteca fijada |
| --- | --- | --- | --- |
| LCD 16×2 | Pantalla completa, 16×2 | PCF8574 I2C, SDA/SCL | LiquidCrystal_PCF8574 2.3.0 |
| LCD 20×4 | Pantalla completa, 20×4 | PCF8574 I2C, SDA/SCL | LiquidCrystal_PCF8574 2.3.0 |
| OLED SSD1306 128×64 | Zonas, rejilla 16×8, fuente 8×8 | I2C, SDA/SCL | U8g2 2.36.19, interfaz U8x8 |
| ILI9341 320×240 horizontal | Zonas, rejilla 26×15, fuente 12×16 | SPI, SCK/MOSI/CS/DC/RST | GFX Library for Arduino 1.6.7 |
| ILI9488 480×320 horizontal | Zonas, rejilla 40×20, fuente 12×16 | SPI de 18 bits, SCK/MOSI/CS/DC/RST | GFX Library for Arduino 1.6.7, Arduino_ILI9488_18bit |

La descarga sigue siendo Arduino `.ino`, para `esp32:esp32:d1_uno32`, core 3.3.11. Instalar **sólo la biblioteca indicada por el perfil** en el gestor de bibliotecas (también se indica en el código). No se instalaron toolchains en las VMs. La compilación automática ocurre en CI, separada de las pruebas web.

Direcciones ofrecidas: PCF8574 0x20–0x27 / PCF8574A 0x38–0x3F; SSD1306 0x3C/0x3D. La dirección debe coincidir con el módulo, no se cambia físicamente por seleccionar otra en la web. El perfil LCD usa el mapeo de backpack estándar de la biblioteca; no promete compatibilidad con cualquier mochila I2C. SSD1306 no equivale a SH1106. ILI9488 SPI no equivale a su interfaz paralela.

### Cableado y fallos

Los GPIO se muestran explícitamente en la guía, sin asumir SDA=21/SCL=22 ni el SPI por defecto. VCC, GND, retroiluminación y, en LCD, contraste se revisan según el módulo. **No aplicar 5 V a los GPIO.** Las mochilas LCD alimentadas a 5 V pueden necesitar adaptación bidireccional de nivel I2C; no basta con compartir GND. TFT usa SPI de escritura a 8 MHz, sin MISO, touch ni tarjeta SD; los pines rotulados SDA/SCL en algunos TFT pueden significar MOSI/SCK, no I2C.

El adaptador conserva dos buffers acotados de caracteres (máximo 1600 bytes en ILI9488). Los bloques sólo actualizan el buffer deseado, sin cola creciente. El servicio dibuja como máximo un carácter cada 2 ms; escrituras rápidas se combinan conservando el último estado. Agregar una espera permite leer un mensaje antes de sustituirlo. No se garantiza que la placa muestre físicamente cada estado transitorio ni precisión de tiempo real.

I2C se configura con timeout de transacción de 2 ms. Se verifica respuesta antes de inicializar y antes de dibujar; ante fallo se desactiva la pantalla y se emite un diagnóstico por Serial, sin reintentos indefinidos. Corregir cables/dirección y reiniciar. Las bibliotecas tienen transferencias síncronas breves y la inicialización ocurre antes de los bloques; el timeout no es un límite de duración total de toda la inicialización. En SPI de escritura no se puede detectar la presencia del display: inicializar el controlador no demuestra que haya un módulo conectado.

**No se probó hardware físico en esta fase.** Antes de usar módulos con alumnos, una persona adulta debe verificar modelo, fuente/niveles, contraste/retroiluminación, orden de pines, texto y respuesta al desconectar. Las pruebas C++ con dobles de bus no se presentan como una prueba eléctrica.

Fuentes de los perfiles: [LiquidCrystal_PCF8574](https://github.com/mathertel/LiquidCrystal_PCF8574), [U8x8](https://github.com/olikraus/u8g2/wiki/u8x8reference), [Arduino_GFX: controladores](https://github.com/moononournation/Arduino_GFX/wiki/Display-Class), [Arduino_GFX: buses](https://github.com/moononournation/Arduino_GFX/wiki/Data-Bus-Class), [HD44780: tabla de ROM](https://cdn-shop.adafruit.com/datasheets/HD44780.pdf).
