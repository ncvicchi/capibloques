// @ts-expect-error Node strip-types runner.
import { displayProfiles, validDisplayConfig } from './display-model.ts';
// @ts-expect-error Node strip-types runner.
import { displayAnimationFirmwareSupport } from './display-animation-firmware.ts';
import type { SceneDefinition } from './scene-model.ts';

/** Only one physical adapter. Blocks update a bounded text buffer, never a draw queue. */
export function displayArduinoSupport(scene: SceneDefinition) {
  const device = scene.devices.find((device) => device.kind === 'display');
  if (
    !device ||
    device.kind !== 'display' ||
    !validDisplayConfig(device.config)
  )
    return '';
  const profile = displayProfiles[device.config.profile];
  const pin = (key: keyof typeof device.pins) => device.pins[key] ?? -1;
  const lcd = !profile.graphic;
  const i2c = profile.bus === 'i2c';
  const parallel = profile.bus === 'parallel';
  const driver = parallel
    ? `// Pantalla HD44780 16x2 y teclado resistivo de cinco botones.
#include <LiquidCrystal.h>
LiquidCrystal capiScreen(${pin('rs')}, ${pin('en')}, ${pin('d4')}, ${pin('d5')}, ${pin('d6')}, ${pin('d7')});`
    : lcd
    ? `// Instalar LiquidCrystal_PCF8574@2.3.0 (BSD). Backpack PCF8574 estándar.
#include <Wire.h>
#include <LiquidCrystal_PCF8574.h>
LiquidCrystal_PCF8574 capiScreen(${device.config.address});`
    : i2c
      ? `// Instalar U8g2@2.36.19 (BSD-2-Clause). Fuente ASCII 8x8, sin framebuffer completo.
#include <Wire.h>
#include <U8x8lib.h>
U8X8_SSD1306_128X64_NONAME_HW_I2C capiScreen(U8X8_PIN_NONE, ${pin('scl')}, ${pin('sda')});`
      : `// Instalar GFX Library for Arduino@1.6.7. SPI escritura, sin MISO ni touch.
#include <Arduino_GFX_Library.h>
Arduino_ESP32SPI capiScreenBus(${pin('dc')}, ${pin('cs')}, ${pin('sck')}, ${pin('mosi')}, GFX_NOT_DEFINED, VSPI, false);
${device.config.profile === 'ili9488' ? 'Arduino_ILI9488_18bit' : 'Arduino_ILI9341'} capiScreen(&capiScreenBus, ${pin('rst')}, 1, false);`;
  const probe = i2c
    ? `bool capiDisplayResponds() {
  Wire.beginTransmission(${device.config.address});
  return Wire.endTransmission() == 0;
}`
    : '';
  const init = parallel
    ? `  pinMode(${pin('backlight')}, OUTPUT);
  digitalWrite(${pin('backlight')}, HIGH);
  pinMode(${pin('keys')}, INPUT);
  analogSetPinAttenuation(${pin('keys')}, ADC_11db);
  capiScreen.begin(${profile.columns}, ${profile.rows});
  capiScreen.clear();
  capiDisplayReady = true;`
    : i2c
    ? `  if (!Wire.begin(${pin('sda')}, ${pin('scl')}, 100000)) return;
  Wire.setTimeOut(2);
  if (!capiDisplayResponds()) { Serial.println("[Pantalla] Sin respuesta I2C. El programa continua; revisar cables y reiniciar."); return; }
${
  lcd
    ? `  capiScreen.begin(${profile.columns}, ${profile.rows}, Wire);
  capiScreen.setBacklight(255);
  capiScreen.clear();`
    : `  capiScreen.setI2CAddress(${device.config.address * 2});
  capiScreen.setBusClock(100000);
  capiScreen.begin();
  capiScreen.setFont(u8x8_font_chroma48medium8_r);
  capiScreen.clearDisplay();`
}
  Wire.setTimeOut(2);
  capiDisplayReady = capiDisplayResponds();`
    : `  capiDisplayReady = capiScreen.begin(8000000);
  // SPI de escritura no permite detectar si hay una pantalla conectada.
  if (capiDisplayReady) { capiScreen.fillScreen(0x0000); capiScreen.setTextSize(2); capiScreen.setTextWrap(false); }`;
  return `${driver}
#include <string.h>
constexpr uint16_t CAPI_DISPLAY_COLUMNS = ${profile.columns};
constexpr uint16_t CAPI_DISPLAY_ROWS = ${profile.rows};
constexpr uint16_t CAPI_DISPLAY_CELLS = CAPI_DISPLAY_COLUMNS * CAPI_DISPLAY_ROWS;
char capiDisplayWanted[CAPI_DISPLAY_CELLS];
char capiDisplaySent[CAPI_DISPLAY_CELLS];
bool capiDisplayReady = false;
${probe}
${parallel ? `uint8_t capiDisplayButton() {
  const int value = analogRead(${pin('keys')});
  if (value < 200) return 0;   // Derecha
  if (value < 1000) return 1;  // Arriba
  if (value < 1800) return 2;  // Abajo
  if (value < 2600) return 3;  // Izquierda
  if (value < 3400) return 4;  // Elegir
  return 255;
}
bool capiDisplayButtonPressed(uint8_t button) { return capiDisplayButton() == button; }
` : ''}
${displayAnimationFirmwareSupport()}
void capiDisplayBegin() {
  memset(capiDisplayWanted, ' ', CAPI_DISPLAY_CELLS);
  memset(capiDisplaySent, ' ', CAPI_DISPLAY_CELLS);
  // La inicialización finita del controlador ocurre antes de iniciar los bloques.
${init}
}
void capiDisplayService(uint32_t now) {
  capiDisplayAnimationService(now);
  static uint32_t last = 0;
  static uint16_t cursor = 0;
  if (!capiDisplayReady || (uint32_t)(now - last) < 2U) return;
  last = now;
  // Como máximo un carácter por servicio. Mensajes sucesivos conservan el último estado.
  for (uint16_t scanned = 0; scanned < CAPI_DISPLAY_CELLS; ++scanned) {
    const uint16_t index = cursor;
    cursor = (cursor + 1) % CAPI_DISPLAY_CELLS;
    if (capiDisplaySent[index] == capiDisplayWanted[index]) continue;
${
  i2c
    ? `    if (!capiDisplayResponds()) {
      capiDisplayReady = false;
      Serial.println("[Pantalla] Fallo I2C: pantalla desactivada; el programa continua. Revisar y reiniciar.");
      return;
    }`
    : ''
}
    const uint16_t x = index % CAPI_DISPLAY_COLUMNS, y = index / CAPI_DISPLAY_COLUMNS;
    const char character = capiDisplayWanted[index];
${
  lcd
    ? `    capiScreen.setCursor(x, y);
    capiScreen.write((uint8_t)character);`
    : i2c
      ? `    if ((uint8_t)character == 0x7f) { uint8_t tile[8]; memset(tile, 0xff, sizeof(tile)); capiScreen.drawTile(x, y, 1, tile); }
    else capiScreen.drawGlyph(x, y, (uint8_t)character);`
      : `    if ((uint8_t)character == 0x7f) capiScreen.fillRect(x * 12, y * 16, 12, 16, 0xFFFF);
    else capiScreen.drawChar(x * 12, y * 16, (uint8_t)character, 0xFFFF, 0x0000);`
}
    capiDisplaySent[index] = character;
    return;
  }
}
`;
}
