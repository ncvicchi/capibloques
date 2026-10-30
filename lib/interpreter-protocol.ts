/// <reference types="w3c-web-serial" />
// @ts-expect-error Node strip-types runner.
import { CAPI_INTERPRETER_ABI, CAPI_INTERPRETER_VERSION, type CapiRulesBundle } from './capi-rules.ts';
// @ts-expect-error Node strip-types runner.
import { acquireUsbLease, usbDeadline } from './usb-lease.ts';
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
  private tolerant: boolean;
  constructor(tolerant = false) { this.tolerant = tolerant; }
  push(bytes: Uint8Array) {
    this.pending += this.decoder.decode(bytes, { stream: true });
    if (this.pending.length > 64 * 1024) throw new InterpreterProtocolError('La placa envió una respuesta demasiado grande.');
    const lines = this.pending.split('\n'); this.pending = lines.pop() ?? '';
    return lines.map(line => line.trim()).filter(line => line.startsWith('{')).flatMap(line => {
      try {
        const packet: unknown = JSON.parse(line);
        if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return [];
        return [packet as Packet];
      } catch {
        // Boot logs and an interrupted frame can share the first line. The
        // next newline restores framing; the tagged request safely retries.
        if (this.tolerant) return [];
        throw new InterpreterProtocolError('La placa respondió con un mensaje inválido.');
      }
    });
  }
}

function base64(bytes: Uint8Array) {
  let value = '';
  for (let offset = 0; offset < bytes.length; offset += 0x4000) value += String.fromCharCode(...bytes.subarray(offset, offset + 0x4000));
  return btoa(value);
}

class ReplyTimeout extends InterpreterProtocolError {}
interface PendingReply { id: string; type: string; legacy: boolean; resolve: (packet: Packet) => void; reject: (error: Error) => void; }

