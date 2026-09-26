/// <reference types="w3c-web-serial" />
// @ts-expect-error Node strip-types runner.
import { CAPI_INTERPRETER_ABI, CAPI_INTERPRETER_VERSION, type CapiRulesBundle } from './capi-rules.ts';
import type { BoardProfileId } from './board-profiles.ts';

export type InterpreterStage = 'idle' | 'connecting' | 'incompatible' | 'ready' | 'sending' | 'running' | 'paused' | 'stopped' | 'error' | 'closing';
export interface InterpreterHello { protocol: 'CapiLink'; firmware: string; abi: number; board: BoardProfileId; hardwareId?: string; wifiMac?: string; maxRulesBytes: number; capabilities: string[]; resources: { pwmChannels: number }; }
export type PairRole = 'screen' | 'project';
export interface PairCredentials { ssid: string; password: string; pairingKey: string; screenHardwareId: string; }
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

export function pairSsid(hardwareId: string) {
  const normalized = hardwareId.replace(/[^a-f0-9]/gi, '').toUpperCase();
  if (normalized.length < 6) throw new InterpreterProtocolError('La pantalla no informó una identidad Wi-Fi válida.');
  return `WS${normalized.slice(-6)}`;
}

export function createPairCredentials(hello: InterpreterHello): PairCredentials {
  if (!hello.hardwareId) throw new InterpreterProtocolError('Actualizá el firmware de la pantalla para poder emparejarla.');
  const random = new Uint8Array(24);
  crypto.getRandomValues(random);
  const encoded = Array.from(random, value => value.toString(16).padStart(2, '0')).join('');
  return { ssid: pairSsid(hello.hardwareId), password: encoded.slice(0, 20), pairingKey: encoded.slice(16, 48), screenHardwareId: hello.hardwareId };
}

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
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const wake = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          const waiter = this.waiters.indexOf(wake);
          if (waiter >= 0) this.waiters.splice(waiter, 1);
          reject(new InterpreterProtocolError('La placa no respondió a tiempo.'));
        }, Math.max(1, deadline - Date.now()));
        this.waiters.push(wake);
      });
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
      // Opening USB serial resets many ESP32 boards. Let the interpreter boot,
      // then retry HELLO because native USB can discard the first line while
      // the console/driver finishes attaching.
      await new Promise(resolve => setTimeout(resolve, 900));
      let response: Packet | null = null;
      for (let attempt = 0; attempt < 3 && !response; attempt += 1) {
        await this.write({ type: 'HELLO', protocol: 'CapiLink', abi: CAPI_INTERPRETER_ABI });
        try { response = await this.next('HELLO', 2500); }
        catch (error) { if (!(error instanceof InterpreterProtocolError) || error.message !== 'La placa no respondió a tiempo.' || attempt === 2) throw error; }
      }
      if (!response) throw new InterpreterProtocolError('La placa no respondió a tiempo.');
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
      // Stored rules start automatically after reset. Stop that previous
      // program before BEGIN so replacing it is deterministic.
      await this.write({ type: 'STOP' }); await this.next('OK');
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
  async provisionWifi(ssid: string, password: string) {
    if (this.state.stage !== 'ready' && this.state.stage !== 'stopped') throw new InterpreterProtocolError('Conectá el intérprete antes de configurar Wi-Fi.');
    if (!ssid.trim() || new TextEncoder().encode(ssid).length > 32) throw new InterpreterProtocolError('El nombre de red debe ocupar entre 1 y 32 bytes.');
    if (password && (password.length < 8 || password.length > 63)) throw new InterpreterProtocolError('La clave debe tener entre 8 y 63 caracteres, o quedar vacía si la red es abierta.');
    await this.write({ type: 'CONFIG_WIFI', ssid, password });
    await this.next('WIFI_CONFIGURED');
    this.update({ message: `Red “${ssid}” guardada sólo en la placa.` });
  }
  async provisionPair(role: PairRole, credentials: PairCredentials) {
    if (this.state.stage !== 'ready' && this.state.stage !== 'stopped') throw new InterpreterProtocolError('Conectá un intérprete compatible antes de emparejar.');
    if (!/^WS[A-F0-9]{6}$/.test(credentials.ssid) || credentials.password.length < 8 || credentials.password.length > 63 || !/^[a-f0-9]{32}$/.test(credentials.pairingKey) || !/^[A-F0-9]{12}$/.test(credentials.screenHardwareId)) throw new InterpreterProtocolError('El perfil automático de la pareja no es válido.');
    await this.write({ type: 'CONFIG_PAIR', role, ssid: credentials.ssid, password: credentials.password, pairingKey: credentials.pairingKey, screenHardwareId: credentials.screenHardwareId });
    await this.next('PAIR_CONFIGURED');
    this.update({ message: role === 'screen' ? `Pantalla lista con la red ${credentials.ssid}.` : `Placa vinculada automáticamente con ${credentials.ssid}.` });
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
