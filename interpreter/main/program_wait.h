#pragma once
#include <cstdint>

// A program wait must yield frequently, observe STOP and freeze while paused.
// This owns no mutex and never deletes a FreeRTOS task from another task.
template<class Running, class Paused, class Stepping, class Clock, class Sleep>
void capi_program_wait(uint32_t remaining, Running running, Paused paused,
                       Stepping stepping, Clock now, Sleep sleep) {
  while (remaining && running()) {
    if (paused() && !stepping()) { sleep(5); continue; }
    const uint32_t slice = remaining < 10 ? remaining : 10;
    const uint32_t before = now();
    sleep(slice);
    const uint32_t elapsed = now() - before;
    remaining -= elapsed < remaining ? elapsed : remaining;
  }
}
