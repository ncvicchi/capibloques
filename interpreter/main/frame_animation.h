#pragma once
#include <cstdint>
#include <cstring>

struct FrameAnimationPlayback {
  uint32_t frames[16][8] = {};
  uint16_t count = 0, frame_ms = 200, repeats = 1;
  uint32_t started_at = 0;
  bool render(uint32_t now, uint32_t (&rows)[8]) const {
    if (!count || !frame_ms) return false;
    const uint32_t step = (now - started_at) / frame_ms;
    const bool done = repeats && step >= (uint32_t)count * repeats;
    const uint16_t index = done ? count - 1 : step % count;
    memcpy(rows, frames[index], sizeof(rows));
    return !done;
  }
};
