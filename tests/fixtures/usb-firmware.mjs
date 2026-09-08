import { createHash } from 'node:crypto';

export const digest = data => createHash('sha256').update(data).digest('hex');
export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function storedZip(entries) {
  const locals = [], directory = []; let offset = 0;
  for (const [path, source] of entries) {
    const data = Buffer.from(source), name = Buffer.from(path), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, data); directory.push(central, name); offset += local.length + name.length + data.length;
  }
  const table = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(table.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, table, end]);
}
export function usbFixture(framework = 'arduino', change = () => {}, changeEntries = () => {}) {
  const addresses = framework === 'arduino' ? [0x1000, 0x8000, 0xe000, 0x10000] : [0x1000, 0x8000, 0x10000];
  const binaries = addresses.map((_, index) => Buffer.alloc(64 + index * 4, index + 1));
  const manifest = { format: 'CapiBloquesFirmware', version: 1, board: 'wemos-d1-r32', chip: 'esp32', framework, frameworkVersion: framework === 'arduino' ? '3.3.11' : '5.5.5', containsWifiCredentials: false, flashMode: 'dio', flashFrequency: '40m', flashSize: '4MB', recipe: 'a'.repeat(64), buildId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', parts: addresses.map((address, index) => ({ path: `firmware/part-${index}.bin`, offset: address, size: binaries[index].length, sha256: digest(binaries[index]) })) };
  change(manifest);
  const entries = [...binaries.map((data, index) => [`firmware/part-${index}.bin`, data]), ['manifest.json', JSON.stringify(manifest)], ['LEEME.txt', 'Fixture sintético: no grabar en hardware.']];
  changeEntries(entries);
  const bytes = storedZip(entries);
  return { bytes, manifest, entries, job: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', projectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', revision: 1, title: 'Prueba USB sintética', framework, state: 'ready', containsWifi: false, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), message: '', sha256: digest(bytes), bytes: bytes.length, metrics: {} } };
}
