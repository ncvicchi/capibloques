# Fase 8 — Arduino y ESP-IDF

Autorizada por el propietario: «Vamos con 8». **Implementada y verificada en DEV** (7 de septiembre de 2026). Arduino conservado y ZIP ESP-IDF nativo disponible; no incluye compilación en servidor ni grabación web. Pruebas físicas pendientes.

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

La imagen oficial de CI está fijada por digest en el workflow y el ZIP. El manifiesto identifica fuentes/configuración, no es todavía un manifiesto de direcciones de flash ni un firmware listo para grabar.

## Uso

1. Abrir o importar un proyecto en DEV, simular y corregir los diagnósticos.
2. En **Exportar**, elegir **Código Arduino .ino** o **Proyecto ESP-IDF .zip**. Ambas opciones conservan la confirmación de conexiones. Si cambian los componentes/pines, revisarlas nuevamente.
3. **Ver código ESP32 → Formato de código** permite alternar las vistas. En ESP-IDF se ve `main/main.cpp`: copiar ese texto no reemplaza descargar el proyecto completo.
4. Extraer el ZIP. En una terminal de ESP-IDF **5.5.5**, ejecutar `idf.py set-target esp32` y `idf.py build`. El proyecto rechaza otro chip/versión para no presumir compatibilidad.
5. Para Wi-Fi, copiar `main/wifi_config.example.h` como `main/wifi_config.h` y editarlo sólo en la PC. Está excluido de Git. El archivo exportado usa marcadores, nunca una clave de la cuenta o del servidor. El binario compilado con credenciales sí las contiene: no compartirlo.
6. Con las herramientas oficiales instaladas localmente, `idf.py -p PUERTO flash monitor` permite grabar. La web todavía no compila ni graba: corresponden a las fases 9 y 10.

La revisión docente ofrece la descarga ESP-IDF de la versión seleccionada después de revisar sus conexiones. Revalida acceso/versión antes de preparar el ZIP y acceso nuevamente después; perder permisos o cambiar de sesión cancela la descarga. No modifica el original ni incluye conversaciones. JSON sigue siendo el formato importable de CapiBloques: no se importan ZIP de fuentes ni `.ino` para reconstruir bloques.

## Contratos técnicos

- `generateEsp32CodeResult` conserva Arduino por defecto; `generateEspIdfCodeResult` selecciona APIs nativas al emitir cada instrucción. Comparten normalización, validación, programa intermedio y `compileTaskGraph`. No hay traducción mediante reemplazos de texto ni Arduino oculto como componente IDF.
- Un único bucle `app_main`, quantum lógico de 16 ms y presupuesto de instrucciones por camino. Las esperas y fork/join conservan las reglas del worker/Arduino. La inicialización ocurre antes de ejecutar bloques; no se garantiza tiempo real ni igualdad de latencias eléctricas.
- GPIO nativo; ADC oneshot de 12 bits, lectura cruda 0..4095 y error acotado. LEDC distribuye hasta 16 canales en dos bancos de ocho, con cuatro temporizadores por banco. Servo de 50 Hz/16 bits; motores de 20 kHz; el buzzer pasivo tiene temporizador exclusivo y ajusta resolución para cubrir 20..20000 Hz sin cambiar el PWM de otros actuadores.
- Consola UART0/115200: cola de 32 punteros a mensajes constantes y una tarea de salida. Cola llena hace esperar sólo al camino que escribe; no avanza su instrucción ni crece memoria sin límite. Pantallas y consola son destinos independientes.
- Wi-Fi usa eventos y estado atómico, configuración RAM y una radio compartida. No borra NVS para recuperar fallos. Los bloques conservan timeout; no son conexiones de red independientes por camino.
- LCD PCF8574 16×2/20×4 y SSD1306 con I2C master nativo. TFT ILI9341 RGB565 e ILI9488 SPI de 18 bits, ambos horizontales, con SPI master nativo. Configuración explícita de pines; una pantalla por proyecto, sin MISO/touch/SD ni buses compartidos con nuevos periféricos.
- Pantallas conservan zonas/celdas, recorte y normalización de texto de fase 7. Buffers acotados, último estado deseado y como máximo un carácter por servicio. I2C: transacción/probe de 5 ms; SPI: cola y resultado de hasta 20 ms cada uno. Son límites por operación, no de toda la inicialización. Un error desactiva el display hasta reiniciar y no introduce reintentos infinitos. El descriptor/buffer SPI persiste y no se reutiliza tras timeout.
- La tipografía ASCII proviene de Adafruit_GFX; las tablas TFT adaptan los perfiles de Arduino_GFX 1.6.7. Se incluyen licencias BSD y procedencia tanto en el repo como en el ZIP. Los drivers ejecutables usan sólo ESP-IDF. No se afirma identidad visual pixel a pixel con la tipografía OLED U8x8.
- ZIP determinista, nombres internos fijos, CRC32 y manifiesto SHA-256 de todas las fuentes/configuración; máximo 64 entradas/16 MiB. Contiene CMake, `sdkconfig.defaults`, README, licencias y plantilla Wi-Fi. No contiene binarios, identidad del usuario ni direcciones de flash.

