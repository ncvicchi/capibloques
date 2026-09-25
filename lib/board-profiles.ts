export type BoardProfileId =
  | 'wemos-d1-r32'
  | 'diymall-esp32-s3-devkitc-v1-n16r8'
  | 'waveshare-esp32-s3-touch-lcd-5-28117';

export type PinCapability = 'pwmOutput' | 'digitalInput' | 'analogInput';

export interface BoardPinDefinition {
  gpio: number;
  label: string;
  capabilities: readonly PinCapability[];
  recommended: boolean;
  note?: string;
}

export interface BoardProfile {
  id: BoardProfileId;
  name: string;
  shortName: string;
  family: 'esp32' | 'esp32-s3';
  chip: 'ESP32' | 'ESP32-S3';
  idfTarget: 'esp32' | 'esp32s3';
  fqbn: 'esp32:esp32:d1_uno32' | 'esp32:esp32:esp32s3';
  flashBytes: number;
  flashSize: '4MB' | '16MB';
  psramBytes: number;
  pwmChannels: number;
  pins: readonly BoardPinDefinition[];
  safeOutputPins: readonly number[];
  safeDigitalInputPins: readonly number[];
  safeAnalogInputPins: readonly number[];
}

export interface CentralDisplayTarget {
  boardProfile: 'waveshare-esp32-s3-touch-lcd-5-28117';
  hardwareId?: string;
  ssid?: string;
}

type OptionalCentralDisplay = { centralDisplay?: CentralDisplayTarget };

export type ProjectTarget = (
  | {
      family: 'esp32';
      framework: 'arduino';
      coreMajor: 3;
      coreVersion: '3.3.11';
      boardProfile: 'wemos-d1-r32';
      fqbn: 'esp32:esp32:d1_uno32';
    }
  | {
      family: 'esp32-s3';
      framework: 'arduino';
      coreMajor: 3;
      coreVersion: '3.3.11';
      boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8';
      fqbn: 'esp32:esp32:esp32s3';
    }
  | {
      family: 'esp32-s3';
      framework: 'arduino';
      coreMajor: 3;
      coreVersion: '3.3.11';
      boardProfile: 'waveshare-esp32-s3-touch-lcd-5-28117';
      fqbn: 'esp32:esp32:esp32s3';
    }) & OptionalCentralDisplay;

export const WEMOS_PROFILE_ID: BoardProfileId = 'wemos-d1-r32';
export const DIYMALL_S3_PROFILE_ID: BoardProfileId =
  'diymall-esp32-s3-devkitc-v1-n16r8';
export const WAVESHARE_TOUCH_LCD_5_PROFILE_ID: BoardProfileId =
  'waveshare-esp32-s3-touch-lcd-5-28117';

export const wemosD1R32Pins: readonly BoardPinDefinition[] = [
  { gpio: 26, label: 'D2', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 25, label: 'D3', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 17, label: 'D4', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 16, label: 'D5', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 27, label: 'D6', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 14, label: 'D7', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 13, label: 'D9', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 23, label: 'D11', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 19, label: 'D12', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 18, label: 'D13', capabilities: ['pwmOutput', 'digitalInput'], recommended: true },
  { gpio: 4, label: 'A1', capabilities: ['pwmOutput', 'digitalInput'], recommended: true, note: 'Preferido para botón; su ADC pertenece a ADC2.' },
  { gpio: 35, label: 'A2', capabilities: ['digitalInput', 'analogInput'], recommended: true, note: 'ADC1, solo entrada y sin resistencia pull-up interna.' },
  { gpio: 34, label: 'A3', capabilities: ['digitalInput', 'analogInput'], recommended: true, note: 'ADC1, solo entrada y sin resistencia pull-up interna.' },
  { gpio: 36, label: 'A4', capabilities: ['digitalInput', 'analogInput'], recommended: true, note: 'ADC1, solo entrada y sin resistencia pull-up interna.' },
  { gpio: 39, label: 'A5', capabilities: ['digitalInput', 'analogInput'], recommended: true, note: 'ADC1, solo entrada y sin resistencia pull-up interna.' },
] as const;

