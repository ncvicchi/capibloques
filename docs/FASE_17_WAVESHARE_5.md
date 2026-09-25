# Fase 17 — Waveshare ESP32-S3 Touch LCD 5 SKU 28117

Estado al 24 de septiembre de 2026: **implementación y verificación local terminadas; compilación real de toolchain en CI, despliegue DEV y aceptación física pendientes**.

## Hardware exacto

El perfil `waveshare-esp32-s3-touch-lcd-5-28117` representa únicamente la SKU 28117:

- ESP32-S3-WROOM-1-N16R8, flash Quad de 16 MiB y PSRAM Octal de 8 MiB;
- panel RGB paralelo de 5 pulgadas, **800 × 480**, 16 bits y pixel clock de 16 MHz;
- touch capacitivo GT911 en I2C, dirección 0x5D;
- expansión CH422G para reset y retroiluminación.

La resolución se contrastó con la [documentación oficial](https://docs.waveshare.com/ESP32-S3-Touch-LCD-5) y la [ficha oficial SKU 28117](https://www.waveshare.com/product/mcu-tools/esp32-s3-touch-lcd-5.htm). La variante 5B de 1024 × 600 es otro producto. El diagrama publicado es un SVG original del proyecto construido desde las tablas oficiales; no copia una fotografía del fabricante.

## Recursos reservados

El driver usa HSYNC 46, VSYNC 3, DE 5, PCLK 7 y datos RGB 14/38/18/17/10/39/0/45/48/47/21/1/2/42/41/40. Touch/expansor comparten SDA 8 y SCL 9, con interrupción en GPIO4. USB nativo ocupa 19/20; microSD 11/12/13; CAN 15/16 y RS485 43/44.

Los bornes CAN/RS485 y las E/S aisladas del CH422G no se presentan como GPIO genéricos. Por eso este perfil tiene cero pines de autoconexión escolar: simular sigue permitido, pero CapiBloques no inventa que un LED, servo o motor puede conectarse a un GPIO que la placa no expone. La fase 18 deberá decidir una expansión física si pretende accionar componentes externos desde esta unidad.

Esto no significa que la placa carezca de conexiones externas: expone I2C, CAN,
RS485 y dos entradas/dos salidas digitales aisladas. Deben modelarse como buses
y E/S tipadas —con sus tensiones, direcciones y límites—, no incorporarse a la
lista de GPIO escolares. La ampliación híbrida de fase 18 usará esas capacidades
para componentes reales compatibles y mostrará el resto como simulación local.

## Contrato implementado

- Selector de placa, JSON v2, cliente, backend, cola, compilador, manifiesto y USB reconocen el destino exacto, sin mezclarlo con la DevKit S3.
- Al agregar una pantalla en esta placa se elige `waveshare5` automáticamente. Ese perfil no aparece en otras placas y la Waveshare rechaza perfiles externos que no puede cablear con el contrato actual.
- La vista previa usa 50 × 30 celdas de 16 × 16 sobre 800 × 480, con zonas, texto, dibujos y animaciones cooperativas existentes. Se conserva una sola salida visual por proyecto.
- Arduino-ESP32 3.3.11 y ESP-IDF 5.5.5 generan inicialización RGB con framebuffer en PSRAM, timings 4/8/8 horizontales y verticales y orden de datos exacto de la SKU.
- La inicialización maneja CH422G, reset GT911 y retroiluminación. El servicio lee el touch cada 16 ms y refresca como máximo una celda por turno; expone `capiTouchDown`, `capiTouchX` y `capiTouchY` para la fase 18.
- La guía de conexiones muestra la placa correcta y diferencia pantalla/touch integrados de los buses externos. La ayuda explica que no hay cables configurables para el display integrado.

El intérprete genérico existente no se publica todavía para esta tercera placa: la fase 17 entrega compilación Arduino/ESP-IDF y firmware específico. Publicar un intérprete Waveshare que no conduzca su pantalla sería engañoso; su adaptación se mantiene ligada al plan del firmware intérprete.

## Evidencia de software

Pasaron localmente typecheck, lint, smoke, generación de doce ZIP ESP-IDF, validación CRC/SHA, pruebas Arduino/ESP-IDF con HAL de escritorio para los seis displays anteriores, USB, build de diez páginas y 8/8 recorridos Chromium de pantallas/perfiles. Los tests de fuente comprueban perfil, resolución, timings, panel RGB, GT911, persistencia y rechazo cruzado. La validación descubrió y corrigió que la importación no restauraba el destino de placa y que el simulador validaba escenas importadas como si siempre fueran Wemos.

Los HAL de escritorio excluyen deliberadamente `esp_lcd`: la compilación real de `waveshare5` queda incorporada a CI tanto para Arduino como ESP-IDF. No afirmar que compila en toolchain ni que funciona físicamente hasta registrar el resultado del commit publicado.

## Aceptación física pendiente

Después de actualizar DEV:

1. elegir la placa Waveshare SKU 28117 y agregar su pantalla integrada;
2. guardar, recargar e importar/exportar el proyecto;
3. compilar y programar primero un mensaje estático y después una animación con otro camino cooperativo;
4. confirmar orientación, 800 × 480, retroiluminación, zonas y coordenadas GT911;
5. medir memoria libre/PSRAM y comprobar que delay lógico, UART y refresco siguen avanzando juntos.

Un fallo físico no habilita a probar pines al azar ni a sustituir el perfil por ILI9341/ILI9488.

## Actualización DEV

El propietario ejecuta, después del push:

```sh
cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s -- --fast
```

Este cambio toca backend y compilador; el actualizador puede reconstruir esos servicios. El modo `--fast` evita esperar GitHub Actions, pero no omite las comprobaciones locales de DEV.
