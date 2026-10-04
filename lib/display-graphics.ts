export const DISPLAY_ART_WIDTH = 16;
export const DISPLAY_ART_HEIGHT = 8;
export const MAX_DISPLAY_ARTWORKS = 12;

export type DisplayAnimationSpeed = 'slow' | 'normal' | 'fast';
export type DisplayTextEffect =
  | 'type'
  | 'scroll'
  | 'scroll-right'
  | 'scroll-up'
  | 'scroll-down'
  | 'blink'
  | 'sequence'
  | 'bounce'
  | 'blinds'
  | 'center';
export type DisplayArtworkEffect =
  | 'still'
  | 'slide'
  | 'slide-right'
  | 'blink'
  | 'blinds'
  | 'center'
  | 'invert';

export const DISPLAY_TEXT_EFFECTS: readonly { value: DisplayTextEffect; label: string }[] = [
  { value: 'type', label: 'máquina de escribir' },
  { value: 'sequence', label: 'letras en secuencia' },
  { value: 'scroll', label: 'entrar desde la derecha' },
  { value: 'scroll-right', label: 'entrar desde la izquierda' },
  { value: 'scroll-up', label: 'subir por filas' },
  { value: 'scroll-down', label: 'bajar por filas' },
  { value: 'bounce', label: 'rebotar' },
  { value: 'blinds', label: 'persiana' },
  { value: 'center', label: 'abrir desde el centro' },
  { value: 'blink', label: 'parpadear' },
];

export const DISPLAY_ARTWORK_EFFECTS: readonly { value: DisplayArtworkEffect; label: string }[] = [
  { value: 'still', label: 'quieto' }, { value: 'slide', label: 'entrar desde la derecha' },
  { value: 'slide-right', label: 'entrar desde la izquierda' }, { value: 'blinds', label: 'persiana' },
  { value: 'center', label: 'abrir desde el centro' }, { value: 'invert', label: 'invertir' },
  { value: 'blink', label: 'parpadear' },
];

export function displayTextEffectSteps(effect: DisplayTextEffect, columns: number, rows: number, cells: number) {
  if (effect === 'type' || effect === 'sequence') return Math.min(24, Math.max(1, cells));
  if (effect === 'scroll' || effect === 'scroll-right' || effect === 'bounce') return Math.max(1, columns) * (effect === 'bounce' ? 2 : 1);
  if (effect === 'scroll-up' || effect === 'scroll-down') return Math.max(1, rows);
  if (effect === 'blink') return 5;
  return Math.max(1, Math.ceil(columns / 2));
}

export function displayArtworkEffectSteps(effect: DisplayArtworkEffect) {
  if (effect === 'still') return 1;
  if (effect === 'slide' || effect === 'slide-right') return 16;
  if (effect === 'blink' || effect === 'invert') return 5;
  return 8;
}

export interface DisplayArtwork {
  id: string;
  name: string;
  rows: number[];
}

function rowsFromArt(art: readonly string[]) {
  return Array.from({ length: DISPLAY_ART_HEIGHT }, (_, y) => {
    let value = 0;
    const row = art[y] ?? '';
    for (let x = 0; x < DISPLAY_ART_WIDTH; x += 1)
      if (row[x] === '#') value += 2 ** (DISPLAY_ART_WIDTH - 1 - x);
    return value;
  });
}

const artwork = (id: string, name: string, art: readonly string[]): DisplayArtwork => ({
  id,
  name,
  rows: rowsFromArt(art),
});

/** Shared, tiny monochrome pictures that fit OLED and TFT without large assets. */
export const BUILTIN_DISPLAY_ARTWORKS: readonly DisplayArtwork[] = [
  artwork('builtin-heart', '❤️ Corazón', [
    '................',
    '..###....###.....',
    '.#####..#####....',
    '.############....',
    '..##########.....',
    '...########......',
    '.....####........',
    '......##.........',
  ]),
  artwork('builtin-star', '⭐ Estrella', [
    '.......##.......',
    '.......##.......',
    '..############..',
    '...##########...',
    '....######......',
    '...###..###.....',
    '..##......##....',
    '................',
  ]),
  artwork('builtin-smile', '😊 Sonrisa', [
    '....########....',
    '..##........##..',
    '.##..##..##..##.',
    '.##..........##.',
    '.##.##....##.##.',
    '.##..######..##.',
    '..##........##..',
    '....########....',
  ]),
  artwork('builtin-capybara', '🦦 Capibara', [
    '................',
    '..##########....',
    '.############...',
    '.##..##....###..',
    '.##############.',
    '..############..',
    '...##......##...',
    '..###......###..',
  ]),
  artwork('builtin-robot', '🤖 Robot', [
    '.......##.......',
    '...##########...',
    '..############..',
    '..##..####..##..',
    '..############..',
    '...##.####.##...',
    '...##########...',
    '....##....##....',
  ]),
  artwork('builtin-cat', '🐱 Gato', [
    '..##........##..',
    '..####....####..',
    '..############..',
    '.##############.',
    '.###..######..##',
    '.##############.',
    '..###.####.###..',
    '....########....',
  ]),
  artwork('builtin-flower', '🌼 Flor', [
    '.....##..##.....',
    '....########....',
    '.....######.....',
    '.......##.......',
    '...##..##..##...',
    '....########....',
    '.......##.......',
    '......####......',
  ]),
] as const;

export function defaultDisplayArtworks(): DisplayArtwork[] {
  return [
    {
      id: 'mi-dibujo-1',
      name: 'Mi dibujo 1',
      rows: Array.from({ length: DISPLAY_ART_HEIGHT }, () => 0),
    },
  ];
}

export function displayAnimationMs(speed: DisplayAnimationSpeed | undefined) {
  return speed === 'slow' ? 400 : speed === 'fast' ? 100 : 200;
}

export function displayArtworkPixel(
  rows: readonly number[],
  x: number,
  y: number,
  enabled: boolean,
) {
  const next = Array.from({ length: DISPLAY_ART_HEIGHT }, (_, row) => rows[row] ?? 0);
  const column = Math.max(0, Math.min(DISPLAY_ART_WIDTH - 1, Math.round(x)));
  const row = Math.max(0, Math.min(DISPLAY_ART_HEIGHT - 1, Math.round(y)));
  const bit = 2 ** (DISPLAY_ART_WIDTH - 1 - column);
  const current = next[row];
  next[row] = enabled
    ? current + (current % (bit * 2) < bit ? bit : 0)
    : current - (current % (bit * 2) >= bit ? bit : 0);
  return next;
}

export function displayArtworkById(
  custom: readonly DisplayArtwork[] | undefined,
  id: string,
) {
  return (
    BUILTIN_DISPLAY_ARTWORKS.find((item) => item.id === id) ??
    custom?.find((item) => item.id === id)
  );
}
