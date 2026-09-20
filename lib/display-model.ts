// @ts-expect-error Node strip-types runners need the explicit extension.
import { defaultDisplayArtworks, DISPLAY_ART_HEIGHT, MAX_DISPLAY_ARTWORKS, type DisplayAnimationSpeed, type DisplayArtwork } from './display-graphics.ts';

/** Portable text destinations. Coordinates are character cells, not GPIOs. */
export const displayProfiles = {
  lcd1602keypad: {
    name: 'Pantalla con botones 16 × 2 · paralelo',
    bus: 'parallel',
    graphic: false,
    keypad: true,
    columns: 16,
    rows: 2,
    width: 16,
    height: 2,
    address: 0,
  },
  lcd1602: {
    name: 'LCD 16 × 2 · PCF8574 I2C',
    bus: 'i2c',
    graphic: false,
    keypad: false,
    columns: 16,
    rows: 2,
    width: 16,
    height: 2,
    address: 0x27,
  },
  lcd2004: {
    name: 'LCD 20 × 4 · PCF8574 I2C',
    bus: 'i2c',
    graphic: false,
    keypad: false,
    columns: 20,
    rows: 4,
    width: 20,
    height: 4,
    address: 0x27,
  },
  ssd1306: {
    name: 'OLED SSD1306 128 × 64 · I2C',
    bus: 'i2c',
    graphic: true,
    keypad: false,
    columns: 16,
    rows: 8,
    width: 128,
    height: 64,
    address: 0x3c,
  },
  ili9341: {
    name: 'TFT ILI9341 320 × 240 · SPI',
    bus: 'spi',
    graphic: true,
    keypad: false,
    columns: 26,
    rows: 15,
    width: 320,
    height: 240,
    address: 0,
  },
  ili9488: {
    name: 'TFT ILI9488 480 × 320 · SPI',
    bus: 'spi',
    graphic: true,
    keypad: false,
    columns: 40,
    rows: 20,
    width: 480,
    height: 320,
    address: 0,
  },
} as const;

export type DisplayProfile = keyof typeof displayProfiles;
export type TextArea = {
  id: string;
  name: string;
  column: number;
  row: number;
  columns: number;
  rows: number;
};
export type DisplayConfig = {
  profile: DisplayProfile;
  address: number;
  areas: TextArea[];
  retiredAreaIds: string[];
  /** Optional only so projects exported before drawings existed remain valid. */
  animationSpeed?: DisplayAnimationSpeed;
  artworks?: DisplayArtwork[];
  retiredArtworkIds?: string[];
};
export const DISPLAY_SCREEN = 'screen';
export const MAX_DISPLAY_TEXT = 512;
export const displayPinKeys = [
  'sda',
  'scl',
  'sck',
  'mosi',
  'cs',
  'dc',
  'rst',
  'rs',
  'en',
  'd4',
  'd5',
  'd6',
  'd7',
  'backlight',
  'keys',
] as const;
export type DisplayPinKey = (typeof displayPinKeys)[number];
export const displayPins = () =>
  Object.fromEntries(displayPinKeys.map((key) => [key, null])) as Record<
    DisplayPinKey,
    number | null
  >;

export function displayConfig(
  profile: DisplayProfile = 'lcd1602',
): DisplayConfig {
  return {
    profile,
    address: displayProfiles[profile].address,
    areas: displayProfiles[profile].graphic
      ? [
          {
            id: 'text-1',
            name: 'Mensaje',
            column: 0,
            row: 0,
            columns: 16,
            rows: 4,
          },
        ]
      : [],
    retiredAreaIds: [],
    animationSpeed: 'normal',
    artworks: displayProfiles[profile].graphic ? defaultDisplayArtworks() : [],
    retiredArtworkIds: [],
  };
}

export function displayArtworks(config: DisplayConfig) {
  return config.artworks ?? [];
}

export function retiredDisplayArtworkIds(config: DisplayConfig) {
  return config.retiredArtworkIds ?? [];
}

export function nextDisplayArtworkId(config: DisplayConfig) {
  const taken = new Set([
    ...displayArtworks(config).map((item) => item.id),
    ...retiredDisplayArtworkIds(config),
  ]);
  for (let index = 1; index <= MAX_DISPLAY_ARTWORKS; index += 1) {
    const id = `mi-dibujo-${index}`;
    if (!taken.has(id)) return id;
  }
  return '';
}

export function displayTargets(config: DisplayConfig): TextArea[] {
  const profile = displayProfiles[config.profile];
  return profile.graphic
    ? config.areas
    : [
        {
          id: DISPLAY_SCREEN,
          name: 'Pantalla completa',
          column: 0,
          row: 0,
          columns: profile.columns,
          rows: profile.rows,
        },
      ];
}

export function requiredDisplayPins(
  config: DisplayConfig,
): readonly DisplayPinKey[] {
  const bus = displayProfiles[config.profile].bus;
  if (bus === 'i2c') return ['sda', 'scl'];
  if (bus === 'parallel')
    return ['rs', 'en', 'd4', 'd5', 'd6', 'd7', 'backlight', 'keys'];
  return ['sck', 'mosi', 'cs', 'dc', 'rst'];
}

export function nextTextAreaId(config: DisplayConfig) {
  const taken = new Set([
    ...config.areas.map((area) => area.id),
    ...config.retiredAreaIds,
  ]);
  let index = 1;
  while (taken.has(`text-${index}`)) index++;
  return `text-${index}`;
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const integer = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= low &&
  value <= high;
const label = (value: unknown, maximum: number): value is string => {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    return false;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (
      code < 32 ||
      code === 127 ||
      code === 0x2028 ||
      code === 0x2029 ||
      (code >= 0xd800 && code <= 0xdfff)
    )
      return false;
  }
  return true;
};

