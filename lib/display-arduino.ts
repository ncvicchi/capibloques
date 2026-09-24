// @ts-expect-error Node strip-types runner.
import { displayProfiles, validDisplayConfig } from './display-model.ts';
// @ts-expect-error Node strip-types runner.
import { displayAnimationFirmwareSupport } from './display-animation-firmware.ts';
// @ts-expect-error Node strip-types runners.
import { IDF_FONT } from './idf-font.ts';
import type { SceneDefinition } from './scene-model.ts';

function waveshareArduinoSupport() {
  return `// Waveshare ESP32-S3 Touch LCD 5 SKU 28117: RGB 800x480 + GT911.
#include <Wire.h>
extern "C" {
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_rgb.h"
#include "esp_rom_sys.h"
}
constexpr uint16_t CAPI_DISPLAY_COLUMNS = 50, CAPI_DISPLAY_ROWS = 30;
constexpr uint16_t CAPI_DISPLAY_CELLS = CAPI_DISPLAY_COLUMNS * CAPI_DISPLAY_ROWS;
constexpr uint8_t capiFont[] = { ${IDF_FONT.join(', ')} };
char capiDisplayWanted[CAPI_DISPLAY_CELLS], capiDisplaySent[CAPI_DISPLAY_CELLS];
bool capiDisplayReady = false, capiTouchDown = false;
uint16_t capiTouchX = 0, capiTouchY = 0;
esp_lcd_panel_handle_t capiScreen = nullptr;
uint8_t capiGlyphColumn(uint8_t character, uint8_t column) {
  if (character < 32 || character > 126) character = '?';
  return column < 5 ? capiFont[(character - 32) * 5 + column] : 0;
}
bool capiWsWrite(uint8_t address, uint8_t value) {
  Wire.beginTransmission(address); Wire.write(value); return Wire.endTransmission() == 0;
}
bool capiGtRead(uint16_t reg, uint8_t* data, size_t count) {
  Wire.beginTransmission(0x5d); Wire.write((uint8_t)(reg >> 8)); Wire.write((uint8_t)reg);
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom(0x5d, count) != count) return false;
  for (size_t i = 0; i < count; ++i) data[i] = Wire.read(); return true;
}
void capiTouchService() {
  static uint32_t last = 0; const uint32_t now = millis();
  if ((uint32_t)(now - last) < 16U) return; last = now;
  uint8_t status = 0; if (!capiGtRead(0x814e, &status, 1) || !(status & 0x80)) return;
  const uint8_t points = status & 0x0f; capiTouchDown = points > 0;
  if (points) { uint8_t point[4]; if (capiGtRead(0x8150, point, sizeof(point))) {
    capiTouchX = point[0] | ((uint16_t)point[1] << 8); capiTouchY = point[2] | ((uint16_t)point[3] << 8);
  }}
  Wire.beginTransmission(0x5d); Wire.write(0x81); Wire.write(0x4e); Wire.write(0); Wire.endTransmission();
}
bool capiDisplayGlyph(uint16_t x, uint16_t y, uint8_t character) {
  uint16_t pixels[16 * 16];
  for (int row = 0; row < 16; ++row) for (int column = 0; column < 16; ++column) {
    const bool on = character == 0x7f || ((capiGlyphColumn(character, column / 2) >> (row / 2)) & 1);
    pixels[row * 16 + column] = on ? 0xffff : 0x0000;
  }
  return esp_lcd_panel_draw_bitmap(capiScreen, x * 16, y * 16, x * 16 + 16, y * 16 + 16, pixels) == ESP_OK;
}
${displayAnimationFirmwareSupport()}
void capiDisplayBegin() {
  memset(capiDisplayWanted, ' ', CAPI_DISPLAY_CELLS); memset(capiDisplaySent, ' ', CAPI_DISPLAY_CELLS);
  if (!Wire.begin(8, 9, 400000)) return; Wire.setTimeOut(5);
  // Secuencia oficial CH422G/GT911: reset del touch, LCD y retroiluminación.
  if (!capiWsWrite(0x24, 0x01) || !capiWsWrite(0x38, 0x2c)) return;
  pinMode(4, OUTPUT); digitalWrite(4, LOW); esp_rom_delay_us(10000);
  if (!capiWsWrite(0x38, 0x2e)) return;
  pinMode(4, INPUT); esp_rom_delay_us(50000);
  if (!capiWsWrite(0x38, 0x1e)) return;
  esp_lcd_rgb_panel_config_t config = {};
  config.data_width = 16; config.bits_per_pixel = 16; config.num_fbs = 1;
  config.clk_src = LCD_CLK_SRC_DEFAULT; config.bounce_buffer_size_px = 800 * 10;
  config.sram_trans_align = 4; config.psram_trans_align = 64;
  config.hsync_gpio_num = 46; config.vsync_gpio_num = 3; config.de_gpio_num = 5; config.pclk_gpio_num = 7; config.disp_gpio_num = -1;
  const int dataPins[16] = {14,38,18,17,10,39,0,45,48,47,21,1,2,42,41,40};
  for (int i = 0; i < 16; ++i) config.data_gpio_nums[i] = dataPins[i];
  config.timings.pclk_hz = 16000000; config.timings.h_res = 800; config.timings.v_res = 480;
  config.timings.hsync_pulse_width = 4; config.timings.hsync_back_porch = 8; config.timings.hsync_front_porch = 8;
  config.timings.vsync_pulse_width = 4; config.timings.vsync_back_porch = 8; config.timings.vsync_front_porch = 8;
  config.timings.flags.pclk_active_neg = true; config.flags.fb_in_psram = true;
  if (esp_lcd_new_rgb_panel(&config, &capiScreen) != ESP_OK || esp_lcd_panel_reset(capiScreen) != ESP_OK || esp_lcd_panel_init(capiScreen) != ESP_OK) return;
  capiDisplayReady = true;
}
void capiDisplayService(uint32_t now) {
  capiTouchService(); capiDisplayAnimationService(now);
  static uint32_t last = 0; static uint16_t cursor = 0;
  if (!capiDisplayReady || (uint32_t)(now - last) < 2U) return; last = now;
  for (uint16_t scanned = 0; scanned < CAPI_DISPLAY_CELLS; ++scanned) {
    const uint16_t index = cursor; cursor = (cursor + 1) % CAPI_DISPLAY_CELLS;
    if (capiDisplaySent[index] == capiDisplayWanted[index]) continue;
    if (!capiDisplayGlyph(index % CAPI_DISPLAY_COLUMNS, index / CAPI_DISPLAY_COLUMNS, capiDisplayWanted[index])) { capiDisplayReady = false; return; }
    capiDisplaySent[index] = capiDisplayWanted[index]; return;
  }
}
`;
}

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
  if (device.config.profile === 'waveshare5') return waveshareArduinoSupport();
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
