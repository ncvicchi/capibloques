// @ts-expect-error Node strip-types runner.
import { sha256 } from './firmware-archive.ts';

export type FirmwareJob = { id: string; projectId: string; revision: number; title: string; framework: 'arduino' | 'esp-idf'; state: string; containsWifi: boolean; createdAt: string; expiresAt: string; message: string; sha256: string | null; bytes: number; metrics: { seconds?: number } };
export type UsbFirmware = { parts: { data: Uint8Array; address: number }[]; framework: 'arduino' | 'esp-idf'; containsWifi: boolean };
const limit = 5_000_000;
const invalid = () => new Error('El firmware está incompleto, dañado o no corresponde a Wemos D1 R32. No se grabó.');

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
  return (value ^ 0xffffffff) >>> 0;
}

// The server emits a small ZIP_STORED bundle. Reject other ZIP dialects rather
// than decompressing untrusted data or accepting ambiguous directory entries.
function unpack(bytes: Uint8Array) {
  if (bytes.length < 22 || bytes.length > limit) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const end = bytes.length - 22;
  if (u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6) || u16(end + 20)) throw invalid();
  const count = u16(end + 10), directory = u32(end + 16);
  if (count < 5 || count > 10 || u16(end + 8) !== count || directory + u32(end + 12) !== end) throw invalid();
  const files = new Map<string, Uint8Array>();
  const decode = new TextDecoder('utf-8', { fatal: true });
  let cursor = directory, localEnd = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) throw invalid();
    const flags = u16(cursor + 8), size = u32(cursor + 24), nameLength = u16(cursor + 28), extra = u16(cursor + 30), comment = u16(cursor + 32), local = u32(cursor + 42);
    if ((flags !== 0 && flags !== 0x800) || u16(cursor + 10) || u16(cursor + 34) || size !== u32(cursor + 20) || cursor + 46 + nameLength + extra + comment > end || local !== localEnd || local + 30 > directory) throw invalid();
    const name = decode.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!/^(manifest\.json|LEEME\.txt|firmware\/part-[0-4]\.bin|licenses\/(Adafruit-GFX|Arduino-GFX)\.txt)$/.test(name) || files.has(name)) throw invalid();
    if (u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) || u32(local + 14) !== u32(cursor + 16) || u32(local + 18) !== size || u32(local + 22) !== size || u16(local + 26) !== nameLength) throw invalid();
    const start = local + 30 + nameLength + u16(local + 28);
    if (start + size > directory || decode.decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== name) throw invalid();
    const data = bytes.subarray(start, start + size);
    if (crc32(data) !== u32(cursor + 16)) throw invalid();
    files.set(name, data); localEnd = start + size; cursor += 46 + nameLength + extra + comment;
  }
  if (cursor !== end || localEnd !== directory) throw invalid();
  return files;
}

export async function parseUsbFirmware(bytes: Uint8Array, job: FirmwareJob): Promise<UsbFirmware> {
  if (!['arduino', 'esp-idf'].includes(job.framework) || !job.sha256 || !/^[a-f0-9]{64}$/.test(job.sha256) || bytes.length !== job.bytes || bytes.length > limit || await sha256(bytes) !== job.sha256) throw invalid();
  try {
    const files = unpack(bytes), manifestBytes = files.get('manifest.json');
    if (!manifestBytes || manifestBytes.length > 16_384 || !files.has('LEEME.txt')) throw invalid();
    const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
    if (manifest.format !== 'CapiBloquesFirmware' || manifest.version !== 1 || manifest.board !== 'wemos-d1-r32' || manifest.chip !== 'esp32' || manifest.framework !== job.framework || manifest.containsWifiCredentials !== job.containsWifi || manifest.flashMode !== 'dio' || manifest.flashFrequency !== '40m' || manifest.flashSize !== '4MB' || !/^[a-f0-9]{64}$/.test(manifest.recipe)) throw invalid();
    // Cache aliases may refer to the original buildId: the fresh owner-scoped
    // job SHA-256 authenticates this exact bundle, not its original UUID.
    const addresses = job.framework === 'arduino' ? [0x1000, 0x8000, 0xe000, 0x10000] : [0x1000, 0x8000, 0x10000];
    if (!Array.isArray(manifest.parts) || manifest.parts.length !== addresses.length) throw invalid();
    const parts: UsbFirmware['parts'] = [];
    let end = 0;
    for (const [index, part] of manifest.parts.entries()) {
      const data = files.get(part.path);
      if (part.path !== `firmware/part-${index}.bin` || !data?.length || !Number.isSafeInteger(part.size) || part.size !== data.length || part.offset !== addresses[index] || part.offset < end || part.offset + data.length > 4 * 1024 * 1024 || await sha256(data) !== part.sha256) throw invalid();
      // Flash erases complete sectors. A padded/erased tail must not damage the next segment.
      end = part.offset + Math.ceil(data.length / 4096) * 4096;
      parts.push({ address: part.offset, data: new Uint8Array(data) });
    }
    if ([...files.keys()].filter(name => name.startsWith('firmware/')).length !== parts.length) throw invalid();
    return { parts, framework: job.framework, containsWifi: job.containsWifi };
  } catch { throw invalid(); }
}

export async function fetchUsbFirmware(job: FirmwareJob, accountId: string, signal: AbortSignal, usable: () => boolean) {
  const response = await fetch(`/api/builds/${job.id}/download/`, { headers: { 'X-Capi-Account': accountId }, cache: 'no-store', signal });
  if (!response.ok || !usable()) throw new Error('El firmware o el acceso ya no están disponibles. Volvé a ingresar o actualizá Mis pedidos.');
  const reader = response.body?.getReader();
  if (!reader) throw invalid();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw invalid();
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!usable()) throw new Error('La sesión cambió. No se grabó el firmware.');
  const bytes = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
  return parseUsbFirmware(bytes, job);
}

export async function authorizeUsbFirmware(job: FirmwareJob, accountId: string, signal: AbortSignal, usable: () => boolean) {
  const response = await fetch(`/api/builds/${job.id}/`, { headers: { 'X-Capi-Account': accountId }, cache: 'no-store', signal });
  if (!response.ok) throw new Error('El acceso o el firmware cambió. No iniciamos la grabación.');
  const latest = (await response.json() as { job: FirmwareJob }).job;
  if (!usable() || latest.state !== 'ready' || latest.sha256 !== job.sha256 || latest.projectId !== job.projectId || latest.revision !== job.revision || latest.framework !== job.framework || latest.containsWifi !== job.containsWifi) throw new Error('El firmware venció, fue retirado o cambió tu sesión. No iniciamos la grabación.');
}
