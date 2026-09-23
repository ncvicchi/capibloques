/// <reference types="w3c-web-serial" />
// @ts-expect-error Node strip-types runner.
import { CAPI_INTERPRETER_ABI, CAPI_INTERPRETER_VERSION, type CapiRulesBundle } from './capi-rules.ts';
import type { BoardProfileId } from './board-profiles.ts';

export type InterpreterStage = 'idle' | 'connecting' | 'incompatible' | 'ready' | 'sending' | 'running' | 'paused' | 'stopped' | 'error' | 'closing';
export interface InterpreterHello { protocol: 'CapiLink'; firmware: string; abi: number; board: BoardProfileId; maxRulesBytes: number; capabilities: string[]; resources: { pwmChannels: number }; }
export interface InterpreterTelemetry { event: string; blockId?: string; taskId?: string; deviceId?: string; value?: unknown; message?: string; }
export interface InterpreterState { stage: InterpreterStage; message: string; progress: number; hello: InterpreterHello | null; telemetry: InterpreterTelemetry[]; }
type Packet = Record<string, unknown>;
const CHUNK_BYTES = 768;

export class InterpreterProtocolError extends Error {}

function versionAtLeast(actual: string, minimum: string) {
  const parse = (value: string) => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null;
  const left = parse(actual), right = parse(minimum); if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) { if (left[index] !== right[index]) return left[index] > right[index]; }
  return true;
}

export function encodeProtocolPacket(packet: Packet) { return new TextEncoder().encode(`${JSON.stringify(packet)}\n`); }

export class ProtocolLines {
  private pending = '';
  private decoder = new TextDecoder();
  push(bytes: Uint8Array) {
    this.pending += this.decoder.decode(bytes, { stream: true });
    if (this.pending.length > 64 * 1024) throw new InterpreterProtocolError('La placa envió una respuesta demasiado grande.');
    const lines = this.pending.split('\n'); this.pending = lines.pop() ?? '';
    return lines.map(line => line.trim()).filter(line => line.startsWith('{')).map(line => {
      try { return JSON.parse(line) as Packet; } catch { throw new InterpreterProtocolError('La placa respondió con un mensaje inválido.'); }
    });
  }
}

function base64(bytes: Uint8Array) {
  let value = '';
  for (let offset = 0; offset < bytes.length; offset += 0x4000) value += String.fromCharCode(...bytes.subarray(offset, offset + 0x4000));
  return btoa(value);
}

