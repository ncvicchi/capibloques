/** C++ shared by Arduino and ESP-IDF display adapters. Effects are cooperative. */
export function displayAnimationFirmwareSupport() {
  return `struct CapiDisplayAnimation {
  bool active = false;
  uint32_t token = 0;
  uint16_t step = 0;
  uint32_t nextAt = 0;
};
CapiDisplayAnimation capiDisplayAnimation;
void capiDisplayWriteCells(uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells) {
  if (column + columns > CAPI_DISPLAY_COLUMNS || row + rows > CAPI_DISPLAY_ROWS) return;
  for (uint16_t y = 0; y < rows; ++y) {
    char* destination = capiDisplayWanted + (row + y) * CAPI_DISPLAY_COLUMNS + column;
    if (cells) memcpy(destination, cells + y * columns, columns); else memset(destination, ' ', columns);
  }
}
void capiDisplayWrite(uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells) {
  capiDisplayAnimation.active = false;
  capiDisplayWriteCells(column, row, columns, rows, cells);
}
bool capiDisplayAnimationTurn(uint32_t token, uint16_t speedMs, uint32_t now) {
  if (!capiDisplayAnimation.active) {
    capiDisplayAnimation.active = true; capiDisplayAnimation.token = token;
    capiDisplayAnimation.step = 0; capiDisplayAnimation.nextAt = now;
  }
  if (capiDisplayAnimation.token != token || (int32_t)(now - capiDisplayAnimation.nextAt) < 0) return false;
  capiDisplayAnimation.nextAt = now + speedMs;
  return true;
}
bool capiDisplayAnimateText(uint32_t token, uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells, uint8_t effect, uint16_t speedMs, uint32_t now) {
  if (!capiDisplayAnimationTurn(token, speedMs, now)) return false;
  const uint16_t count = columns * rows;
  char frame[CAPI_DISPLAY_CELLS]; memset(frame, ' ', count);
  bool done = false;
  if (effect == 0) { // aparece en hasta 24 pasos
    const uint16_t chunk = (count + 23U) / 24U;
    const uint32_t reveal = (uint32_t)(capiDisplayAnimation.step + 1U) * chunk;
    const uint16_t visible = (uint16_t)(reveal < count ? reveal : count);
    memcpy(frame, cells, visible); done = visible >= count;
  } else if (effect == 1) { // entra desde la derecha
    const uint16_t offset = (uint16_t)((uint32_t)capiDisplayAnimation.step + 1U < columns ? (uint32_t)capiDisplayAnimation.step + 1U : columns);
    for (uint16_t y = 0; y < rows; ++y) for (uint16_t x = 0; x < columns; ++x) {
      const int source = (int)x - (int)(columns - offset);
      if (source >= 0) frame[y * columns + x] = cells[y * columns + (uint16_t)source];
    }
    done = offset >= columns;
  } else { // dos parpadeos y termina visible
    const bool visible = capiDisplayAnimation.step % 2U == 0;
    if (visible) memcpy(frame, cells, count);
    done = capiDisplayAnimation.step >= 4U;
  }
  capiDisplayWriteCells(column, row, columns, rows, frame);
  ++capiDisplayAnimation.step;
  if (done) capiDisplayAnimation.active = false;
  return done;
}
void capiDisplayArtworkFrame(const uint16_t* rows, int16_t shift, bool visible) {
  memset(capiDisplayWanted, ' ', CAPI_DISPLAY_CELLS);
  if (!visible) return;
  const int16_t baseX = (int16_t)(CAPI_DISPLAY_COLUMNS - 16) / 2 + shift;
  const int16_t baseY = (int16_t)(CAPI_DISPLAY_ROWS - 8) / 2;
  for (uint8_t y = 0; y < 8; ++y) for (uint8_t x = 0; x < 16; ++x) {
    const int16_t targetX = baseX + x, targetY = baseY + y;
    if (targetX >= 0 && targetX < CAPI_DISPLAY_COLUMNS && targetY >= 0 && targetY < CAPI_DISPLAY_ROWS && (rows[y] & (1U << (15 - x))))
      capiDisplayWanted[targetY * CAPI_DISPLAY_COLUMNS + targetX] = 0x7f;
  }
}
bool capiDisplayArtwork(uint32_t token, const uint16_t* rows, uint8_t effect, uint16_t speedMs, uint32_t now) {
  if (effect == 0) { capiDisplayAnimation.active = false; capiDisplayArtworkFrame(rows, 0, true); return true; }
  if (!capiDisplayAnimationTurn(token, speedMs, now)) return false;
  bool done = false;
  if (effect == 1) {
    const int remaining = 16 - (int)capiDisplayAnimation.step;
    const int16_t shift = (int16_t)(remaining > 0 ? remaining : 0);
    capiDisplayArtworkFrame(rows, shift, true); done = shift == 0;
  } else {
    capiDisplayArtworkFrame(rows, 0, capiDisplayAnimation.step % 2U == 0);
    done = capiDisplayAnimation.step >= 4U;
  }
  ++capiDisplayAnimation.step;
  if (done) capiDisplayAnimation.active = false;
  return done;
}`;
}
