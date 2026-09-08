import type { CodeGenerationResult } from './capiblocks.ts';
// @ts-expect-error Node strip-types runner.
import { IDF_VERSION, IDF_IMAGE } from './idf-runtime.ts';
// @ts-expect-error Node strip-types runner.
import { IDF_FONT_LICENSE, IDF_FONT_SOURCE } from './idf-font.ts';

export type FirmwareFiles = Record<string, string>;
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();

export function espIdfProjectFiles(generated: CodeGenerationResult): FirmwareFiles {
  if (generated.framework !== 'esp-idf' || generated.diagnostics.some(issue => issue.severity === 'error'))
    throw new Error('Corregí el programa y las conexiones antes de exportar ESP-IDF.');
  return {
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
set(SUPPORTED_TARGETS esp32)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(capibloques)
`,
    'main/CMakeLists.txt': `idf_component_register(SRCS "main.cpp" INCLUDE_DIRS "."
  PRIV_REQUIRES esp_driver_gpio esp_driver_ledc esp_driver_i2c esp_driver_spi
  esp_adc esp_timer esp_wifi esp_event esp_netif nvs_flash freertos)
target_compile_features(\${COMPONENT_LIB} PRIVATE cxx_std_17)
`,
    'main/main.cpp': generated.code,
    'main/wifi_config.example.h': `#pragma once
// Copiar como wifi_config.h y editar SOLO en tu PC. No subir credenciales a Git.
#define CAPI_WIFI_SSID "TU_RED"
#define CAPI_WIFI_PASSWORD "TU_CLAVE"
`,
    'sdkconfig.defaults': `CONFIG_ESPTOOLPY_FLASHSIZE_4MB=y
CONFIG_ESPTOOLPY_FLASHMODE_DIO=y
CONFIG_ESPTOOLPY_FLASHFREQ_40M=y
CONFIG_PARTITION_TABLE_SINGLE_APP_LARGE=y
CONFIG_FREERTOS_HZ=1000
CONFIG_ESP_MAIN_TASK_STACK_SIZE=8192
CONFIG_ESP_CONSOLE_UART_DEFAULT=y
CONFIG_ESP_CONSOLE_UART_BAUDRATE=115200
CONFIG_COMPILER_OPTIMIZATION_SIZE=y
CONFIG_APP_REPRODUCIBLE_BUILD=y
`,
    '.gitignore': '/build/\n/sdkconfig\n/sdkconfig.old\n/main/wifi_config.h\n',
    'licenses/Adafruit-GFX.txt': `${IDF_FONT_LICENSE}\nFont source: ${IDF_FONT_SOURCE}\nSubset: ASCII 32..126, no Arduino/GFX executable code is included.\n`,
    'README.md': `# CapiBloques — proyecto ESP-IDF

Wemos D1 R32, chip ESP32, flash 4 MiB. Requiere **ESP-IDF ${IDF_VERSION}**.
Este ZIP contiene fuentes, no un binario. No depende de Arduino ni de bibliotecas externas.

## Compilar localmente

Instalar la versión indicada desde las herramientas oficiales de Espressif y abrir su terminal.
En esta carpeta: \`idf.py set-target esp32\`, luego \`idf.py build\`.
El programa rechaza otro chip o versión de ESP-IDF. No usar el perfil ESP32-S3.
Alternativa para compilación reproducible con Docker: imagen \`${IDF_IMAGE}\`.
El volumen del proyecto debe contener estas fuentes; configurar la variable de entorno \`IDF_PY_BUILD_JOBS=2\` y ejecutar \`idf.py build\` dentro del contenedor.

## Conectar y programar

Revisar con una persona adulta la guía de conexiones de CapiBloques y el módulo real.
No aplicar 5 V a los GPIO. Motores y servos requieren alimentación/etapa apropiadas y parada física.
Para programar con las herramientas ESP-IDF: \`idf.py -p PUERTO flash monitor\`.
Usar la salida completa de la herramienta: no asumir que main.bin solo alcanza ni copiar direcciones de flash de otro proyecto.
Salir del monitor con Ctrl+]. La placa sigue ejecutándose sin el navegador.

## Wi-Fi

Si hay bloques Wi-Fi, copiar \`main/wifi_config.example.h\` a \`main/wifi_config.h\` y editar SSID/clave localmente.
Sin ese archivo se compilan marcadores TU_RED/TU_CLAVE, no credenciales reales. No compartir fuentes/binarios después de agregar una contraseña: el firmware la contiene.
La configuración de la radio se mantiene en RAM; el programa no borra NVS para recuperar fallos.
No se proveen credenciales desde la web en esta fase. No hay OTA ni control remoto de actuadores.

## Comportamiento y límites

Mismo grafo cooperativo que Arduino y el simulador: bucles, condiciones y fork/join, con quantum lógico de 16 ms.
Los caminos del alumno no son tareas FreeRTOS separadas. Esperar no bloquea a los otros caminos.
La consola UART0 a 115200 usa una cola de 32 mensajes constantes y una tarea de salida. Si se llena, espera sólo el camino que intenta escribir, sin perder mensajes ni acumular memoria sin límite.
GPIO/ADC/PWM son APIs nativas; ADC conserva escala cruda 0..4095 (no mide voltios calibrados).
Los pulsos de servo conservan 500..2500 us a 50 Hz; comprobar los límites mecánicos reales antes de conectar.
Un fallo de configuración de GPIO/PWM detiene/reinicia por ESP_ERROR_CHECK; no es un paro de emergencia garantizado.
Wi-Fi comparte una radio entre todos los caminos. Una espera de conexión termina por conexión o timeout; el hardware/red no se emula con tiempos exactos.

Pantallas: una por proyecto. LCD PCF8574 16x2/20x4; SSD1306 I2C; ILI9341/ILI9488 SPI, horizontales, sin touch/MISO/SD.
Se conserva el contenido por celdas y zonas del simulador; los glifos OLED pueden diferir en forma respecto de U8x8, no en caracteres/posiciones.
I2C usa transacciones de hasta 5 ms; SPI usa cola y espera de resultado acotadas a 20 ms cada una. Ante error se desactiva el display hasta reiniciar; los demás caminos siguen.
El descriptor y buffer SPI permanecen vivos tras un timeout para no reutilizar memoria aún en vuelo. No se agregan reintentos ilimitados.
Refresco máximo de un carácter cada 2 ms; se conserva el último estado pedido, no todos los estados intermedios. Inicialización/limpieza finitas antes de comenzar.
SPI de escritura no detecta la presencia de la pantalla. Compilar y simular no reemplazan la prueba física del modelo, niveles, fuente y cableado.

\`manifest.json\` identifica versiones y SHA-256 de estas fuentes/configuración. No es un manifiesto de binarios ni contiene direcciones de grabación.
\`licenses/\` contiene la licencia de la fuente de texto. Mantenerla al redistribuir.
`,
  };
}