export function validDisplayConfig(
  value: unknown,
  incompleteLayout = false,
): value is DisplayConfig {
  if (
    !record(value) ||
    !(
      exact(value, ['profile', 'address', 'areas', 'retiredAreaIds']) ||
      exact(value, [
        'profile',
        'address',
        'areas',
        'retiredAreaIds',
        'animationSpeed',
        'artworks',
        'retiredArtworkIds',
      ])
    ) ||
    typeof value.profile !== 'string' ||
    !Object.hasOwn(displayProfiles, value.profile)
  )
    return false;
  const profile = displayProfiles[value.profile as DisplayProfile];
  const addresses =
    value.profile === 'ssd1306'
      ? [0x3c, 0x3d]
      : Array.from({ length: 16 }, (_, index) =>
          index < 8 ? 0x20 + index : 0x30 + index,
        );
  if (
    !integer(value.address, 0, 127) ||
    (profile.bus === 'spi' || profile.bus === 'parallel'
      ? value.address !== 0
      : !addresses.includes(value.address))
  )
    return false;
  if (Object.hasOwn(value, 'animationSpeed')) {
    if (!['slow', 'normal', 'fast'].includes(String(value.animationSpeed))) return false;
    if (!Array.isArray(value.artworks) || value.artworks.length > MAX_DISPLAY_ARTWORKS)
      return false;
    if (!profile.graphic && value.artworks.length) return false;
    if (!Array.isArray(value.retiredArtworkIds) || value.retiredArtworkIds.length > 4096)
      return false;
    const artworkIds = new Set<string>();
    const artworkNames = new Set<string>();
    for (const item of value.artworks) {
      if (
        !record(item) ||
        !exact(item, ['id', 'name', 'rows']) ||
        typeof item.id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{0,31}$/.test(item.id) ||
        artworkIds.has(item.id) ||
        !label(item.name, 30) ||
        artworkNames.has(item.name.trim().toLocaleLowerCase('es')) ||
        !Array.isArray(item.rows) ||
        item.rows.length !== DISPLAY_ART_HEIGHT ||
        !item.rows.every((row) => integer(row, 0, 0xffff))
      )
        return false;
      artworkIds.add(item.id);
      artworkNames.add(item.name.trim().toLocaleLowerCase('es'));
    }
    for (const id of value.retiredArtworkIds) {
      if (
        typeof id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{0,31}$/.test(id) ||
        artworkIds.has(id)
      )
        return false;
      artworkIds.add(id);
    }
  }
  if (
    !Array.isArray(value.areas) ||
    value.areas.length > 8 ||
    (!profile.graphic && value.areas.length > 0) ||
    !Array.isArray(value.retiredAreaIds) ||
    value.retiredAreaIds.length > 4096
  )
    return false;
  const ids = new Set<string>([DISPLAY_SCREEN]);
  const names = new Set<string>();
  for (const area of value.areas) {
    if (
      !record(area) ||
      !exact(area, ['id', 'name', 'column', 'row', 'columns', 'rows']) ||
      !label(area.id, 128) ||
      ids.has(area.id) ||
      !(incompleteLayout
        ? typeof area.name === 'string' && area.name.length <= 40
        : label(area.name, 40))
    )
      return false;
    const name = (area.name as string)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (
      incompleteLayout
        ? !['column', 'row', 'columns', 'rows'].every(
            (key) =>
              typeof area[key] === 'number' &&
              Number.isFinite(area[key]) &&
              Math.abs(area[key] as number) <= 4096,
          )
        : names.has(name) ||
          !integer(area.column, 0, profile.columns - 1) ||
          !integer(area.row, 0, profile.rows - 1) ||
          !integer(area.columns, 1, profile.columns - area.column) ||
          !integer(area.rows, 1, profile.rows - area.row)
    )
      return false;
    ids.add(area.id);
    names.add(name);
  }
  for (const id of value.retiredAreaIds) {
    if (!label(id, 128) || ids.has(id)) return false;
    ids.add(id);
  }
  const areas = value.areas as TextArea[];
  return (
    incompleteLayout ||
    !areas.some((area, i) =>
      areas
        .slice(i + 1)
        .some(
          (other) =>
            area.column < other.column + other.columns &&
            other.column < area.column + area.columns &&
            area.row < other.row + other.rows &&
            other.row < area.row + area.rows,
        ),
    )
  );
}

/** Common, explicit ASCII repertoire; preview and firmware receive identical cells. */
export function portableDisplayText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/¿/g, '?')
    .replace(/¡/g, '!')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // HD44780 ROM A00 uses these ASCII positions for yen/an arrow.
    .replace(/[\\~]/g, '?')
    .replace(/[^\x20-\x7e\n]/gu, '?');
}

export function layoutDisplayText(
  text: string,
  area: Pick<TextArea, 'columns' | 'rows'>,
) {
  const portable = portableDisplayText(text);
  const cells = Array<string>(area.columns * area.rows).fill(' ');
  let cursor = 0;
  let clipped = false;
  let justWrapped = false;
  for (const character of portable) {
    if (character === '\n') {
      // A newline following an exactly full line starts the next line, not an empty extra one.
      if (!justWrapped) cursor += area.columns - (cursor % area.columns);
      justWrapped = false;
    } else {
      if (cursor < cells.length) cells[cursor++] = character;
      else clipped = true;
      justWrapped = cursor % area.columns === 0;
    }
  }
  return {
    cells: cells.join(''),
    lines: Array.from({ length: area.rows }, (_, row) =>
      cells.slice(row * area.columns, (row + 1) * area.columns).join(''),
    ),
    converted: portable !== text,
    clipped,
  };
}
