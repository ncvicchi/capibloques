export const MESSAGE_HEADER = [0x43, 0x42] as const; // “CB”
export const MESSAGE_TRAILER = [0x0d, 0x0a] as const;
export const MESSAGE_PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 120;

export function messageCrc16(bytes: Uint8Array) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

export function encodeMessagePacket(text: string) {
  const payload = new TextEncoder().encode(text);
  if (!payload.length || payload.length > MAX_MESSAGE_BYTES)
    throw new Error(`El mensaje debe ocupar entre 1 y ${MAX_MESSAGE_BYTES} bytes.`);
  const body = new Uint8Array(3 + payload.length);
  body[0] = MESSAGE_PROTOCOL_VERSION;
  body[1] = payload.length & 0xff;
  body[2] = payload.length >> 8;
  body.set(payload, 3);
  const crc = messageCrc16(body);
  return Uint8Array.from([
    ...MESSAGE_HEADER,
    ...body,
    crc & 0xff,
    crc >> 8,
    ...MESSAGE_TRAILER,
  ]);
}

export type DecodedMessagePacket =
  | { ok: true; text: string }
  | { ok: false; reason: 'header' | 'version' | 'length' | 'checksum' | 'trailer' | 'text' };

export function decodeMessagePacket(packet: Uint8Array): DecodedMessagePacket {
  if (packet[0] !== MESSAGE_HEADER[0] || packet[1] !== MESSAGE_HEADER[1]) return { ok: false, reason: 'header' };
  if (packet[2] !== MESSAGE_PROTOCOL_VERSION) return { ok: false, reason: 'version' };
  const length = (packet[4] ?? 0) * 256 + (packet[3] ?? 0);
  if (!length || length > MAX_MESSAGE_BYTES || packet.length !== length + 9) return { ok: false, reason: 'length' };
  if (packet.at(-2) !== MESSAGE_TRAILER[0] || packet.at(-1) !== MESSAGE_TRAILER[1]) return { ok: false, reason: 'trailer' };
  const body = packet.slice(2, 5 + length);
  const expected = (packet[6 + length] ?? 0) * 256 + (packet[5 + length] ?? 0);
  if (messageCrc16(body) !== expected) return { ok: false, reason: 'checksum' };
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(packet.slice(5, 5 + length)) };
  } catch {
    return { ok: false, reason: 'text' };
  }
}