## Verificación

Las pruebas usan cuentas/documentos sintéticos y dispositivos de prueba. El compilador real corre en GitHub CI, no en las VMs limitadas. Se compilan **los archivos extraídos del ZIP exportado**, no una fuente alternativa preparada sólo para CI.

Comandos: `npm run typecheck`, `npm run lint`, `npm run test:smoke`, `npm run test:idf`, `npm run test:idf-driver`, `npm run test:display-driver`. `node --experimental-strip-types scripts/generate-idf-fixtures.mjs` y `python scripts/verify-idf-archives.py` producen/verifican siete ZIP sintéticos: circuito principal, auxiliar y cinco perfiles de pantalla.

`test:idf-driver` compila y ejecuta el C++ generado con dobles de HAL: PWM y frecuencias extremas, GPIO sin pulsos bajos repetidos, errores ADC, Wi-Fi por eventos, saturación de consola, rollover de reloj, contadores saturados, ejecución real del bucle y fork/join, refresco y borrado por zona, ausencia/corte de bus y persistencia de memoria SPI ante timeout. No reemplaza compilar con la API real ni probar una placa.

**No se verificó hardware físico.** Antes de usarlo con alumnos, comprobar modelo real, niveles/fuente, límites mecánicos, conexiones y comportamiento autónomo. Un error de GPIO/PWM puede reiniciar por `ESP_ERROR_CHECK`; no es una parada de emergencia garantizada. No aplicar 5 V a los GPIO. Un SPI de escritura no detecta que falta la pantalla.

### Evidencia de entrega

Código funcional: `f52cf08`, con [los cuatro trabajos de CI correctos](https://github.com/ncvicchi/capibloques/actions/runs/34179399332). Pruebas sobre datos sintéticos, sin modificar cuentas/proyectos reales.

- **DEV, Chrome/Edge: 72 pruebas de regresión correctas** sobre `9078de4`, sin reintentos: pantallas, exportación nativa, programación, revisión docente y recuperación de escenas. Tras los últimos ajustes, **10 pruebas de exportación correctas** sobre `f52cf08`, sin reintentos, incluyendo los cinco perfiles, permisos revocados durante el ZIP, Arduino conservado y cuadro de código móvil a 390 px. Capturas en `work/phase8-regression` y `work/phase8-final-export`, no versionadas. La prueba móvil detectó y permitió corregir el desborde horizontal de los controles.
- **Siete compilaciones Arduino correctas**, core 3.3.11, [trabajo de firmware](https://github.com/ncvicchi/capibloques/actions/runs/34179399332/job/101915226962). La extracción de fixtures compartidos conservó byte a byte los dos `.ino` previos, comprobados localmente antes/después.
- **Siete compilaciones ESP-IDF correctas**, 5.5.5 y target `esp32`, [trabajo nativo](https://github.com/ncvicchi/capibloques/actions/runs/34179399332/job/101915226663). Se validan CRC/SHA de cada ZIP, se extraen sus archivos y se recompila `main.cpp` para cada perfil. Se reutilizan sólo los objetos comunes del framework en un directorio de CI. El log conserva siete recompilaciones y siete SHA-256 distintos de binarios; no se publican binarios a usuarios en esta fase.
- **C++ nativo: 12 escenarios correctos** con HAL de prueba (runtime, fork/join y dos por pantalla). Arduino conserva sus cinco pruebas C++ de display. Se corrigieron una incompatibilidad de tipos de `uint32_t` en Xtensa y la resolución del temporizador necesaria para notas graves. El build nativo real confirma las firmas de las APIs; los dobles permiten comprobar fallos y estados internos reproducibles.
- **Backend CI: 167 pruebas correctas**, más preparación de secretos sintéticos y persistencia tras recreación; [trabajo backend](https://github.com/ncvicchi/capibloques/actions/runs/34179399332/job/101915226868). No hubo cambios de API, modelos, migraciones ni datos DEV en esta fase.
- **CI Chromium: 150 pruebas correctas**, sin fallos ni reintentos, [trabajo web](https://github.com/ncvicchi/capibloques/actions/runs/34179399332/job/101915226869), junto con tipos, lint, pruebas de núcleo/HAL, auditoría de dependencias y build. Los cuatro trabajos finalizaron correctamente sobre el mismo commit funcional.
- Tipos, lint, simulador, persistencia local, ZIP y build verificados localmente. El build mantiene el aviso previo de bundles de más de 500 kB, sin error; verifica nueve páginas estáticas. No se presenta este cambio como una optimización general de carga del editor.

Despliegue limitado a DEV mediante el túnel existente; `/api/health/ready/` saludable. PRD, gateway, Proxmox, router y Nginx no se modificaron. No se instalaron toolchains en las VMs ni se reactivó Pages. Las fases 9–11 y el backlog requieren autorización nueva.
