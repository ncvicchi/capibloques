# Firmware intérprete CapiBloques

Proyecto ESP-IDF versionado del intérprete genérico. No contiene programas de alumnos ni secretos. Recibe paquetes `CapiRules` por `CapiLink`, valida placa/ABI/checksum, escribe la candidata en la ranura flash inactiva, la vuelve a leer y sólo entonces cambia en NVS el selector A/B. Un corte durante la transferencia conserva la versión activa anterior.

Perfiles iniciales:

- `wemos-d1-r32`: `idf.py set-target esp32`, definición `CAPI_BOARD_ID=\"wemos-d1-r32\"`.
- `diymall-esp32-s3-devkitc-v1-n16r8`: `idf.py set-target esp32s3`, definición correspondiente.

Los binarios son artefactos generados y no se versionan. `scripts/build-interpreter-firmware.sh` crea los paquetes publicables con la versión, placa y hash verificables.
