/** C++ shared by Arduino and ESP-IDF display adapters. Effects run in background. */
export function displayAnimationFirmwareSupport() {
  return `struct CapiDisplayAnimation {
  bool active = false;
  uint8_t kind = 0;
  uint8_t effect = 0;
  uint16_t step = 0;
  uint16_t speedMs = 0;
  uint16_t repeatsRemaining = 1;
  uint32_t nextAt = 0;
  uint16_t column = 0, row = 0, columns = 0, rows = 0;
  const char* cells = nullptr;
  const uint16_t* artwork = nullptr;
};
CapiDisplayAnimation capiDisplayAnimation;
void capiDisplayCancelAnimation() { capiDisplayAnimation.active = false; }
bool capiDisplayAnimationActive() { return capiDisplayAnimation.active; }
void capiDisplayWriteCells(uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells) {
  if (column + columns > CAPI_DISPLAY_COLUMNS || row + rows > CAPI_DISPLAY_ROWS) return;
  for (uint16_t y = 0; y < rows; ++y) {
    char* destination = capiDisplayWanted + (row + y) * CAPI_DISPLAY_COLUMNS + column;
    if (cells) memcpy(destination, cells + y * columns, columns); else memset(destination, ' ', columns);
  }
}
void capiDisplayWrite(uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells) {
  capiDisplayCancelAnimation();
  capiDisplayWriteCells(column, row, columns, rows, cells);
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
void capiDisplayStartText(uint16_t column, uint16_t row, uint16_t columns, uint16_t rows, const char* cells, uint8_t effect, uint16_t speedMs, uint16_t repeatCount, uint32_t now) {
  capiDisplayAnimation = {};
  capiDisplayAnimation.active = true; capiDisplayAnimation.kind = 1; capiDisplayAnimation.effect = effect;
  capiDisplayAnimation.speedMs = speedMs; capiDisplayAnimation.nextAt = now;
  capiDisplayAnimation.repeatsRemaining = repeatCount;
  capiDisplayAnimation.column = column; capiDisplayAnimation.row = row;
  capiDisplayAnimation.columns = columns; capiDisplayAnimation.rows = rows; capiDisplayAnimation.cells = cells;
}
void capiDisplayStartArtwork(const uint16_t* rows, uint8_t effect, uint16_t speedMs, uint16_t repeatCount, uint32_t now) {
  capiDisplayCancelAnimation();
  if (effect == 0) { capiDisplayArtworkFrame(rows, 0, true); return; }
  capiDisplayAnimation = {};
  capiDisplayAnimation.active = true; capiDisplayAnimation.kind = 2; capiDisplayAnimation.effect = effect;
  capiDisplayAnimation.speedMs = speedMs; capiDisplayAnimation.nextAt = now; capiDisplayAnimation.artwork = rows;
  capiDisplayAnimation.repeatsRemaining = repeatCount;
}
void capiDisplayAnimationService(uint32_t now) {
  if (!capiDisplayAnimation.active || (int32_t)(now - capiDisplayAnimation.nextAt) < 0) return;
  capiDisplayAnimation.nextAt = now + capiDisplayAnimation.speedMs;
  bool done = false;
  if (capiDisplayAnimation.kind == 1) {
    const uint16_t count = capiDisplayAnimation.columns * capiDisplayAnimation.rows;
    char frame[CAPI_DISPLAY_CELLS]; memset(frame, ' ', count);
    if (capiDisplayAnimation.effect == 0) {
      const uint16_t chunk = (count + 23U) / 24U;
      const uint32_t reveal = (uint32_t)(capiDisplayAnimation.step + 1U) * chunk;
      const uint16_t visible = (uint16_t)(reveal < count ? reveal : count);
      memcpy(frame, capiDisplayAnimation.cells, visible); done = visible >= count;
    } else if (capiDisplayAnimation.effect == 1) {
      const uint16_t offset = (uint16_t)((uint32_t)capiDisplayAnimation.step + 1U < capiDisplayAnimation.columns ? (uint32_t)capiDisplayAnimation.step + 1U : capiDisplayAnimation.columns);
      for (uint16_t y = 0; y < capiDisplayAnimation.rows; ++y) for (uint16_t x = 0; x < capiDisplayAnimation.columns; ++x) {
        const int source = (int)x - (int)(capiDisplayAnimation.columns - offset);
        if (source >= 0) frame[y * capiDisplayAnimation.columns + x] = capiDisplayAnimation.cells[y * capiDisplayAnimation.columns + (uint16_t)source];
      }
      done = offset >= capiDisplayAnimation.columns;
    } else {
      if (capiDisplayAnimation.step % 2U == 0) memcpy(frame, capiDisplayAnimation.cells, count);
      done = capiDisplayAnimation.step >= 4U;
    }
    capiDisplayWriteCells(capiDisplayAnimation.column, capiDisplayAnimation.row, capiDisplayAnimation.columns, capiDisplayAnimation.rows, frame);
  } else if (capiDisplayAnimation.kind == 2) {
    if (capiDisplayAnimation.effect == 1) {
      const int remaining = 16 - (int)capiDisplayAnimation.step;
      const int16_t shift = (int16_t)(remaining > 0 ? remaining : 0);
      capiDisplayArtworkFrame(capiDisplayAnimation.artwork, shift, true); done = shift == 0;
    } else {
      capiDisplayArtworkFrame(capiDisplayAnimation.artwork, 0, capiDisplayAnimation.step % 2U == 0);
      done = capiDisplayAnimation.step >= 4U;
    }
  }
  ++capiDisplayAnimation.step;
  if (done) {
    if (capiDisplayAnimation.repeatsRemaining == 1) capiDisplayAnimation.active = false;
    else {
      if (capiDisplayAnimation.repeatsRemaining > 1) --capiDisplayAnimation.repeatsRemaining;
      capiDisplayAnimation.step = 0;
    }
  }
}`;
}
