/// <reference types="w3c-web-serial" />
import type { UsbFirmware } from './usb-firmware';

export type UsbStage = 'idle' | 'selecting' | 'preparing' | 'connecting' | 'writing' | 'resetting' | 'closing' | 'done' | 'monitor' | 'error';
export type UsbState = { stage: UsbStage; message: string; progress: number; chip: string; text: string; writingStarted: boolean; verified: boolean };
export interface UsbDriver {
  detect(): Promise<{ chip: string; flashBytes: number }>;
  write(firmware: UsbFirmware, progress: (percent: number) => void): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
export type UsbDriverFactory = (port: SerialPort, signal: AbortSignal) => Promise<UsbDriver>;
export class UsbError extends Error {}
class UsbCleanupError extends UsbError {
  constructor() { super('No pudimos confirmar el cierre del puerto. Desconectá el cable y cerrá esta pestaña antes de volver a conectar USB.'); }
}
async function confirmClose(close: () => Promise<void>) {
  try { await close(); } catch { throw new UsbCleanupError(); }
}
// Blocks a replacement component/account from acquiring USB while an old
// asynchronous operation is still releasing streams. Web Locks adds tab scope.
let owner: UsbSession | null = null;
export function usbBusy(state: UsbState) { return !['idle', 'done', 'error', 'monitor'].includes(state.stage); }

export function usbErrorMessage(error: unknown, writing: boolean) {
  const recovery = writing ? ' La grabación puede haber quedado incompleta. Volvé a grabar el firmware completo; no reconectes actuadores todavía.' : '';
  if (error instanceof UsbError) return error.message + recovery;
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotFoundError' || name === 'NotAllowedError') return 'No elegiste un puerto o no se concedió permiso. Podés volver a intentarlo.';
  if (name === 'SecurityError') return 'El navegador bloqueó USB. Usá Chrome o Edge de escritorio, en HTTPS o localhost.';
  if (name === 'InvalidStateError' || name === 'NetworkError') return 'No pudimos usar el puerto. Cerrá otros monitores, revisá el cable USB de datos y volvé a elegir la placa.' + recovery;
  return 'No se pudo completar la conexión o verificar la grabación. Revisá el cable y la placa; si no entra al cargador, mantené BOOT mientras conectamos y soltalo al detectar el chip.' + recovery;
}

export function appendSerialText(previous: string, incoming: string) {
  // Plain text only, bounded even when a sketch never emits a newline.
  // oxlint-disable-next-line no-control-regex -- Strip terminal escape/control bytes from plain text.
  const clean = incoming.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[^\P{Cc}\n\t]/gu, '');
  const text = (previous + clean).split('\n').slice(-200).join('\n');
  const encoded = new TextEncoder().encode(text);
  if (encoded.length <= 32768) return text;
  let start = encoded.length - 32768;
  // Trim only at a UTF-8 boundary: emoji must not become a replacement glyph.
  while ((encoded[start] & 0xc0) === 0x80) start++;
  return new TextDecoder().decode(encoded.subarray(start));
}

