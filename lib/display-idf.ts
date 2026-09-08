// @ts-expect-error Node strip-types runner.
import { displayProfiles, validDisplayConfig } from './display-model.ts';
// @ts-expect-error Node strip-types runner.
import { IDF_FONT } from './idf-font.ts';
import type { SceneDefinition } from './scene-model.ts';

/** Native, write-only text drivers; one display and no shared external bus. */
export function displayIdfSupport(scene: SceneDefinition) {
  const device = scene.devices.find(device => device.kind === 'display');
  if (!device || device.kind !== 'display' || !validDisplayConfig(device.config)) return '';
  const profile = displayProfiles[device.config.profile];
  const pin = (name: keyof typeof device.pins) => device.pins[name] ?? -1;
  const lcd = !profile.graphic;
  const i2c = profile.bus === 'i2c';
  const font = profile.graphic ? `// ASCII font: see licenses/Adafruit-GFX.txt in the exported project.
constexpr uint8_t capiFont[] = { ${IDF_FONT.join(', ')} };
uint8_t capiGlyphColumn(uint8_t character, uint8_t column) {
  if (character < 32 || character > 126) character = '?';
  return column < 5 ? capiFont[(character - 32) * 5 + column] : 0;
}
` : '';
  const bus = i2c ? `#include "driver/i2c_master.h"
i2c_master_bus_handle_t capiDisplayBus = nullptr;
i2c_master_dev_handle_t capiDisplayDevice = nullptr;
bool capiDisplayTransfer(const uint8_t* data, size_t count) {
  return i2c_master_transmit(capiDisplayDevice, data, count, 5) == ESP_OK;
}
bool capiDisplayBusBegin() {
  i2c_master_bus_config_t bus = {}; bus.i2c_port = I2C_NUM_0;
  bus.sda_io_num = (gpio_num_t)${pin('sda')}; bus.scl_io_num = (gpio_num_t)${pin('scl')};
  bus.clk_source = I2C_CLK_SRC_DEFAULT; bus.glitch_ignore_cnt = 7; bus.flags.enable_internal_pullup = true;
  if (i2c_new_master_bus(&bus, &capiDisplayBus) != ESP_OK) return false;
  if (i2c_master_probe(capiDisplayBus, ${device.config.address}, 5) != ESP_OK) return false;
  i2c_device_config_t config = {}; config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
  config.device_address = ${device.config.address}; config.scl_speed_hz = 100000;
  return i2c_master_bus_add_device(capiDisplayBus, &config, &capiDisplayDevice) == ESP_OK;
}
` : `#include "driver/spi_master.h"
spi_device_handle_t capiDisplayDevice = nullptr;
// Persistent descriptor/buffer remain alive even if the driver times out.
spi_transaction_t capiDisplayTransaction = {};
alignas(4) uint8_t capiDisplayTransferBytes[1536];
bool capiDisplayBusHealthy = true;
bool capiDisplayTransfer(bool data, const uint8_t* bytes, size_t count) {
  if (!capiDisplayBusHealthy || count > sizeof(capiDisplayTransferBytes)) return false;
  memcpy(capiDisplayTransferBytes, bytes, count);
  capiDigitalWrite(${pin('dc')}, data);
  capiDisplayTransaction = {}; capiDisplayTransaction.length = count * 8; capiDisplayTransaction.tx_buffer = capiDisplayTransferBytes;
  spi_transaction_t* finished = nullptr;
  capiDisplayBusHealthy = spi_device_queue_trans(capiDisplayDevice, &capiDisplayTransaction, pdMS_TO_TICKS(20)) == ESP_OK
    && spi_device_get_trans_result(capiDisplayDevice, &finished, pdMS_TO_TICKS(20)) == ESP_OK
    && finished == &capiDisplayTransaction;
  return capiDisplayBusHealthy;
}
bool capiDisplayCommand(uint8_t command, const uint8_t* data = nullptr, size_t count = 0) {
  return capiDisplayTransfer(false, &command, 1) && (!count || capiDisplayTransfer(true, data, count));
}
bool capiDisplayWindow(uint16_t x, uint16_t y, uint16_t width, uint16_t height) {
  const uint16_t right = x + width - 1, bottom = y + height - 1;
  const uint8_t columns[] = {(uint8_t)(x >> 8), (uint8_t)x, (uint8_t)(right >> 8), (uint8_t)right};
  const uint8_t rows[] = {(uint8_t)(y >> 8), (uint8_t)y, (uint8_t)(bottom >> 8), (uint8_t)bottom};
  return capiDisplayCommand(0x2a, columns, sizeof(columns)) && capiDisplayCommand(0x2b, rows, sizeof(rows)) && capiDisplayCommand(0x2c);
}
bool capiDisplayBusBegin() {
  spi_bus_config_t bus = {}; bus.mosi_io_num = ${pin('mosi')}; bus.miso_io_num = -1; bus.sclk_io_num = ${pin('sck')};
  bus.quadwp_io_num = -1; bus.quadhd_io_num = -1; bus.max_transfer_sz = sizeof(capiDisplayTransferBytes);
  if (spi_bus_initialize(SPI3_HOST, &bus, SPI_DMA_CH_AUTO) != ESP_OK) return false;
  spi_device_interface_config_t device = {}; device.clock_speed_hz = 8000000;
  device.spics_io_num = ${pin('cs')}; device.queue_size = 1; device.mode = 0;
  if (spi_bus_add_device(SPI3_HOST, &device, &capiDisplayDevice) != ESP_OK) return false;
  capiOutput(${pin('dc')}); capiOutput(${pin('rst')});
  capiDigitalWrite(${pin('rst')}, 0); vTaskDelay(pdMS_TO_TICKS(20));
  capiDigitalWrite(${pin('rst')}, 1); vTaskDelay(pdMS_TO_TICKS(150));
  return true; // SPI cannot detect whether a physical display is present.
}
`;
  const driver = lcd ? `
bool capiLcdNibble(uint8_t value) {
  const uint8_t data[] = {(uint8_t)(value | 8), (uint8_t)(value | 12), (uint8_t)(value | 8)};
  return capiDisplayTransfer(data, sizeof(data));
}
bool capiLcdByte(uint8_t value, bool character = false) {
  const uint8_t high = (value & 0xf0) | (character ? 1 : 0) | 8;
  const uint8_t low = ((value << 4) & 0xf0) | (character ? 1 : 0) | 8;
  const uint8_t data[] = {high, (uint8_t)(high | 4), high, low, (uint8_t)(low | 4), low};
  return capiDisplayTransfer(data, sizeof(data));
}
bool capiDisplayDeviceBegin() {
  if (!capiDisplayBusBegin()) return false;
  vTaskDelay(pdMS_TO_TICKS(50));
  for (int i = 0; i < 3; ++i) { if (!capiLcdNibble(0x30)) return false; vTaskDelay(pdMS_TO_TICKS(5)); }
  if (!capiLcdNibble(0x20) || !capiLcdByte(0x28) || !capiLcdByte(0x08) || !capiLcdByte(0x01)) return false;
  vTaskDelay(pdMS_TO_TICKS(3));
  return capiLcdByte(0x06) && capiLcdByte(0x0c);
}
bool capiDisplayGlyph(uint16_t x, uint16_t y, uint8_t character) {
  constexpr uint8_t rowOffsets[] = {0, 0x40, 0x14, 0x54};
  return capiLcdByte(0x80 | (rowOffsets[y] + x)) && capiLcdByte(character, true);
}
` : i2c ? `
bool capiOledPosition(uint16_t column, uint16_t page) {
  const uint8_t commands[] = {0x00, (uint8_t)(0xb0 | page), (uint8_t)(column & 15), (uint8_t)(0x10 | (column >> 4))};
  return capiDisplayTransfer(commands, sizeof(commands));
}
bool capiDisplayDeviceBegin() {
  if (!capiDisplayBusBegin()) return false;
  // SSD1306 128x64, internal charge pump, page addressing, normal display.
  const uint8_t init[] = {0x00, 0xae, 0xd5, 0x80, 0xa8, 0x3f, 0xd3, 0, 0x40, 0x8d, 0x14, 0x20, 0x02, 0xa1, 0xc8, 0xda, 0x12, 0x81, 0x7f, 0xd9, 0xf1, 0xdb, 0x40, 0xa4, 0xa6};
  if (!capiDisplayTransfer(init, sizeof(init))) return false;
  uint8_t blank[17] = {0x40};
  for (int page = 0; page < 8; ++page) for (int column = 0; column < 128; column += 16)
    if (!capiOledPosition(column, page) || !capiDisplayTransfer(blank, sizeof(blank))) return false;
  const uint8_t on[] = {0x00, 0xaf}; return capiDisplayTransfer(on, sizeof(on));
}
bool capiDisplayGlyph(uint16_t x, uint16_t y, uint8_t character) {
  uint8_t data[9] = {0x40};
  for (int column = 0; column < 5; ++column) data[column + 2] = capiGlyphColumn(character, column);
  return capiOledPosition(x * 8, y) && capiDisplayTransfer(data, sizeof(data));
}
` : `
constexpr int CAPI_PIXEL_BYTES = ${device.config.profile === 'ili9488' ? 3 : 2};
bool capiDisplayDeviceBegin() {
  if (!capiDisplayBusBegin()) return false;
  if (!capiDisplayCommand(0x01)) return false; vTaskDelay(pdMS_TO_TICKS(150));
  const uint8_t format = ${device.config.profile === 'ili9488' ? '0x66' : '0x55'}, rotation = 0x28;
  if (!capiDisplayCommand(0x3a, &format, 1) || !capiDisplayCommand(0x36, &rotation, 1)
    || !capiDisplayCommand(0x20) || !capiDisplayCommand(0x13) || !capiDisplayCommand(0x11)) return false;
  vTaskDelay(pdMS_TO_TICKS(150));
  uint8_t blank[${profile.width} * CAPI_PIXEL_BYTES] = {};
  for (int row = 0; row < ${profile.height}; ++row)
    if (!capiDisplayWindow(0, row, ${profile.width}, 1) || !capiDisplayTransfer(true, blank, sizeof(blank))) return false;
  return capiDisplayCommand(0x29);
}
bool capiDisplayGlyph(uint16_t x, uint16_t y, uint8_t character) {
  uint8_t pixels[12 * 16 * CAPI_PIXEL_BYTES];
  for (int row = 0; row < 16; ++row) for (int column = 0; column < 12; ++column) {
    const bool on = (capiGlyphColumn(character, column / 2) >> (row / 2)) & 1;
    for (int byte = 0; byte < CAPI_PIXEL_BYTES; ++byte) pixels[(row * 12 + column) * CAPI_PIXEL_BYTES + byte] = on ? 0xff : 0;
  }
  return capiDisplayWindow(x * 12, y * 16, 12, 16) && capiDisplayTransfer(true, pixels, sizeof(pixels));
}
`;
  return `${bus}${font}${driver}
constexpr uint16_t CAPI_DISPLAY_COLUMNS = ${profile.columns}, CAPI_DISPLAY_ROWS = ${profile.rows};
constexpr uint16_t CAPI_DISPLAY_CELLS = CAPI_DISPLAY_COLUMNS * CAPI_DISPLAY_ROWS;
char capiDisplayWanted[CAPI_DISPLAY_CELLS], capiDisplaySent[CAPI_DISPLAY_CELLS];
bool capiDisplayReady = false;
void capiDisplayWrite(uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells) {
  if (column + columns > CAPI_DISPLAY_COLUMNS || row + rows > CAPI_DISPLAY_ROWS) return;
  for (uint16_t y = 0; y < rows; ++y) {
    char* destination = capiDisplayWanted + (row + y) * CAPI_DISPLAY_COLUMNS + column;
    if (cells) memcpy(destination, cells + y * columns, columns); else memset(destination, ' ', columns);
  }
}
void capiDisplayBegin() {
  memset(capiDisplayWanted, ' ', CAPI_DISPLAY_CELLS); memset(capiDisplaySent, ' ', CAPI_DISPLAY_CELLS);
  capiDisplayReady = capiDisplayDeviceBegin();
  if (!capiDisplayReady) capiPrintln("[Pantalla] No disponible; revisar cables/modelo y reiniciar. El programa continua.");
}
void capiDisplayService(uint32_t now) {
  static uint32_t last = 0; static uint16_t cursor = 0;
  if (!capiDisplayReady || (uint32_t)(now - last) < 2U) return;
  last = now;
  for (uint16_t scanned = 0; scanned < CAPI_DISPLAY_CELLS; ++scanned) {
    const uint16_t index = cursor; cursor = (cursor + 1) % CAPI_DISPLAY_CELLS;
    if (capiDisplaySent[index] == capiDisplayWanted[index]) continue;
    if (!capiDisplayGlyph(index % CAPI_DISPLAY_COLUMNS, index / CAPI_DISPLAY_COLUMNS, capiDisplayWanted[index])) {
      capiDisplayReady = false; capiPrintln("[Pantalla] Error de bus. Pantalla desactivada; revisar y reiniciar."); return;
    }
    capiDisplaySent[index] = capiDisplayWanted[index]; return;
  }
}
`;
}