export class InterpreterSession {
  state: InterpreterState = { stage: 'idle', message: 'Sin placa conectada.', progress: 0, hello: null, telemetry: [] };
  private listeners = new Set<() => void>();
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reading: Promise<void> | null = null;
  private opening: Promise<void> | null = null;
  private closing: Promise<void> | null = null;
  private releaseLease: (() => Promise<void>) | null = null;
  private pending: PendingReply | null = null;
  private epoch = 0;
  private busy = false;
  private connected = false;
  private tagged = false;
  private nextId = 0;
  private identity = crypto.randomUUID();
  private failure: Error | null = null;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  snapshot = () => this.state;
  private update(patch: Partial<InterpreterState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private check(epoch: number) { if (epoch !== this.epoch || this.failure) throw this.failure ?? new InterpreterProtocolError('Operación cancelada.'); }
  private async exclusive<T>(operation: () => Promise<T>) {
    if (this.busy || this.closing) throw new InterpreterProtocolError('Esperá a que termine la operación anterior.');
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }
  private async exchange(packet: Packet, type: string, timeout = 5000, attempts = this.tagged ? 3 : 1, legacy = false): Promise<Packet> {
    const epoch = this.epoch, id = `${this.identity}:${++this.nextId}`;
    if (!this.writer) throw new InterpreterProtocolError('Conectá la placa antes de continuar.');
    for (let attempt = 0; ; attempt++) {
      this.check(epoch);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const response = new Promise<Packet>((resolve, reject) => {
        this.pending = { id, type, legacy, resolve, reject };
        timer = setTimeout(() => reject(new ReplyTimeout(`La placa no confirmó ${String(packet.type)} a tiempo.`)), timeout);
      });
      // Attach before writing: an immediate stream error must not be unhandled.
      void response.catch(() => {});
      try {
        await usbDeadline(this.writer.write(encodeProtocolPacket({ ...packet, requestId: id })), 5000, 'El puerto USB dejó de aceptar datos.');
        const answer = await response; this.check(epoch); return answer;
      } catch (error) {
        this.check(epoch);
        if (!(error instanceof ReplyTimeout) || attempt + 1 >= attempts) throw error;
        this.update({ message: `Reintentando confirmación de ${String(packet.type)} (${attempt + 2}/${attempts})…` });
      } finally { clearTimeout(timer); if (this.pending?.id === id) this.pending = null; }
    }
  }
  async connect(requestPort: () => Promise<SerialPort>, expectedBoard: BoardProfileId) {
    if (this.connected) return;
    // Preserve the browser user gesture; do not wait on locks before selection.
    if (this.busy || this.closing) return;
    this.failure = null;
    const epoch = ++this.epoch;
    await this.exclusive(async () => {
      this.update({ stage: 'connecting', message: 'Buscando el intérprete CapiBloques…', progress: 0, hello: null, telemetry: [] });
      try {
        const selection = requestPort();
        void selection.catch(() => {});
        this.releaseLease = await acquireUsbLease(this);
        const port = await selection; this.check(epoch); this.port = port;
        for (let attempt = 0; ; attempt++) {
          this.check(epoch);
          this.opening = port.open({ baudRate: 115200, bufferSize: 16_384 });
          try {
            await usbDeadline(this.opening, 10000, 'El sistema no pudo abrir el puerto USB. Revisá el cable y otros monitores.');
            break;
          } catch (error) {
            if (!(error instanceof Error) || !['NetworkError', 'NotFoundError'].includes(error.name) || attempt >= 7) throw error;
            this.update({ message: 'Esperando que el puerto USB reaparezca después del reinicio…' });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        this.check(epoch);
        if (!port.readable || !port.writable) throw new InterpreterProtocolError('El puerto no permite enviar y recibir reglas.');
        this.reader = port.readable.getReader(); this.writer = port.writable.getWriter();
        this.connected = true;
        this.reading = this.readLoop(this.reader, epoch);
        let response: Packet | null = null;
        const attempts = expectedBoard === 'waveshare-esp32-s3-touch-lcd-5-28117' ? 8 : 5;
        for (let attempt = 0; attempt < attempts; attempt++) {
          try {
            response = await this.exchange({ type: 'HELLO', protocol: 'CapiLink', abi: CAPI_INTERPRETER_ABI }, 'HELLO', 2500, 1, true);
            break;
          } catch (error) {
            if (!(error instanceof ReplyTimeout) || attempt === attempts - 1) throw error;
            this.update({ message: `La placa está arrancando. Reintentando (${attempt + 2}/${attempts})…` });
          }
        }
        const hello = response as unknown as InterpreterHello;
        if (!hello || hello.protocol !== 'CapiLink' || typeof hello.firmware !== 'string' || !Array.isArray(hello.capabilities) || !hello.capabilities.every(cap => typeof cap === 'string') || !Number.isSafeInteger(hello.maxRulesBytes) || hello.maxRulesBytes <= 0 || typeof hello.resources?.pwmChannels !== 'number') throw new InterpreterProtocolError('La placa no tiene un intérprete CapiBloques reconocible.');
        this.tagged = hello.capabilities.includes('reliable-transfer');
        if (hello.board !== expectedBoard || hello.abi !== CAPI_INTERPRETER_ABI || !versionAtLeast(hello.firmware, CAPI_INTERPRETER_VERSION) || !this.tagged) {
          this.update({ stage: 'incompatible', hello, message: hello.board !== expectedBoard ? 'El intérprete pertenece a otra placa. Instalá el firmware correcto.' : 'Actualizá el intérprete para enviar reglas con confirmaciones seguras.' });
          return;
        }
        this.check(epoch);
        this.update({ stage: 'ready', hello, message: `Intérprete ${hello.firmware} listo.`, progress: 0 });
      } catch (error) { await this.fail(error); }
    });
  }
  private async fail(error: unknown) {
    const message = error instanceof Error ? error.message : 'Se perdió la conexión con la placa.';
    try { await this.close(); }
    catch { this.update({ stage: 'error', message: message + ' No se confirmó el cierre del puerto; desconectá el cable y cerrá esta pestaña antes de reintentar.' }); return; }
    this.update({ stage: 'error', message });
  }
  private async readLoop(reader: ReadableStreamDefaultReader<Uint8Array>, epoch: number) {
    const lines = new ProtocolLines(true);
    try {
      while (epoch === this.epoch) {
        const { value, done } = await reader.read();
        if (epoch !== this.epoch) return;
        if (done) throw new InterpreterProtocolError('Se desconectó la placa. Revisá el cable y volvé a conectar.');
        let packets: Packet[];
        try { packets = lines.push(value ?? new Uint8Array()); }
        catch (error) { if (this.state.stage === 'connecting') continue; throw error; }
        for (const packet of packets) {
          if (packet.type === 'TELEMETRY') {
            const telemetry = packet as unknown as InterpreterTelemetry;
            const control = telemetry.event === 'control' && typeof telemetry.value === 'string' ? telemetry.value : '';
            // Transfer stages have priority over late telemetry from the old program.
            const controlsAllowed = !['sending', 'connecting', 'closing', 'error'].includes(this.state.stage);
            const stage = control === 'RUN' || control === 'RESUME' ? 'running' : control === 'PAUSE' || control === 'STEP' ? 'paused' : control === 'STOP' ? 'stopped' : control === 'RESET_PROGRAM' || telemetry.event === 'program-done' ? 'ready' : null;
            this.update({ telemetry: [...this.state.telemetry, telemetry].slice(-60), ...(controlsAllowed && stage ? { stage, message: stage === 'ready' ? 'El programa terminó o se reinició.' : stage === 'running' ? 'El programa se está ejecutando en la placa.' : stage === 'paused' ? 'Programa pausado en la placa.' : 'Programa detenido en la placa.' } : {}) });
          } else {
            const pending = this.pending;
            if (!pending || !(packet.requestId === pending.id || (pending.legacy && packet.requestId === undefined))) continue;
            if (packet.type === 'ERROR') pending.reject(new InterpreterProtocolError(typeof packet.message === 'string' ? packet.message : 'La placa rechazó la operación.'));
            else if (packet.type === pending.type) pending.resolve(packet);
            else pending.reject(new InterpreterProtocolError('La placa respondió fuera de secuencia. Volvé a conectar.'));
          }
        }
      }
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.failure = error instanceof Error ? error : new InterpreterProtocolError('Se perdió la conexión.');
      this.pending?.reject(this.failure);
      this.connected = false;
      // Let this read loop settle before close awaits it.
      const failure = this.failure;
      queueMicrotask(() => { void this.fail(failure); });
    }
  }
  async send(bundle: CapiRulesBundle) {
    return this.exclusive(async () => {
      const hello = this.state.hello;
      if (!this.connected || !['ready', 'stopped', 'paused', 'running'].includes(this.state.stage)) throw new InterpreterProtocolError('Conectá un intérprete compatible antes de enviar reglas.');
      if (!hello || bundle.bytes.length > hello.maxRulesBytes) throw new InterpreterProtocolError('El programa no entra en la memoria de reglas de esta placa.');
      if (bundle.document.board !== hello.board) throw new InterpreterProtocolError('La placa conectada no coincide con la elegida para este proyecto. Desconectala y elegí la placa correcta.');
      const missing = bundle.requiredCapabilities.filter(capability => !hello.capabilities.includes(capability));
      if (missing.length) throw new InterpreterProtocolError(`Actualizá el intérprete: faltan ${missing.join(', ')}.`);
      if (bundle.resourceRequirements.pwmChannels > hello.resources.pwmChannels) throw new InterpreterProtocolError('El programa necesita más salidas de potencia que las disponibles.');
      // Snapshot: caller edits cannot mutate an in-flight transfer.
      const bytes = bundle.bytes.slice();
      this.update({ stage: 'sending', message: 'Deteniendo el programa anterior y preparando las reglas…', progress: 0 });
      try {
        await this.exchange({ type: 'STOP' }, 'OK');
        await this.exchange({ type: 'BEGIN', bytes: bytes.length, checksum: bundle.checksum, format: 1, abi: CAPI_INTERPRETER_ABI }, 'READY');
        const chunks = Math.ceil(bytes.length / CHUNK_BYTES);
        for (let sequence = 0; sequence < chunks; sequence++) {
          const answer = await this.exchange({ type: 'CHUNK', sequence, data: base64(bytes.subarray(sequence * CHUNK_BYTES, (sequence + 1) * CHUNK_BYTES)) }, 'ACK');
          if (answer.sequence !== sequence) throw new InterpreterProtocolError('La placa confirmó un fragmento incorrecto.');
          this.update({ progress: Math.round((sequence + 1) / chunks * 90), message: `Enviando reglas: fragmento ${sequence + 1} de ${chunks}.` });
        }
        await this.exchange({ type: 'VERIFY' }, 'VERIFIED');
        this.update({ progress: 95, message: 'Reglas comprobadas. Guardando en la placa…' });
        await this.exchange({ type: 'COMMIT' }, 'COMMITTED', 12000);
        this.update({ stage: 'ready', progress: 100, message: 'Reglas verificadas y guardadas en la placa.' });
      } catch (error) { await this.fail(error); throw error; }
      finally { bytes.fill(0); }
    });
  }
  async provisionWifi(ssid: string, password: string) {
    if (!ssid.trim() || new TextEncoder().encode(ssid).length > 32) throw new InterpreterProtocolError('El nombre de red debe ocupar entre 1 y 32 bytes.');
    if (password && (password.length < 8 || password.length > 63)) throw new InterpreterProtocolError('La clave debe tener entre 8 y 63 caracteres, o quedar vacía si la red es abierta.');
    await this.configure({ type: 'CONFIG_WIFI', ssid, password }, 'WIFI_CONFIGURED');
  }
  async provisionPair(role: PairRole, credentials: PairCredentials) {
    if (!/^WS[A-F0-9]{6}$/.test(credentials.ssid) || credentials.password.length < 8 || credentials.password.length > 63 || !/^[a-f0-9]{32}$/.test(credentials.pairingKey) || !/^[A-F0-9]{12}$/.test(credentials.screenHardwareId)) throw new InterpreterProtocolError('El perfil automático de la pareja no es válido.');
    await this.configure({ type: 'CONFIG_PAIR', role, ...credentials }, 'PAIR_CONFIGURED');
  }
  private async configure(packet: Packet, reply: string) {
    return this.exclusive(async () => {
      if (!['ready', 'stopped'].includes(this.state.stage)) throw new InterpreterProtocolError('Conectá y detené la placa antes de configurar la red.');
      try { await this.exchange({ type: 'STOP' }, 'OK'); await this.exchange(packet, reply); }
      catch (error) { await this.fail(error); throw error; }
    });
  }
  async command(type: 'RUN' | 'PAUSE' | 'RESUME' | 'STEP' | 'STOP' | 'RESET_PROGRAM') {
    return this.exclusive(async () => {
      if (!this.connected || ['incompatible', 'connecting', 'sending', 'error', 'idle'].includes(this.state.stage)) throw new InterpreterProtocolError('Conectá un intérprete compatible antes de controlar la placa.');
      try {
        const previousTelemetry = this.state.telemetry.at(-1);
        await this.exchange({ type }, 'OK');
        if ((type === 'RUN' || type === 'RESUME') && this.state.telemetry.at(-1)?.event === 'program-done' && this.state.telemetry.at(-1) !== previousTelemetry) return;
        const stage = type === 'RUN' || type === 'RESUME' ? 'running' : type === 'PAUSE' || type === 'STEP' ? 'paused' : type === 'STOP' ? 'stopped' : 'ready';
        this.update({ stage, message: type === 'STEP' ? 'La placa avanzó un paso y quedó pausada.' : stage === 'running' ? 'El programa se está ejecutando en la placa.' : stage === 'paused' ? 'Programa pausado en la placa.' : stage === 'stopped' ? 'Programa detenido en la placa.' : 'Programa reiniciado.' });
      } catch (error) { await this.fail(error); throw error; }
    });
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    ++this.epoch;
    this.connected = false;
    this.failure = new InterpreterProtocolError('Conexión cerrada.');
    this.pending?.reject(this.failure); this.pending = null;
    this.update({ stage: 'closing', message: 'Liberando el puerto USB…' });
    const cleanup = async () => {
      try {
        if (this.opening) await this.opening.catch(() => {});
        await this.reader?.cancel().catch(() => {});
        await this.reading?.catch(() => {});
        this.reader?.releaseLock(); this.reader = null;
        if (this.writer) { await this.writer.abort().catch(() => {}); this.writer.releaseLock(); this.writer = null; }
        if (this.port?.readable || this.port?.writable) await this.port.close();
        this.port = null; this.opening = null; this.reading = null; this.tagged = false;
        await this.releaseLease?.(); this.releaseLease = null;
        this.update({ stage: 'idle', message: 'Puerto USB liberado.', progress: 0, hello: null });
      } finally { this.closing = null; }
    };
    // Background cleanup retains ownership even if the browser driver is stuck.
    this.closing = usbDeadline(cleanup(), 6000, 'El sistema no liberó USB. Desconectá el cable y cerrá esta pestaña.').catch(error => {
      this.update({ stage: 'error', message: error.message });
      throw error;
    });
    return this.closing;
  }
}
