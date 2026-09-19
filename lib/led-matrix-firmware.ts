// @ts-expect-error Node strip-types tests import the source extension.
import { MATRIX_FONT, normalizeMatrixText } from './led-matrix.ts';
import type { SceneDefinition } from './scene-model.ts';

const charLiteral = (value: string) => value === "'" ? "'\\''" : value === '\\' ? "'\\\\'" : `'${value}'`;

export function matrixFirmwareSupport(scene: SceneDefinition, native: boolean) {
  const device = scene.devices.find(device => device.kind === 'ledMatrix');
  if (!device || device.kind !== 'ledMatrix') return '';
  const write = native ? 'capiDigitalWrite' : 'digitalWrite';
  const level = (on: boolean) => native ? (on ? '1' : '0') : (on ? 'HIGH' : 'LOW');
  const fontCases = Object.entries(MATRIX_FONT).map(([character, columns]) =>
    `    case ${charLiteral(character)}: { static const uint8_t glyph[5] = { ${columns.join(', ')} }; return glyph[column]; }`,
  ).join('\n');
  return `// Matriz lógica 32x8: cuatro MAX7219 en cascada, sin bibliotecas externas.
constexpr uint8_t CAPI_MATRIX_DIN = ${device.pins.din ?? 255};
constexpr uint8_t CAPI_MATRIX_CLK = ${device.pins.clk ?? 255};
constexpr uint8_t CAPI_MATRIX_CS = ${device.pins.cs ?? 255};
constexpr bool CAPI_MATRIX_REVERSE = ${device.config.order === 'right-to-left' ? 'true' : 'false'};
constexpr bool CAPI_MATRIX_ROTATED = ${device.config.orientation === 'rotated' ? 'true' : 'false'};
uint32_t capiMatrixRows[8] = {};
struct CapiMatrixAnimation { bool active = false; const char* text = nullptr; uint16_t width = 0; uint16_t offset = 0; uint16_t speedMs = 0; uint16_t repeatsRemaining = 1; uint32_t nextAt = 0; };
CapiMatrixAnimation capiMatrixAnimation;
void capiMatrixFlush();
void capiMatrixClear();
void capiMatrixPattern(const uint32_t* rows);
void capiMatrixPixel(uint8_t x, uint8_t y, bool enabled);
void capiMatrixStartScroll(const char* text, uint16_t speedMs, uint16_t repeatCount, uint32_t now);
void capiMatrixService(uint32_t now);
bool capiMatrixAnimationActive();
void capiMatrixShift16(uint8_t address, uint8_t data) {
  for (int bit = 15; bit >= 0; --bit) {
    ${write}(CAPI_MATRIX_CLK, ${level(false)});
    ${write}(CAPI_MATRIX_DIN, ((uint16_t)address << 8 | data) & (1U << bit) ? ${level(true)} : ${level(false)});
    ${write}(CAPI_MATRIX_CLK, ${level(true)});
  }
}
void capiMatrixRegister(uint8_t address, uint8_t data) {
  ${write}(CAPI_MATRIX_CS, ${level(false)});
  for (uint8_t module = 0; module < 4; ++module) capiMatrixShift16(address, data);
  ${write}(CAPI_MATRIX_CS, ${level(true)});
}
uint8_t capiMatrixReverseByte(uint8_t value) {
  value = (uint8_t)((value & 0xF0) >> 4 | (value & 0x0F) << 4);
  value = (uint8_t)((value & 0xCC) >> 2 | (value & 0x33) << 2);
  return (uint8_t)((value & 0xAA) >> 1 | (value & 0x55) << 1);
}
void capiMatrixFlush() {
  for (uint8_t physicalRow = 0; physicalRow < 8; ++physicalRow) {
    ${write}(CAPI_MATRIX_CS, ${level(false)});
    for (int physicalModule = 3; physicalModule >= 0; --physicalModule) {
      uint8_t logicalModule = CAPI_MATRIX_REVERSE ? (uint8_t)(3 - physicalModule) : (uint8_t)physicalModule;
      if (CAPI_MATRIX_ROTATED) logicalModule = (uint8_t)(3 - logicalModule);
      const uint8_t logicalRow = CAPI_MATRIX_ROTATED ? (uint8_t)(7 - physicalRow) : physicalRow;
      uint8_t data = (uint8_t)(capiMatrixRows[logicalRow] >> ((3 - logicalModule) * 8));
      if (CAPI_MATRIX_ROTATED) data = capiMatrixReverseByte(data);
      capiMatrixShift16((uint8_t)(physicalRow + 1), data);
    }
    ${write}(CAPI_MATRIX_CS, ${level(true)});
  }
}
void capiMatrixCancel() { capiMatrixAnimation.active = false; }
void capiMatrixClear() { capiMatrixCancel(); memset(capiMatrixRows, 0, sizeof(capiMatrixRows)); capiMatrixFlush(); }
void capiMatrixPattern(const uint32_t* rows) { capiMatrixCancel(); memcpy(capiMatrixRows, rows, sizeof(capiMatrixRows)); capiMatrixFlush(); }
void capiMatrixPixel(uint8_t x, uint8_t y, bool enabled) {
  capiMatrixCancel(); if (x > 31 || y > 7) return; const uint32_t mask = 1UL << (31 - x);
  if (enabled) capiMatrixRows[y] |= mask; else capiMatrixRows[y] &= ~mask; capiMatrixFlush();
}
uint8_t capiMatrixGlyph(char character, uint8_t column) {
  if (column >= 5) return 0;
  switch (character) {
${fontCases}
    default: { static const uint8_t glyph[5] = { ${MATRIX_FONT['?'].join(', ')} }; return glyph[column]; }
  }
}
bool capiMatrixAnimationActive() { return capiMatrixAnimation.active; }
void capiMatrixStartScroll(const char* text, uint16_t speedMs, uint16_t repeatCount, uint32_t now) {
  capiMatrixAnimation.active = true; capiMatrixAnimation.text = text;
  capiMatrixAnimation.width = (uint16_t)(strlen(text) * 6U); capiMatrixAnimation.offset = 0;
  capiMatrixAnimation.nextAt = now; capiMatrixAnimation.speedMs = speedMs;
  capiMatrixAnimation.repeatsRemaining = repeatCount;
}
void capiMatrixService(uint32_t now) {
  if (!capiMatrixAnimation.active || (int32_t)(now - capiMatrixAnimation.nextAt) < 0) return;
  const char* text = capiMatrixAnimation.text;
  memset(capiMatrixRows, 0, sizeof(capiMatrixRows));
  for (uint8_t x = 0; x < 32; ++x) {
    const int source = (int)capiMatrixAnimation.offset + x - 32; uint8_t column = 0;
    if (source >= 0 && source < capiMatrixAnimation.width) column = capiMatrixGlyph(text[source / 6], (uint8_t)(source % 6));
    for (uint8_t y = 0; y < 7; ++y) if (column & (1U << y)) capiMatrixRows[y] |= 1UL << (31 - x);
  }
  capiMatrixFlush(); ++capiMatrixAnimation.offset; capiMatrixAnimation.nextAt = now + capiMatrixAnimation.speedMs;
  if (capiMatrixAnimation.offset > capiMatrixAnimation.width + 32U) {
    if (capiMatrixAnimation.repeatsRemaining == 1) capiMatrixAnimation.active = false;
    else {
      if (capiMatrixAnimation.repeatsRemaining > 1) --capiMatrixAnimation.repeatsRemaining;
      capiMatrixAnimation.offset = 0;
    }
  }
}
void capiMatrixBegin() {
  ${native ? 'capiOutput(CAPI_MATRIX_DIN); capiOutput(CAPI_MATRIX_CLK); capiOutput(CAPI_MATRIX_CS);' : 'pinMode(CAPI_MATRIX_DIN, OUTPUT); pinMode(CAPI_MATRIX_CLK, OUTPUT); pinMode(CAPI_MATRIX_CS, OUTPUT);'}
  ${write}(CAPI_MATRIX_CS, ${level(true)}); ${write}(CAPI_MATRIX_CLK, ${level(false)});
  capiMatrixRegister(0x0F, 0); capiMatrixRegister(0x0C, 1); capiMatrixRegister(0x0B, 7); capiMatrixRegister(0x09, 0);
  capiMatrixRegister(0x0A, ${device.config.brightness}); capiMatrixClear();
}`;
}

export function normalizedMatrixTextLiteral(text: string) {
  return normalizeMatrixText(text);
}
