import type { BoardContact } from './wemos-board';

// Header order from Espressif ESP32-S3-DevKitC-1 v1.0, USB connectors down.
export const s3Left: readonly BoardContact[] = [
  { label: '3V3' }, { label: '3V3' }, { label: 'RST' },
  ...[4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14].map(gpio => ({ label: `IO${gpio}`, gpio })),
  { label: '5V' }, { label: 'GND' },
];
export const s3Right: readonly BoardContact[] = [
  { label: 'GND' }, { label: 'TX', gpio: 43 }, { label: 'RX', gpio: 44 },
  ...[1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19].map(gpio => ({ label: `IO${gpio}`, gpio })),
  { label: 'GND' }, { label: 'GND' },
];
export const s3Contacts = [...s3Left, ...s3Right];
export function physicalS3Label(gpio: number | null | undefined) {
  return s3Contacts.find(contact => contact.gpio === gpio)?.label;
}
