#pragma once
#include <cstddef>
#include <cstdint>
#include <string>

// Sequential USB command replay: side effects happen once even if an ACK is lost.
// Only public commands are retained. Never cache Wi-Fi credentials.
struct CapiLinkReplay {
  std::string id, response;
  void clear() { id.clear(); response.clear(); }
};

struct CapiLinkTransfer {
  bool begun = false, verified = false;
  size_t sequence = 0;
  void begin() { begun = true; verified = false; sequence = 0; }
  bool accept(int next) {
    if (!begun || next < 0 || static_cast<size_t>(next) != sequence) return false;
    verified = false; ++sequence; return true;
  }
  void clear() { begun = verified = false; sequence = 0; }
};