const s3Pin = (
  gpio: number,
  capabilities: readonly PinCapability[],
  recommended = true,
  note?: string,
): BoardPinDefinition => ({ gpio, label: `IO${gpio}`, capabilities, recommended, note });

/**
 * DIYmall ESP32-S3-DevKitC V1.0 measured on 2026-09-19: ESP32-S3 rev 0.2,
 * 16 MiB Quad flash and 8 MiB Octal PSRAM. Header layout follows DevKitC-1
 * v1.0. GPIO35-37 are deliberately unavailable because Octal PSRAM uses them.
 */
export const diymallS3DevKitPins: readonly BoardPinDefinition[] = [
  s3Pin(1, ['pwmOutput', 'digitalInput', 'analogInput']),
  s3Pin(2, ['pwmOutput', 'digitalInput', 'analogInput']),
  s3Pin(3, ['digitalInput', 'analogInput'], false, 'Pin de arranque; no se asigna automáticamente.'),
  ...[4, 5, 6, 7, 8, 9, 10].map(gpio => s3Pin(gpio, ['pwmOutput', 'digitalInput', 'analogInput'])),
  ...[11, 12, 13, 14, 15, 16, 17, 18].map(gpio => s3Pin(gpio, ['pwmOutput', 'digitalInput'])),
  s3Pin(19, ['pwmOutput', 'digitalInput'], false, 'USB nativo D−; evitá usarlo con ese conector.'),
  s3Pin(20, ['pwmOutput', 'digitalInput'], false, 'USB nativo D+; evitá usarlo con ese conector.'),
  s3Pin(21, ['pwmOutput', 'digitalInput']),
  ...[38, 39, 40, 41, 42].map(gpio => s3Pin(gpio, ['pwmOutput', 'digitalInput'])),
  s3Pin(43, ['pwmOutput', 'digitalInput'], false, 'UART0 TX conectado al puente CP210x.'),
  s3Pin(44, ['pwmOutput', 'digitalInput'], false, 'UART0 RX conectado al puente CP210x.'),
  s3Pin(45, ['pwmOutput', 'digitalInput'], false, 'Pin de arranque; no se asigna automáticamente.'),
  s3Pin(46, ['digitalInput'], false, 'Entrada y pin de arranque; no se asigna automáticamente.'),
  s3Pin(47, ['pwmOutput', 'digitalInput']),
  s3Pin(48, ['pwmOutput', 'digitalInput'], false, 'LED RGB integrado de la revisión v1.0.'),
  s3Pin(0, ['digitalInput'], false, 'BOOT; no se asigna automáticamente.'),
] as const;

export const boardProfiles: Record<BoardProfileId, BoardProfile> = {
  'wemos-d1-r32': {
    id: 'wemos-d1-r32', name: 'Wemos D1 R32', shortName: 'Wemos', family: 'esp32', chip: 'ESP32', idfTarget: 'esp32',
    fqbn: 'esp32:esp32:d1_uno32', flashBytes: 4 * 1024 * 1024, flashSize: '4MB', psramBytes: 0, pwmChannels: 16,
    pins: wemosD1R32Pins,
    safeOutputPins: [26, 25, 27, 17, 16, 23, 19, 18, 14, 13],
    safeDigitalInputPins: [4, 26, 25, 27, 17, 16, 23, 19, 18, 14, 13],
    safeAnalogInputPins: [35, 34, 36, 39],
  },
  'diymall-esp32-s3-devkitc-v1-n16r8': {
    id: 'diymall-esp32-s3-devkitc-v1-n16r8', name: 'DIYmall ESP32-S3-DevKitC V1.0 · 16 MB + 8 MB PSRAM', shortName: 'DIYmall S3',
    family: 'esp32-s3', chip: 'ESP32-S3', idfTarget: 'esp32s3', fqbn: 'esp32:esp32:esp32s3', flashBytes: 16 * 1024 * 1024,
    flashSize: '16MB', psramBytes: 8 * 1024 * 1024, pwmChannels: 8, pins: diymallS3DevKitPins,
    safeOutputPins: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47],
    safeDigitalInputPins: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47],
    safeAnalogInputPins: [1, 2, 4, 5, 6, 7, 8, 9, 10],
  },
  'waveshare-esp32-s3-touch-lcd-5-28117': {
    id: 'waveshare-esp32-s3-touch-lcd-5-28117',
    name: 'Waveshare ESP32-S3 Touch LCD 5 · SKU 28117 · 800 × 480',
    shortName: 'Waveshare 5″', family: 'esp32-s3', chip: 'ESP32-S3', idfTarget: 'esp32s3',
    fqbn: 'esp32:esp32:esp32s3', flashBytes: 16 * 1024 * 1024, flashSize: '16MB',
    psramBytes: 8 * 1024 * 1024, pwmChannels: 8,
    // La pantalla RGB, touch, USB, microSD, CAN y RS485 ocupan los GPIO del módulo.
    // Los bornes CAN/RS485 y las E/S aisladas no son GPIO genéricos y no se ofrecen
    // para autoconectar componentes escolares.
    pins: [], safeOutputPins: [], safeDigitalInputPins: [], safeAnalogInputPins: [],
  },
};