export class InterpreterSession {
  state: InterpreterState = { stage: 'idle', message: 'Sin placa conectada.', progress: 0, hello: null, telemetry: [] };
  private listeners = new Set<() => void>();
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private packets: Packet[] = [];
  private waiters: Array<() => void> = [];
  private reading: Promise<void> | null = null;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  snapshot = () => this.state;
  private update(patch: Partial<InterpreterState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private async write(packet: Packet) { if (!this.writer) throw new InterpreterProtocolError('La placa no está conectada.'); await this.writer.write(encodeProtocolPacket(packet)); }
  private async next(type: string, timeout = 5000): Promise<Packet> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const index = this.packets.findIndex(packet => packet.type === type || packet.type === 'ERROR');
      if (index >= 0) { const packet = this.packets.splice(index, 1)[0]; if (packet.type === 'ERROR') throw new InterpreterProtocolError(typeof packet.message === 'string' ? packet.message : 'La placa rechazó la operación.'); return packet; }
      await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new InterpreterProtocolError('La placa no respondió a tiempo.')), Math.max(1, deadline - Date.now())); this.waiters.push(() => { clearTimeout(timer); resolve(); }); });
    }
    throw new InterpreterProtocolError('La placa no respondió a tiempo.');
  }
  async connect(requestPort: () => Promise<SerialPort>, expectedBoard: BoardProfileId) {
    if (this.port) return;
    this.update({ stage: 'connecting', message: 'Buscando el intérprete CapiBloques…', progress: 0, hello: null });
    try {
      const port = await requestPort(); await port.open({ baudRate: 115200, bufferSize: 16_384 });
      if (!port.readable || !port.writable) throw new InterpreterProtocolError('El puerto no permite enviar y recibir reglas.');
      this.port = port; this.reader = port.readable.getReader(); this.writer = port.writable.getWriter();
      this.reading = this.readLoop();
      // Opening USB serial resets many ESP32 boards. Let the interpreter boot
      // before the first command so HELLO is not lost in the ROM banner.
      await new Promise(resolve => setTimeout(resolve, 900));
      await this.write({ type: 'HELLO', protocol: 'CapiLink', abi: CAPI_INTERPRETER_ABI });
      const response = await this.next('HELLO', 7000);
      const hello = response as unknown as InterpreterHello;
      if (hello.protocol !== 'CapiLink' || typeof hello.firmware !== 'string' || !Array.isArray(hello.capabilities) || typeof hello.maxRulesBytes !== 'number' || typeof hello.resources?.pwmChannels !== 'number') throw new InterpreterProtocolError('La placa no tiene un intérprete CapiBloques reconocible.');
      if (hello.board !== expectedBoard || hello.abi !== CAPI_INTERPRETER_ABI || !versionAtLeast(hello.firmware, CAPI_INTERPRETER_VERSION)) {
        this.update({ stage: 'incompatible', hello, message: hello.board !== expectedBoard ? 'El intérprete pertenece a otra placa. Hay que instalar el firmware correcto.' : 'El intérprete está desactualizado. Actualizalo antes de enviar reglas.' });
        return;
      }
      this.update({ stage: 'ready', hello, message: `Intérprete ${hello.firmware} listo.`, progress: 0 });
    } catch (error) { await this.close(); this.update({ stage: 'error', message: error instanceof Error ? error.message : 'No pudimos conectar la placa.' }); }
  }
  private async readLoop() {
    const lines = new ProtocolLines();
    try {
      while (this.reader) {
        const { value, done } = await this.reader.read(); if (done) break;
        for (const packet of lines.push(value ?? new Uint8Array())) {
          if (packet.type === 'TELEMETRY') {
            const telemetry = packet as unknown as InterpreterTelemetry;
            this.update({ telemetry: [...this.state.telemetry, telemetry].slice(-60), ...(telemetry.event === 'program-done' ? { stage: 'ready' as const, message: 'El programa terminó en la placa.' } : {}) });
          }
          else this.packets.push(packet);
          for (const wake of this.waiters.splice(0)) wake();
        }
      }
    } catch (error) { if (this.state.stage !== 'closing') this.update({ stage: 'error', message: error instanceof Error ? error.message : 'Se perdió la conexión.' }); }
  }
  async send(bundle: CapiRulesBundle) {
    const hello = this.state.hello;
    if (this.state.stage !== 'ready' && this.state.stage !== 'stopped') throw new InterpreterProtocolError('Conectá un intérprete compatible antes de enviar reglas.');
    if (!hello || bundle.bytes.length > hello.maxRulesBytes) throw new InterpreterProtocolError('El programa no entra en la memoria de reglas de esta placa.');
    const missing = bundle.requiredCapabilities.filter(capability => !hello.capabilities.includes(capability));
    if (missing.length) throw new InterpreterProtocolError(`Este firmware todavía no incluye: ${missing.join(', ')}. Actualizá el intérprete antes de enviar.`);
    if (bundle.resourceRequirements.pwmChannels > hello.resources.pwmChannels) throw new InterpreterProtocolError(`Este programa necesita ${bundle.resourceRequirements.pwmChannels} salidas de potencia y el intérprete dispone de ${hello.resources.pwmChannels}.`);
    this.update({ stage: 'sending', message: 'Enviando una copia segura de las reglas…', progress: 0 });
    try {
      await this.write({ type: 'BEGIN', bytes: bundle.bytes.length, checksum: bundle.checksum, format: 1, abi: CAPI_INTERPRETER_ABI }); await this.next('READY');
      const chunks = Math.ceil(bundle.bytes.length / CHUNK_BYTES);
      for (let sequence = 0; sequence < chunks; sequence += 1) {
        const data = bundle.bytes.subarray(sequence * CHUNK_BYTES, (sequence + 1) * CHUNK_BYTES);
        await this.write({ type: 'CHUNK', sequence, data: base64(data) }); await this.next('ACK');
        this.update({ progress: Math.round(((sequence + 1) / chunks) * 90) });
      }
      await this.write({ type: 'VERIFY' }); await this.next('VERIFIED');
      await this.write({ type: 'COMMIT' }); await this.next('COMMITTED');
      this.update({ stage: 'ready', progress: 100, message: 'Reglas verificadas y guardadas. La versión anterior no se perdió durante la transferencia.' });
    } catch (error) {
      await this.close();
      this.update({ stage: 'error', message: error instanceof Error ? error.message : 'No pudimos transferir las reglas.' });
      throw error;
    }
  }
  async command(type: 'RUN' | 'PAUSE' | 'RESUME' | 'STOP' | 'RESET_PROGRAM') {
    try {
      await this.write({ type }); await this.next('OK');
      const stage = type === 'RUN' || type === 'RESUME' ? 'running' : type === 'PAUSE' ? 'paused' : type === 'STOP' ? 'stopped' : 'ready';
      this.update({ stage, message: stage === 'running' ? 'El programa se está ejecutando en la placa.' : stage === 'paused' ? 'Programa pausado en la placa.' : stage === 'stopped' ? 'Programa detenido en la placa.' : 'Programa reiniciado.' });
    } catch (error) {
      await this.close(); this.update({ stage: 'error', message: error instanceof Error ? error.message : 'La placa rechazó el comando.' }); throw error;
    }
  }
  async close() {
    if (!this.port) return;
    this.update({ stage: 'closing', message: 'Liberando el puerto USB…' });
    const port = this.port; this.port = null;
    await this.reader?.cancel().catch(() => {}); this.reader?.releaseLock(); this.reader = null;
    this.writer?.releaseLock(); this.writer = null;
    await this.reading?.catch(() => {}); this.reading = null;
    await port.close().catch(() => {});
    this.packets = []; for (const wake of this.waiters.splice(0)) wake();
    this.update({ stage: 'idle', message: 'Puerto USB liberado.', progress: 0, hello: null });
  }
}