export async function sha256(bytes: Uint8Array) {
  const result = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Deterministic UTF-8 ZIP, stored entries, fixed DOS date, no path supplied by a project. */
export function zipFirmwareFiles(files: FirmwareFiles): Uint8Array {
  const entries = Object.keys(files).sort().map(path => {
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Ruta de archivo no permitida.');
    const name = encoder.encode(`capibloques/${path}`), data = encoder.encode(files[path]);
    return { name, data, crc: crc32(data), offset: 0 };
  });
  if (!entries.length || entries.length > 64) throw new Error('Cantidad de archivos no permitida.');
  const size = entries.reduce((total, entry) => total + 76 + 2 * entry.name.length + entry.data.length, 22);
  if (size > MAX_ARCHIVE_BYTES) throw new Error('El proyecto generado supera el límite de 16 MiB.');
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  let offset = 0;
  const u16 = (position: number, value: number) => view.setUint16(position, value, true);
  const u32 = (position: number, value: number) => view.setUint32(position, value, true);
  for (const entry of entries) {
    entry.offset = offset;
    u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x0800); u16(offset + 12, 33);
    u32(offset + 14, entry.crc); u32(offset + 18, entry.data.length); u32(offset + 22, entry.data.length); u16(offset + 26, entry.name.length);
    bytes.set(entry.name, offset + 30); bytes.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
  }
  const central = offset;
  for (const entry of entries) {
    u32(offset, 0x02014b50); u16(offset + 4, 20); u16(offset + 6, 20); u16(offset + 8, 0x0800); u16(offset + 14, 33);
    u32(offset + 16, entry.crc); u32(offset + 20, entry.data.length); u32(offset + 24, entry.data.length);
    u16(offset + 28, entry.name.length); u32(offset + 42, entry.offset); bytes.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  }
  u32(offset, 0x06054b50); u16(offset + 8, entries.length); u16(offset + 10, entries.length);
  u32(offset + 12, offset - central); u32(offset + 16, central);
  return bytes;
}

export async function createEspIdfArchive(generated: CodeGenerationResult) {
  const files = espIdfProjectFiles(generated);
  const hashes: Record<string, string> = {};
  for (const path of Object.keys(files).sort()) hashes[path] = await sha256(encoder.encode(files[path]));
  files['manifest.json'] = JSON.stringify({ format: 'CapiBloquesSources', version: 1, generator: '8.1', framework: 'esp-idf', frameworkVersion: IDF_VERSION, buildImage: IDF_IMAGE, chip: 'esp32', board: 'wemos-d1-r32', sources: hashes }, null, 2) + '\n';
  return zipFirmwareFiles(files);
}

export function downloadFirmwareArchive(filename: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
