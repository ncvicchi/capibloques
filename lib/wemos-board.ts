// Physical header order, USB to the left. Provenance: docs/REFERENCIA_WEMOS.md.
// This diagram is not a capability list: scene-model remains authoritative.
export type BoardContact = { label: string; gpio?: number; alias?: string };
export const wemosTop: readonly BoardContact[] = [
  { label: 'SCL', gpio: 22 }, { label: 'SDA', gpio: 21 }, { label: 'RST' }, { label: 'GND' },
  { label: 'IO18', gpio: 18, alias: 'D13' }, { label: 'IO19', gpio: 19, alias: 'D12' },
  { label: 'IO23', gpio: 23, alias: 'D11' }, { label: 'IO5', gpio: 5, alias: 'D10' },
  { label: 'IO13', gpio: 13, alias: 'D9' }, { label: 'IO12', gpio: 12, alias: 'D8' },
  { label: 'IO14', gpio: 14, alias: 'D7' }, { label: 'IO27', gpio: 27, alias: 'D6' },
  { label: 'IO16', gpio: 16, alias: 'D5' }, { label: 'IO17', gpio: 17, alias: 'D4' },
  { label: 'IO25', gpio: 25, alias: 'D3' }, { label: 'IO26', gpio: 26, alias: 'D2' },
  { label: 'TX0', gpio: 1, alias: 'D1' }, { label: 'RX0', gpio: 3, alias: 'D0' },
];
export const wemosBottom: readonly BoardContact[] = [
  { label: 'IO0', gpio: 0 }, { label: '5V' }, { label: 'RST' }, { label: '3V3' },
  { label: '5V' }, { label: 'GND' }, { label: 'GND' }, { label: 'VIN' },
  { label: 'IO2', gpio: 2, alias: 'A0' }, { label: 'IO4', gpio: 4, alias: 'A1' },
  { label: 'IO35', gpio: 35, alias: 'A2' }, { label: 'IO34', gpio: 34, alias: 'A3' },
  { label: 'IO36', gpio: 36, alias: 'A4' }, { label: 'IO39', gpio: 39, alias: 'A5' },
];
export const wemosContacts = [...wemosTop, ...wemosBottom];
export function physicalWemosLabel(gpio: number | null | undefined) {
  return wemosContacts.find(contact => contact.gpio !== undefined && contact.gpio === gpio)?.label;
}
