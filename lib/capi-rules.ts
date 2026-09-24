// @ts-expect-error Node strip-types runner.
import { compileTaskGraph, normalizeCompiledProgram, validateProgramForScene, type CompiledProgram, type ExecutableTask } from './capiblocks.ts';
import type { SceneDefinition } from './scene-model.ts';
// @ts-expect-error Node strip-types runner.
import { isBoardProfileId, type BoardProfileId } from './board-profiles.ts';

export const CAPI_RULES_FORMAT = 1;
export const CAPI_INTERPRETER_ABI = 1;
export const CAPI_INTERPRETER_VERSION = '1.3.0';
export const CAPI_RULES_MAX_BYTES = 32 * 1024;
export const CAPI_RULES_MAX_INSTRUCTIONS = 2048;
const HEADER_BYTES = 32;
const MAGIC = new TextEncoder().encode('CAPIRULE');

export interface CapiRulesDocument {
  format: 'CapiRules';
  version: typeof CAPI_RULES_FORMAT;
  abi: typeof CAPI_INTERPRETER_ABI;
  board: BoardProfileId;
  resources: SceneDefinition;
  variables: CompiledProgram['variables'];
  timers: CompiledProgram['timers'];
  tasks: ExecutableTask[];
  initial: { taskIds: string[] };
  debug: { blockIds: string[] };
}

export interface CapiRulesBundle {
  bytes: Uint8Array;
  document: CapiRulesDocument;
  checksum: string;
  instructionCount: number;
  requiredCapabilities: string[];
  resourceRequirements: { pwmChannels: number };
}

export class CapiRulesError extends Error {}

const capabilityForOperation = (operation: string) => ({
  pin: 'gpio', led: 'led', traffic: 'traffic', motor: 'motor', robot: 'robot',
  servo: 'servo', buzzer: 'buzzer', tone: 'buzzer', otto: 'otto', ottoSound: 'otto', ottoExpression: 'otto', ottoArms: 'otto',
  displayWrite: 'display', displayClear: 'display', displayAnimateText: 'display', displayArtwork: 'display', visualWait: 'visual-wait',
  matrixClear: 'matrix', matrixPixel: 'matrix', matrixPattern: 'matrix', matrixScroll: 'matrix',
  messageSend: 'messages', messageReceiveWait: 'messages', wifi: 'wifi', wifiMessageSend: 'wifi-messages', wifiMessageReceiveWait: 'wifi-messages', fork: 'parallel', join: 'parallel',
  counterSet: 'counter', counterChange: 'counter', variableSet: 'variables', variableChange: 'variables', serial: 'serial',
  timerStart: 'timers', timerRestart: 'timers', timerPause: 'timers', timerResume: 'timers', timerStop: 'timers', timerWait: 'timers',
}[operation] ?? 'core');

function instructionCapabilities(instruction: ExecutableTask['output'][number]) {
  const result = [capabilityForOperation(instruction.op)];
  const encodedInstruction = JSON.stringify(instruction);
  if (instruction.op === 'variableSet' || instruction.op === 'variableChange' || (instruction.op === 'serial' && instruction.expression)) result.push('expressions');
  if (encodedInstruction.includes('sensorValue')) result.push('analog-input');
  if (encodedInstruction.includes('buttonValue') || encodedInstruction.includes('barrierValue')) result.push('digital-input');
  if (encodedInstruction.includes('displayButtonValue')) result.push('display-keypad');
  if (encodedInstruction.includes('ottoDistance')) result.push('otto');
  if (encodedInstruction.includes('messageValue')) result.push('messages');
  if (encodedInstruction.includes('wifiValue')) result.push('wifi');
  if (encodedInstruction.includes('"kind":"variable"')) result.push('variables');
  if (encodedInstruction.includes('"kind":"timerElapsed"') || encodedInstruction.includes('"kind":"timerRemaining"')) result.push('timers');
  if (encodedInstruction.includes('"kind":"componentValue"')) result.push('component-state');
  if (instruction.op === 'jumpIfFalse') {
    const condition = instruction.condition;
    if (condition.kind === 'sensor') result.push('analog-input');
    if (condition.kind === 'buttonPressed') result.push('digital-input');
    if (condition.kind === 'displayButtonPressed') result.push('display');
    if (condition.kind === 'wifiConnected') result.push('wifi');
    if (condition.kind === 'value' || condition.kind === 'valueCompare') result.push('expressions');
    const encoded = JSON.stringify(condition);
    if (encoded.includes('sensorValue')) result.push('analog-input');
    if (encoded.includes('buttonValue') || encoded.includes('barrierValue')) result.push('digital-input');
    if (encoded.includes('displayButtonValue') || condition.kind === 'displayButtonPressed') result.push('display-keypad');
    if (encoded.includes('ottoDistance')) result.push('otto');
    if (encoded.includes('variable')) result.push('variables');
    if (encoded.includes('timerElapsed') || encoded.includes('timerRemaining')) result.push('timers');
    if (encoded.includes('componentValue')) result.push('component-state');
    if (encoded.includes('messageValue')) result.push('messages');
    if (encoded.includes('wifiValue')) result.push('wifi');
  }
  return result;
}

