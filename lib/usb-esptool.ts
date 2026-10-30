/// <reference types="w3c-web-serial" />
import type { UsbDriverFactory } from './usb-session';
// @ts-expect-error Node strip-types runner.
import { usbDeadline } from './usb-lease.ts';

export const createEspDriver: UsbDriverFactory = async (port, signal) => {
  const [{ ESPLoader, Transport }, { md5 }, { bytesToHex }] = await Promise.all([import('esptool-js'), import('@noble/hashes/legacy.js'), import('@noble/hashes/utils.js')]);
  signal.throwIfAborted();
  let closing = false, opened = false;
  let opening: Promise<void> | null = null;
  let closePromise: Promise<void> | null = null;
  let activeWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  const check = () => { signal.throwIfAborted(); if (closing) throw new DOMException('Closed', 'AbortError'); };
  class PrivateTransport extends Transport {
    // Upstream calls trace even with tracing=false on several error paths.
    // Never persist/print serial bytes, MACs, private firmware or device errors.
    override trace() {}
    override appendArray(a: Uint8Array, b: Uint8Array) {
      if (a.length + b.length > 131072) throw new Error('Serial receive buffer limit');
      return super.appendArray(a, b);
    }
    override async connect(baud = 115200) {
      check(); opening = super.connect(baud);
      await usbDeadline(opening, 10000, 'El sistema no pudo abrir el puerto USB.');
      opened = true; check();
    }
    override async write(data: Uint8Array) {
      check();
      if (!port.writable) throw new DOMException('Disconnected', 'NetworkError');
      const writer = port.writable.getWriter();
      activeWriter = writer;
      // Upstream 0.6.1 does not release its writer when write() rejects.
      try { await usbDeadline(writer.write(this.slipWriter(data)), 10000, 'El puerto dejó de aceptar datos durante la grabación.'); check(); }
      finally { activeWriter = null; writer.releaseLock(); }
    }
    override async read(timeout = 5000) { check(); const value = await super.read(Math.min(timeout, 5000)); check(); return value; }
    override async setDTR(state: boolean) { check(); await usbDeadline(super.setDTR(state), 5000, 'El adaptador no respondió al configurar BOOT.'); check(); }
    override async setRTS(state: boolean) { check(); await usbDeadline(super.setRTS(state), 5000, 'El adaptador no respondió al reiniciar la placa.'); check(); }
  }
  const transport = new PrivateTransport(port, false);
  const loader = new ESPLoader({ transport, baudrate: 115200, debugLogging: false, enableTracing: false, terminal: { clean() {}, write() {}, writeLine() {} } });
  return {
    async detect() {
      check(); await usbDeadline(loader.main(), 60000, 'Se agotó el tiempo de detección de la placa.'); check();
      // detectFlashSize() defaults to 4 MB when unknown; never use that fallback.
      const id = await loader.readFlashId(); check();
      const name = loader.DETECTED_FLASH_SIZES[(id >>> 16) & 255];
      const sizes: Record<string, number> = { '256KB': 262144, '512KB': 524288, '1MB': 1048576, '2MB': 2097152, '4MB': 4194304, '8MB': 8388608, '16MB': 16777216, '32MB': 33554432 };
      return { chip: loader.chip.CHIP_NAME, flashBytes: sizes[name] ?? 0 };
    },
    async write(firmware, progress) {
      check();
      await usbDeadline(loader.writeFlash({
        fileArray: firmware.parts, flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep', eraseAll: false, compress: true,
        // Preserve the SHA-256-checked compiled headers byte-for-byte. MD5 here
        // is the ESP bootloader transfer check, not a security hash/signature.
        calculateMD5Hash: data => { check(); return bytesToHex(md5(data)); },
        reportProgress: (index, written, total) => { check(); progress((index + (total ? written / total : 0)) / firmware.parts.length * 100); },
      }), 180000, 'Se agotó el tiempo de grabación y verificación.');
      check();
    },
    async reset() {
      check();
      // Release BOOT before pulsing EN. Leaving IO0 asserted can boot back to
      // the ROM loader when the serial driver toggles signals on reopen.
      await transport.setDTR(false);
      // esptool-js 0.6.1 HardReset only releases RTS; it never asserts it.
      // Assert EN here so its existing delay/release produces a real pulse.
      await transport.setRTS(true);
      await loader.after('hard_reset'); check();
    },
    async close() {
      closing = true;
      if (opening && !opened) {
        try { await usbDeadline(opening, 6000, 'El sistema no terminó de abrir USB; desconectá el cable y cerrá esta pestaña.'); opened = true; }
        catch (error) {
          // A late open must close even after the UI timeout. The session keeps
          // its lease when cleanup fails, preventing a new owner racing it.
          void opening.then(() => transport.disconnect()).catch(() => {});
          throw error;
        }
      }
      if (!opened) return;
      closePromise ??= (async () => {
        void activeWriter?.abort().catch(() => {});
        await usbDeadline(transport.disconnect(), 6000, 'El sistema no liberó el puerto después de grabar.');
        opened = false;
      })();
      await closePromise;
    },
  };
};
