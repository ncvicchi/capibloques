export const MATRIX_WIDTH = 32;
export const MATRIX_HEIGHT = 8;
export const MAX_MATRIX_PATTERNS = 12;
export const MAX_MATRIX_TEXT = 32;

export type MatrixOrder = 'left-to-right' | 'right-to-left';
export type MatrixOrientation = 'normal' | 'rotated';

export interface MatrixPattern {
  id: string;
  name: string;
  rows: number[];
}

export interface LedMatrixConfig extends Record<string, unknown> {
  brightness: number;
  order: MatrixOrder;
  orientation: MatrixOrientation;
  patterns: MatrixPattern[];
}

function rowsFromArt(art: readonly string[]) {
  return art.map(row => {
    let value = 0;
    for (let x = 0; x < MATRIX_WIDTH; x += 1) if (row[x] === '#') value += 2 ** (MATRIX_WIDTH - 1 - x);
    return value;
  });
}

const pattern = (id: string, name: string, art: readonly string[]): MatrixPattern => ({ id, name, rows: rowsFromArt(art) });

export const defaultMatrixPatterns = (): MatrixPattern[] => [
  pattern('heart', 'Corazón', [
    '................................',
    '....###...###.....................',
    '...#####.#####....................',
    '...###########....................',
    '....#########.....................',
    '.....#######......................',
    '.......###........................',
    '........#.........................',
  ]),
  pattern('arrow', 'Flecha', [
    '..............#.................',
    '..............##................',
    '#################...............',
    '##################..............',
    '#################...............',
    '..............##................',
    '..............#.................',
    '................................',
  ]),
  pattern('smile', 'Sonrisa', [
    '......####################......',
    '....##....................##....',
    '...##....###........###....##...',
    '..##........................##..',
    '..##...##..............##...##..',
    '...##...################...##...',
    '....##....................##....',
    '......####################......',
  ]),
];

export function ledMatrixConfig(changes: Partial<LedMatrixConfig> = {}): LedMatrixConfig {
  return {
    brightness: 5,
    // El panel físico 4 × MAX7219 verificado recibe DIN por el extremo
    // derecho visto de frente. El orden lógico de CapiBloques sigue siendo
    // izquierda → derecha; el firmware invierte la cadena al transmitir.
    order: 'right-to-left',
    orientation: 'normal',
    patterns: defaultMatrixPatterns(),
    ...changes,
  };
}

const plainRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => key in value);

export function validMatrixConfig(value: unknown): value is LedMatrixConfig {
  if (!plainRecord(value) || !exactKeys(value, ['brightness', 'order', 'orientation', 'patterns'])) return false;
  if (!Number.isInteger(value.brightness) || Number(value.brightness) < 0 || Number(value.brightness) > 15) return false;
  if (!['left-to-right', 'right-to-left'].includes(String(value.order)) || !['normal', 'rotated'].includes(String(value.orientation))) return false;
  if (!Array.isArray(value.patterns) || value.patterns.length < 1 || value.patterns.length > MAX_MATRIX_PATTERNS) return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.patterns.every(item => {
    if (!plainRecord(item) || !exactKeys(item, ['id', 'name', 'rows'])) return false;
    if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(item.id) || ids.has(item.id)) return false;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 30 || names.has(item.name.trim().toLocaleLowerCase('es'))) return false;
    if (!Array.isArray(item.rows) || item.rows.length !== MATRIX_HEIGHT || !item.rows.every(row => Number.isInteger(row) && row >= 0 && row <= 0xFFFFFFFF)) return false;
    ids.add(item.id); names.add(item.name.trim().toLocaleLowerCase('es')); return true;
  });
}

export function normalizeMatrixText(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^ A-Z0-9!?.,:;+-]/g, '?').slice(0, MAX_MATRIX_TEXT);
}

// Five columns per glyph, least significant bit at the top. Unknown symbols
// deliberately become a visible question mark instead of disappearing.
export const MATRIX_FONT: Record<string, readonly number[]> = {
  ' ': [0, 0, 0, 0, 0], A: [126, 17, 17, 17, 126], B: [127, 73, 73, 73, 54], C: [62, 65, 65, 65, 34],
  D: [127, 65, 65, 34, 28], E: [127, 73, 73, 73, 65], F: [127, 9, 9, 9, 1], G: [62, 65, 73, 73, 122],
  H: [127, 8, 8, 8, 127], I: [65, 65, 127, 65, 65], J: [32, 64, 65, 63, 1], K: [127, 8, 20, 34, 65],
  L: [127, 64, 64, 64, 64], M: [127, 2, 12, 2, 127], N: [127, 4, 8, 16, 127], O: [62, 65, 65, 65, 62],
  P: [127, 9, 9, 9, 6], Q: [62, 65, 81, 33, 94], R: [127, 9, 25, 41, 70], S: [38, 73, 73, 73, 50],
  T: [1, 1, 127, 1, 1], U: [63, 64, 64, 64, 63], V: [31, 32, 64, 32, 31], W: [127, 32, 24, 32, 127],
  X: [99, 20, 8, 20, 99], Y: [3, 4, 120, 4, 3], Z: [97, 81, 73, 69, 67],
  '0': [62, 69, 73, 81, 62], '1': [0, 66, 127, 64, 0], '2': [98, 81, 73, 73, 70], '3': [34, 65, 73, 73, 54],
  '4': [24, 20, 18, 127, 16], '5': [47, 73, 73, 73, 49], '6': [62, 73, 73, 73, 50], '7': [1, 1, 113, 9, 7],
  '8': [54, 73, 73, 73, 54], '9': [38, 73, 73, 73, 62], '!': [0, 0, 95, 0, 0], '?': [2, 1, 81, 9, 6],
  '.': [0, 96, 96, 0, 0], ',': [0, 64, 32, 0, 0], ':': [0, 54, 54, 0, 0], ';': [0, 86, 54, 0, 0],
  '+': [8, 8, 62, 8, 8], '-': [8, 8, 8, 8, 8],
};

export function matrixTextColumns(text: string) {
  const columns: number[] = [];
  for (const character of normalizeMatrixText(text)) columns.push(...(MATRIX_FONT[character] ?? MATRIX_FONT['?']), 0);
  return columns;
}

/** offset=0 is blank; the text enters from the right and leaves at the left. */
export function matrixScrollRows(text: string, offset: number) {
  const columns = matrixTextColumns(text);
  const rows = Array.from({ length: MATRIX_HEIGHT }, () => 0);
  for (let x = 0; x < MATRIX_WIDTH; x += 1) {
    const source = offset + x - MATRIX_WIDTH;
    const column = source >= 0 && source < columns.length ? columns[source] : 0;
    for (let y = 0; y < 7; y += 1) if (column & (1 << y)) rows[y] += 2 ** (MATRIX_WIDTH - 1 - x);
  }
  return rows;
}

export function matrixScrollSteps(text: string) {
  return matrixTextColumns(text).length + MATRIX_WIDTH;
}

export function matrixPixel(rows: readonly number[], x: number, y: number, enabled: boolean) {
  const next = [...rows];
  const bit = 2 ** (MATRIX_WIDTH - 1 - Math.max(0, Math.min(31, Math.round(x))));
  const row = Math.max(0, Math.min(7, Math.round(y)));
  next[row] = enabled ? (next[row] + (next[row] % (bit * 2) < bit ? bit : 0)) : (next[row] - (next[row] % (bit * 2) >= bit ? bit : 0));
  return next;
}