function resourceRequirements(document: CapiRulesDocument) {
  const deviceIds = new Set(document.tasks.flatMap(task => task.output.flatMap(instruction => ['led', 'traffic', 'motor', 'robot', 'otto', 'ottoSound', 'ottoExpression', 'ottoArms', 'servo', 'buzzer', 'tone'].includes(instruction.op) && 'deviceId' in instruction ? [instruction.deviceId] : [])));
  const pwmPins = new Set<number>();
  for (const device of document.resources.devices) {
    if (!deviceIds.has(device.id)) continue;
    const keys = device.kind === 'trafficLight' ? ['red', 'yellow', 'green']
      : device.kind === 'robot' ? ['leftIn1', 'leftIn2', 'rightIn1', 'rightIn2']
        : device.kind === 'motor' ? ['in1', 'in2']
          : device.kind === 'otto' ? ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'leftArm', 'rightArm', 'buzzer']
            : ['signal'];
    for (const key of keys) {
      const value = device.pins[key as keyof typeof device.pins];
      if (typeof value === 'number') pwmPins.add(value);
    }
  }
  return { pwmChannels: pwmPins.size };
}

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function canonical(value: unknown): string | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonical(item) ?? 'null').join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().flatMap(key => { const encoded = canonical(object[key]); return encoded === undefined ? [] : [`${JSON.stringify(key)}:${encoded}`]; }).join(',')}}`;
}

function checksumHex(value: number) { return value.toString(16).padStart(8, '0'); }

export function createCapiRules(programInput: CompiledProgram, scene: SceneDefinition, board: BoardProfileId): CapiRulesBundle {
  const program = normalizeCompiledProgram(programInput, scene);
  const errors = validateProgramForScene(program, scene, board).filter(item => item.severity === 'error');
  if (errors.length) throw new CapiRulesError(errors[0].message);
  const tasks = compileTaskGraph(program);
  if (scene.devices.filter(device => device.kind === 'messages').length > 1)
    throw new CapiRulesError('El intérprete rápido admite un componente Mensajes por placa. El modo nativo conserva hasta dos.');
  if (scene.devices.filter(device => device.kind === 'otto').length > 1)
    throw new CapiRulesError('El intérprete rápido admite un robot Otto por placa. El modo nativo conserva proyectos avanzados con más de uno.');
  const instructionCount = tasks.reduce((total, task) => total + task.output.length, 0);
  if (instructionCount > CAPI_RULES_MAX_INSTRUCTIONS) throw new CapiRulesError(`El programa tiene ${instructionCount} instrucciones; el intérprete admite hasta ${CAPI_RULES_MAX_INSTRUCTIONS}.`);
  const blockIds = [...new Set(tasks.flatMap(task => task.output.map(item => item.blockId)))];
  const document: CapiRulesDocument = {
    format: 'CapiRules', version: CAPI_RULES_FORMAT, abi: CAPI_INTERPRETER_ABI, board,
    resources: scene, variables: program.variables ?? [], timers: program.timers ?? [], tasks,
    initial: { taskIds: tasks.filter(task => task.initial).map(task => task.id) },
    debug: { blockIds },
  };
  const payload = new TextEncoder().encode(canonical(document) ?? '{}');
  if (payload.length + HEADER_BYTES > CAPI_RULES_MAX_BYTES) throw new CapiRulesError(`Las reglas ocupan ${payload.length + HEADER_BYTES} bytes; el máximo es ${CAPI_RULES_MAX_BYTES}.`);
  const payloadCrc = crc32(payload);
  const bytes = new Uint8Array(HEADER_BYTES + payload.length);
  bytes.set(MAGIC, 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(8, CAPI_RULES_FORMAT, true);
  view.setUint16(10, CAPI_INTERPRETER_ABI, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, payloadCrc, true);
  view.setUint32(20, instructionCount, true);
  view.setUint32(24, scene.devices.length, true);
  view.setUint32(28, tasks.length, true);
  bytes.set(payload, HEADER_BYTES);
  const capabilities = tasks.flatMap(task => task.output.flatMap(instructionCapabilities));
  const usedDeviceIds = new Set(tasks.flatMap(task => task.output.flatMap(instruction => 'deviceId' in instruction ? [instruction.deviceId] : [])));
  for (const device of scene.devices) if (device.kind === 'display' && usedDeviceIds.has(device.id)) {
    capabilities.push(['lcd1602', 'lcd2004', 'lcd1602keypad'].includes(device.config.profile) ? 'display-lcd' : 'display-graphic');
    capabilities.push(`display-${device.config.profile}`);
    if (device.config.profile === 'lcd1602keypad') capabilities.push('display-keypad');
  }
  const requiredCapabilities = [...new Set(capabilities)].sort();
  return { bytes, document, checksum: checksumHex(payloadCrc), instructionCount, requiredCapabilities, resourceRequirements: resourceRequirements(document) };
}

export function parseCapiRules(bytes: Uint8Array, expectedBoard?: BoardProfileId): CapiRulesBundle {
  if (bytes.length < HEADER_BYTES || bytes.length > CAPI_RULES_MAX_BYTES || !MAGIC.every((byte, index) => bytes[index] === byte)) throw new CapiRulesError('El paquete de reglas no es válido.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(8, true), abi = view.getUint16(10, true), size = view.getUint32(12, true), expectedCrc = view.getUint32(16, true);
  if (version !== CAPI_RULES_FORMAT || abi !== CAPI_INTERPRETER_ABI || size !== bytes.length - HEADER_BYTES) throw new CapiRulesError('Las reglas usan una versión incompatible.');
  const payload = bytes.subarray(HEADER_BYTES);
  if (crc32(payload) !== expectedCrc) throw new CapiRulesError('Las reglas llegaron dañadas.');
  let document: CapiRulesDocument;
  try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)); } catch { throw new CapiRulesError('Las reglas no contienen datos válidos.'); }
  if (document.format !== 'CapiRules' || document.version !== version || document.abi !== abi || !isBoardProfileId(document.board) || (expectedBoard && document.board !== expectedBoard)) throw new CapiRulesError('Las reglas no corresponden a esta placa.');
  if (!Array.isArray(document.tasks) || !Array.isArray(document.variables) || !Array.isArray(document.timers) || document.tasks.length !== view.getUint32(28, true) || !Array.isArray(document.resources?.devices) || document.resources.devices.length !== view.getUint32(24, true)) throw new CapiRulesError('Las reglas tienen una tabla incompleta.');
  const instructionCount = document.tasks.reduce((total, task) => total + (Array.isArray(task.output) ? task.output.length : CAPI_RULES_MAX_INSTRUCTIONS + 1), 0);
  if (instructionCount !== view.getUint32(20, true) || instructionCount > CAPI_RULES_MAX_INSTRUCTIONS) throw new CapiRulesError('Las reglas exceden los límites del intérprete.');
  const requiredCapabilities = [...new Set(document.tasks.flatMap(task => task.output.flatMap(instructionCapabilities)))].sort();
  return { bytes, document, checksum: checksumHex(expectedCrc), instructionCount, requiredCapabilities, resourceRequirements: resourceRequirements(document) };
}
