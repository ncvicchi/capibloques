/// <reference types="w3c-web-serial" />
import type { UsbDriverFactory } from './usb-session';

export const createEspDriver: UsbDriverFactory = async (port, signal) => {
  const [{ ESPLoader, Transport }, { md5 }, { bytesToHex }] = await Promise.all([import('esptool-js'), import('@noble/hashes/legacy.js'), import('@noble/hashes/utils.js')]);
  signal.throwIfAborted();
  let closing = false, opened = false;
  let closePromise: Promise<void> | null = null;
  const check = () => { signal.throwIfAborted(); if (closing) throw new DOMException('Closed', 'AbortError'); };
  class PrivateTransport extends Transport {
    // Upstream calls trace even with tracing=false on several error paths.
    // Never persist/print serial bytes, MACs, private firmware or device errors.
    override trace() {}
    override appendArray(a: Uint8Array, b: Uint8Array) {
      if (a.length + b.length > 131072) throw new Error('Serial receive buffer limit');
      return super.appendArray(a, b);
    }
    override async connect(baud = 115200) { check(); await super.connect(baud); opened = true; check(); }
    override async write(data: Uint8Array) {
      check();
      if (!port.writable) throw new DOMException('Disconnected', 'NetworkError');
      const writer = port.writable.getWriter();
      // Upstream 0.6.1 does not release its writer when write() rejects.
      try { await writer.write(this.slipWriter(data)); check(); } finally { writer.releaseLock(); }
    }
    override async read(timeout = 5000) { check(); const value = await super.read(Math.min(timeout, 5000)); check(); return value; }
    override async setDTR(state: boolean) { check(); await super.setDTR(state); check(); }
    override async setRTS(state: boolean) { check(); await super.setRTS(state); check(); }
  }
  const transport = new PrivateTransport(port, false);
  const loader = new ESPLoader({ transport, baudrate: 115200, debugLogging: false, enableTracing: false, terminal: { clean() {}, write() {}, writeLine() {} } });
  return {
    async detect() {
      check(); await loader.main(); check();
      // detectFlashSize() defaults to 4 MB when unknown; never use that fallback.
      const id = await loader.readFlashId(); check();
      const name = loader.DETECTED_FLASH_SIZES[(id >>> 16) & 255];
      const sizes: Record<string, number> = { '256KB': 262144, '512KB': 524288, '1MB': 1048576, '2MB': 2097152, '4MB': 4194304, '8MB': 8388608, '16MB': 16777216, '32MB': 33554432 };
      return { chip: loader.chip.CHIP_NAME, flashBytes: sizes[name] ?? 0 };
    },
    async write(firmware, progress) {
      check();
      await loader.writeFlash({
        fileArray: firmware.parts, flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep', eraseAll: false, compress: true,
        // Preserve the SHA-256-checked compiled headers byte-for-byte. MD5 here
        // is the ESP bootloader transfer check, not a security hash/signature.
        calculateMD5Hash: data => { check(); return bytesToHex(md5(data)); },
        reportProgress: (index, written, total) => { check(); progress((index + (total ? written / total : 0)) / firmware.parts.length * 100); },
      });
      check();
    },
    async reset() { check(); await loader.after('hard_reset'); check(); },
    async close() {
      closing = true;
      // A cancellation during port.open still reaches the normal finally after
      // open settles; do not memoize a no-op and leak that late-opened port.
      if (!opened) return;
      closePromise ??= transport.disconnect().then(() => { opened = false; });
      await closePromise;
    },
  };
};