export class UsbSession {
  state: UsbState = { stage: 'idle', message: 'Sin conexión USB.', progress: 0, chip: '', text: '', writingStarted: false, verified: false };
  private aborter: AbortController | null = null;
  private operation: Promise<void> | null = null;
  private driver: UsbDriver | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private port: SerialPort | null = null;
  private disposed = false;
  private textEpoch = 0;
  private listeners = new Set<() => void>();
  constructor(privateFactory: UsbDriverFactory) { this.factory = privateFactory; }
  private factory: UsbDriverFactory;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  snapshot = () => this.state;
  private update(patch: Partial<UsbState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) for (const callback of this.listeners) callback();
  }
  clearText() { ++this.textEpoch; this.update({ text: '' }); }
  private check(signal: AbortSignal) { signal.throwIfAborted(); if (this.disposed) throw new DOMException('Closed', 'AbortError'); }

  private start(requestPort: () => Promise<SerialPort>, work: (port: SerialPort, signal: AbortSignal) => Promise<void>) {
    if (this.disposed || this.operation) return;
    if (owner) { this.update({ stage: 'error', message: 'Otra conexión USB todavía se está cerrando. Esperá antes de reintentar.' }); return; }
    // oxlint-disable-next-line typescript/no-this-alias -- Identity lease, not a scope alias.
    owner = this;
    const aborter = new AbortController(); this.aborter = aborter;
    this.update({ stage: 'selecting', message: 'Elegí la Wemos conectada a esta PC en la ventana del navegador.', progress: 0, chip: '', writingStarted: false, verified: false, text: '' });
    // Must run synchronously in the click gesture, before imports/network/locks.
    let selection: Promise<SerialPort>;
    try { selection = requestPort(); } catch (error) { selection = Promise.reject(error); }
    this.operation = (async () => {
      let success = false, cleanupFailed = false;
      const operate = async () => {
        try {
          const port = await selection; this.check(aborter.signal); this.port = port;
          await work(port, aborter.signal); this.check(aborter.signal); success = true;
        } finally {
          this.update({ stage: 'closing', message: 'Liberando el puerto USB…' });
          if (this.driver) await confirmClose(() => this.driver!.close());
          this.driver = null;
        }
      };
      try {
        // Consume selection rejection even if another tab owns the lock.
        await selection;
        this.check(aborter.signal);
        if (typeof navigator !== 'undefined' && navigator.locks) {
          await navigator.locks.request('capibloques-usb', { ifAvailable: true }, async lock => {
            if (!lock) throw new UsbError('Otra pestaña de CapiBloques está usando USB. Cerrá su conexión primero.');
            await operate();
          });
        } else await operate();
        if (success) this.update({ stage: 'done', message: 'Firmware grabado y verificado. Se solicitó el reinicio; comprobá que el programa arrancó en la placa o en el monitor.', progress: 100 });
      } catch (error) {
        cleanupFailed = error instanceof UsbCleanupError;
        const cancelledCleanly = aborter.signal.aborted && !cleanupFailed && !this.state.writingStarted && !(aborter.signal.reason instanceof UsbError);
        const incomplete = this.state.writingStarted && !this.state.verified;
        const message = cleanupFailed ? usbErrorMessage(error, incomplete) : aborter.signal.aborted
          ? (aborter.signal.reason instanceof UsbError ? aborter.signal.reason.message : 'Conexión cerrada. El puerto quedó liberado; esto no detiene el programa físico.') + (incomplete ? ' El firmware puede estar incompleto: volvé a grabarlo entero antes de conectar actuadores.' : '')
          : usbErrorMessage(error, incomplete);
        this.update({ stage: cancelledCleanly ? 'idle' : 'error', message: message + (this.state.verified ? ' Los segmentos sí se verificaron, pero no confirmamos el reinicio o cierre. Revisá la conexión y pulsá RESET con los actuadores desconectados.' : '') });
      } finally {
        this.driver = null; this.port = null; this.reader = null; this.aborter = null; this.operation = null;
        // If cleanup failed, keep the lease: a new account/panel must not race
        // a reader/writer that the browser could not close. Reopening the tab
        // is the explicit recovery, never a silent second owner.
        if (owner === this && !cleanupFailed) owner = null;
        if (this.disposed) this.state = { ...this.state, text: '', chip: '' };
      }
    })();
  }

  flash(requestPort: () => Promise<SerialPort>, prepare: (signal: AbortSignal) => Promise<UsbFirmware>, authorize: (signal: AbortSignal) => Promise<void>) {
    this.start(requestPort, async (port, signal) => {
      this.update({ stage: 'preparing', message: 'Descargando y comprobando el firmware privado…' });
      let firmware: UsbFirmware;
      try { firmware = await prepare(signal); } catch (error) { throw new UsbError(error instanceof Error ? error.message : 'No pudimos preparar el firmware.'); }
      const timer = setTimeout(() => this.cancel(new UsbError('Se agotó el tiempo de conexión o grabación. Revisá el cable y volvé a intentarlo.')), 240_000);
      try {
        this.check(signal);
        this.update({ stage: 'connecting', message: 'Detectando ESP32 y memoria. Esto puede reiniciar la placa; todavía no escribimos flash.' });
        this.driver = await this.factory(port, signal); this.check(signal);
        const detected = await this.driver.detect(); this.check(signal);
        if (detected.chip !== 'ESP32') throw new UsbError('La placa no es un ESP32 clásico. Este firmware es sólo para Wemos D1 R32, no ESP32-S3 ni otras familias.');
        if (!Number.isSafeInteger(detected.flashBytes) || detected.flashBytes < 4 * 1024 * 1024) throw new UsbError('No se pudo verificar una memoria flash de al menos 4 MB. No grabamos por suposición.');
        this.update({ chip: `ESP32 · ${detected.flashBytes / 1024 / 1024} MB`, message: 'Placa compatible detectada. Comprobando nuevamente acceso y vigencia…' });
        try { await authorize(signal); } catch (error) { throw new UsbError(error instanceof Error ? error.message : 'El acceso cambió. No grabamos.'); }
        this.check(signal);
        this.update({ stage: 'writing', message: 'Grabando y verificando cada segmento. No desconectes el cable.', writingStarted: true });
        await this.driver.write(firmware, progress => { this.check(signal); this.update({ progress: Math.max(0, Math.min(99, Math.round(progress))) }); });
        this.check(signal);
        this.update({ stage: 'resetting', verified: true, message: 'Todos los segmentos verificados. Reiniciando la Wemos…' });
        await this.driver.reset();
      } finally { clearTimeout(timer); for (const part of firmware.parts) part.data.fill(0); }
    });
  }

  monitor(requestPort: () => Promise<SerialPort>) {
    this.start(requestPort, async (port, signal) => {
      this.update({ stage: 'connecting', message: 'Abriendo monitor Serial a 115200 baudios…' });
      let opened = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let text = '', dirty = false, textEpoch = this.textEpoch;
      const flush = () => { timer = null; if (textEpoch !== this.textEpoch) { text = ''; textEpoch = this.textEpoch; } if (dirty && !signal.aborted) { dirty = false; this.update({ text }); } };
      try {
        await port.open({ baudRate: 115200, bufferSize: 16_384 }); opened = true; this.check(signal);
        // Do not deliberately reset or control outputs in a read-only monitor.
        if (!port.readable) throw new UsbError('El puerto no ofrece lectura Serial.');
        this.reader = port.readable.getReader();
        this.update({ stage: 'monitor', message: 'Monitor Serial real · 115200 baudios · sólo lectura.' });
        const decoder = new TextDecoder();
        while (!signal.aborted) {
          const { value, done } = await this.reader.read();
          if (done) { this.check(signal); throw new UsbError('La placa cerró el puerto o se desconectó el cable. Podés volver a conectarla.'); }
          this.check(signal);
          if (value) {
            // Match clearText while retaining bounded, throttled rendering.
            if (textEpoch !== this.textEpoch) { text = ''; textEpoch = this.textEpoch; }
            text = appendSerialText(text, decoder.decode(value, { stream: true })); dirty = true;
            timer ??= setTimeout(flush, 100);
          }
        }
      } finally {
        if (timer) clearTimeout(timer);
        this.update({ stage: 'closing', message: 'Cerrando el monitor y liberando USB…' });
        await this.reader?.cancel().catch(() => {}); this.reader?.releaseLock(); this.reader = null;
        if (opened) await confirmClose(() => port.close());
      }
    });
  }

  cancel(reason?: UsbError) {
    if (!this.aborter) return;
    this.aborter.abort(reason);
    this.update({ stage: 'closing', message: 'Deteniendo la operación y liberando USB. Esperá a que termine; si el selector del navegador sigue abierto, cancelalo allí también. Si el cable falló y no se libera, desconectalo y cerrá esta pestaña.' });
    // Closing wakes an idle read. Never release ownership via a Promise.race:
    // another connection may start only after the old operation has settled.
    void this.reader?.cancel().catch(() => {});
    void this.driver?.close().catch(() => {});
  }
  disconnected(port: EventTarget | null) { if (port === this.port) this.cancel(new UsbError('Se desconectó la placa. Revisá el cable y volvé a elegir el puerto.')); }
  settled() { return this.operation ?? Promise.resolve(); }
  dispose() { this.disposed = true; this.listeners.clear(); this.clearText(); this.cancel(new UsbError('La ventana o la sesión se cerró.')); }
}
