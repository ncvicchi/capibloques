#pragma once
// Call under otto_mutex on ESP-IDF; native exports use one cooperative scheduler.
struct CapiOttoQueue {
  int entries[32] = {};
  unsigned count = 0;
  bool try_acquire(int task) {
    for (unsigned i = 0; i < count; ++i) {
      if (entries[i] == task) return i == 0;
    }
    if (count == 32) return false;
    entries[count++] = task;
    return count == 1;
  }
  void release(int task) {
    for (unsigned i = 0; i < count; ++i) {
      if (entries[i] != task) continue;
      for (unsigned j = i + 1; j < count; ++j) entries[j - 1] = entries[j];
      --count;
      return;
    }
  }
  void clear() { count = 0; }
};