export const boardProfile = (id: BoardProfileId) => boardProfiles[id];

export function projectTargetForBoard(id: BoardProfileId): ProjectTarget {
  if (id === WEMOS_PROFILE_ID) return {
        family: 'esp32', framework: 'arduino', coreMajor: 3, coreVersion: '3.3.11',
        boardProfile: 'wemos-d1-r32', fqbn: 'esp32:esp32:d1_uno32',
      };
  if (id === DIYMALL_S3_PROFILE_ID) return {
        family: 'esp32-s3', framework: 'arduino', coreMajor: 3, coreVersion: '3.3.11',
        boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8', fqbn: 'esp32:esp32:esp32s3',
      };
  return {
    family: 'esp32-s3', framework: 'arduino', coreMajor: 3, coreVersion: '3.3.11',
    boardProfile: 'waveshare-esp32-s3-touch-lcd-5-28117', fqbn: 'esp32:esp32:esp32s3',
  };
}

export function isProjectTarget(value: unknown): value is ProjectTarget {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectTarget>;
  if (!isBoardProfileId(candidate.boardProfile)) return false;
  const expected = projectTargetForBoard(candidate.boardProfile);
  const central = (candidate as ProjectTarget).centralDisplay;
  return (
    candidate.family === expected.family &&
    candidate.framework === expected.framework &&
    candidate.coreMajor === expected.coreMajor &&
    candidate.coreVersion === expected.coreVersion &&
    candidate.fqbn === expected.fqbn &&
    (central === undefined || (
      central?.boardProfile === WAVESHARE_TOUCH_LCD_5_PROFILE_ID &&
      (central.hardwareId === undefined || /^[A-F0-9]{12}$/.test(central.hardwareId)) &&
      (central.ssid === undefined || /^WS[A-F0-9]{6}$/.test(central.ssid)) &&
      (!central.hardwareId || !central.ssid || central.ssid === `WS${central.hardwareId.slice(-6)}`)
    ))
  );
}

export function portableProjectTarget(target: ProjectTarget): ProjectTarget {
  const base = projectTargetForBoard(target.boardProfile);
  if (!target.centralDisplay) return base;
  return {
    ...base,
    centralDisplay: {
      boardProfile: 'waveshare-esp32-s3-touch-lcd-5-28117',
      ...(target.centralDisplay.hardwareId ? { hardwareId: target.centralDisplay.hardwareId } : {}),
      ...(target.centralDisplay.ssid ? { ssid: target.centralDisplay.ssid } : {}),
    },
  };
}

export function isBoardProfileId(value: unknown): value is BoardProfileId {
  return typeof value === 'string' && value in boardProfiles;
}

export function boardPinLabel(id: BoardProfileId, pin: number | null | undefined) {
  if (pin == null) return undefined;
  return boardProfile(id).pins.find(item => item.gpio === pin)?.label;
}
