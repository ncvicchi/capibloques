# Fase 16 — DIYmall ESP32-S3-DevKitC V1.0 N16R8

Estado al 19 de septiembre de 2026: **recorrido de software implementado; identificación física de placa completada; compilación real queda a cargo de CI y grabación/ejecución física pendiente de autorización expresa**.

## Hardware identificado

La unidad concreta conectada por el propietario se inspeccionó sin escribir su flash:

- placa comercial: DIYmall `ESP32-S3-DevKitC-V1.0`, distribución de headers compatible con ESP32-S3-DevKitC-1 v1.0;
- chip: ESP32-S3 QFN56, revisión de silicio 0.2, doble núcleo + núcleo de bajo consumo, hasta 240 MHz, Wi-Fi y Bluetooth LE 5;
- flash externa: 16 MiB, modo Quad, 3,3 V;
- PSRAM: 8 MiB, modo Octal, 3,3 V;
- cristal: 40 MHz;
- conector USB-UART mediante CP210x confirmado para detección normal; el conector USB nativo existe por GPIO19/20 y en esta unidad no entró automáticamente al bootloader.

El perfil se denomina `diymall-esp32-s3-devkitc-v1-n16r8`. No se generaliza a cualquier placa llamada “ESP32-S3 DevKit”. GPIO35–37 se excluyen porque la PSRAM Octal los ocupa. GPIO de arranque, consola y USB quedan visibles pero no se asignan automáticamente.

Fuentes de contraste:

- [Espressif ESP32-S3-DevKitC-1 v1.0 User Guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.0.html), pinout, conectores, LED RGB GPIO48 y reserva 35–37 con memoria Octal;
- [Arduino-ESP32 Tools Menu](https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html), selección explícita de flash, PSRAM y modo de memoria.

La ilustración SVG de `components/s3-board.tsx` es esquemática y original del proyecto, construida en código a partir de esas tablas; no copia una fotografía ni arte del fabricante. La serigrafía de la unidad física prevalece y siempre debe compararse antes de cablear.

## Contrato implementado

- El JSON v2 conserva el target Wemos histórico sin cambiar una sola clave y admite el target S3 exacto como segunda unión cerrada.
- La placa se elige dentro de **Armar escena**. Cambiar exige confirmación, no reasigna pines, entra en Deshacer/Rehacer y sólo se confirma con Guardar escena. Cancelar conserva placa y escena anteriores. El borrador recuperable incluye placa base/pendiente de forma retrocompatible.
- Agregar componentes, combinar ejemplos, validar, generar y auto-conectar usan el perfil seleccionado. Al abrir un ejemplo nuevo se asignan conexiones seguras para la placa actual.
- La guía de cableado comparte el mismo modelo de pines con el listado y cambia conjuntamente entre el SVG Wemos y el SVG DIYmall. El perfil S3 indica conectores abajo, USB-UART/USB nativo y GPIO35–37 no disponibles.
- El cliente y Django validan una unión exacta de targets. El servidor rechaza GPIO inexistentes para el destino. La compilación transforma advertencias de cableado en errores y no cruza un proyecto con otra placa.
- Arduino usa `esp32:esp32:esp32s3` con QIO 80 MHz, flash 16 MB, PSRAM OPI 8 MB y partición de 16 MB. ESP-IDF usa target `esp32s3`, configuración equivalente y sólo APIs nativas. El runtime comprueba los 8 MiB de PSRAM antes de ejecutar el programa S3.
- La cola incluye el target en el documento inmutable/cache y expone una instantánea `boardProfile` del pedido. El generador aislado acepta sólo los dos perfiles declarados; manifiesto, chip, tamaño, modo, offsets y rangos se validan contra el proyecto exacto.
- Web Serial acepta ESP32 o ESP32-S3 únicamente cuando coinciden chip y tamaño de flash con el firmware autenticado. Para S3 acepta bootloader en offset 0; para Wemos conserva 0x1000. No escribe si hay familia, capacidad, rango o manifiesto incompatibles.
- La migración `compiler.0002_build_board_profile` asigna Wemos a pedidos históricos y preserva los datos existentes.

## Evidencia de software

En Windows se verificaron `typecheck`, lint, smoke, modelo S3, generación/ZIP ESP-IDF, aislamiento del compilador y USB. CI agrega compilación real de un semáforo representativo para S3 con Arduino-ESP32 3.3.11 y ESP-IDF 5.5.5, además de conservar toda la matriz Wemos. El resultado de CI del commit final debe registrarse después del push; generar fuentes localmente no equivale a compilarlas.

La inspección con esptool confirmó chip/flash/PSRAM sin grabar. No se reemplazó el programa que tenía la placa y no se conectaron actuadores. Por eso siguen pendientes, con autorización explícita:

1. grabar el firmware completo por USB-UART y comprobar arranque/reinicio;
2. ejecutar un caso de consola, PWM y TX/RX con conexiones y alimentación revisadas;
3. repetir al menos el ejemplo común en Wemos para la aceptación física comparativa.

Hasta completar esos puntos, la fase está terminada en software pero el soporte físico no se presenta como certificado.

## Operación

Esta entrega modifica frontend, backend, migración, compilador y runner. El propietario despliega después del commit/CI con:

```sh
cd /home/capi/capibloques && ./scripts/update-dev.sh
```

El orquestador debe detectar el cambio de API/migración/receta y aplicar su procedimiento normal. No desplegar manualmente partes sueltas ni recrear volúmenes.
