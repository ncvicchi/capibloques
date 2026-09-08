# Fase 8 — Arduino y ESP-IDF

Autorizada por el propietario: «Vamos con 8». **En implementación, no entregada todavía.**

## Alcance

- Mantener Arduino `.ino` y JSON; sumar ZIP de proyecto ESP-IDF nativo para Wemos D1 R32/chip ESP32.
- Usar el mismo programa intermedio y grafo cooperativo: condiciones, contadores saturados, bucles, esperas y fork/join. No convertir las ramas en tareas FreeRTOS independientes.
- Cubrir GPIO, ADC, LED/PWM, motores, servos, buzzers, Wi-Fi, consola y los cinco perfiles de pantalla actuales; conservar sus límites y diagnósticos de cableado.
- ESP-IDF 5.5.5 fijado, sin Arduino como componente ni instalación de bibliotecas externas durante la exportación. ZIP determinista con C/C++, CMake, configuración, instrucciones, licencias y manifiesto de fuentes.
- Descarga en editor y revisión docente, con las mismas protecciones de cableado, permisos y versión. No incorporar credenciales Wi-Fi a JSON ni al servidor; conservar marcadores para configuración local.
- Probar paridad lógica, exportación/JSON anterior, errores de configuración, compilación real con versiones fijadas y Chrome/Edge sobre DEV.

Fuera de fase: servidor compilador/cola/binarios (9), USB/monitor físico (10), producción/HTTPS/piloto (11), ESP32-S3, Waveshare, TX/RX configurable y rediseño de UX del backlog. Compilación en CI, sin toolchains pesadas en las VMs. Las pruebas físicas no se sustituyen por compilar.

## Referencias de implementación

- [ESP-IDF 5.5.5](https://github.com/espressif/esp-idf/releases/tag/v5.5.5), publicada el 17 de julio de 2026.
- [ADC oneshot](https://docs.espressif.com/projects/esp-idf/en/v5.5.5/esp32/api-reference/peripherals/adc_oneshot.html), [Wi-Fi](https://docs.espressif.com/projects/esp-idf/en/v5.5.5/esp32/api-reference/network/esp_wifi.html).
- APIs nativas de GPIO, LEDC, I2C master, SPI master y reloj `esp_timer`; revisar firmas en los headers del tag fijado.

La imagen oficial de CI se fijará por digest. El manifiesto identifica fuentes/configuración, no es todavía un manifiesto de direcciones de flash ni un firmware listo para grabar.
