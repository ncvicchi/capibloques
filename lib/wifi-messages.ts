export const WIFI_MESSAGE_PORT = 4217;
export const WIFI_MESSAGE_VERSION = 1;
export const WIFI_MESSAGE_MAX_TEXT_BYTES = 120;
export const WIFI_ID_PATTERN = /^[a-zA-Z0-9_-]{1,24}$/;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });

export interface WifiApplicationMessage { sequence: number; sender: string; target: string; text: string }

export function wifiMessageCrc(bytes: Uint8Array) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc;
}

export function encodeWifiMessage(message: WifiApplicationMessage) {
  const sender = encoder.encode(message.sender), target = encoder.encode(message.target), text = encoder.encode(message.text);
  if (!WIFI_ID_PATTERN.test(message.sender) || !(message.target === '*' || WIFI_ID_PATTERN.test(message.target)) || !text.length || text.length > WIFI_MESSAGE_MAX_TEXT_BYTES) throw new Error('El mensaje Wi-Fi no respeta los límites del protocolo.');
  const bytes = new Uint8Array(14 + sender.length + target.length + text.length);
  bytes.set([0x43, 0x42, 0x57, WIFI_MESSAGE_VERSION], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, message.sequence >>> 0, true);
  bytes[8] = sender.length; bytes[9] = target.length; view.setUint16(10, text.length, true);
  bytes.set(sender, 12); bytes.set(target, 12 + sender.length); bytes.set(text, 12 + sender.length + target.length);
  const crcAt = bytes.length - 2; view.setUint16(crcAt, wifiMessageCrc(bytes.subarray(3, crcAt)), true);
  return bytes;
}

export function decodeWifiMessage(bytes: Uint8Array): WifiApplicationMessage | null {
  if (bytes.length < 17 || bytes[0] !== 0x43 || bytes[1] !== 0x42 || bytes[2] !== 0x57 || bytes[3] !== WIFI_MESSAGE_VERSION) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), senderSize = bytes[8], targetSize = bytes[9], textSize = view.getUint16(10, true);
  if (!senderSize || !targetSize || !textSize || textSize > WIFI_MESSAGE_MAX_TEXT_BYTES || bytes.length !== 14 + senderSize + targetSize + textSize) return null;
  const crcAt = bytes.length - 2;
  if (view.getUint16(crcAt, true) !== wifiMessageCrc(bytes.subarray(3, crcAt))) return null;
  try {
    const sender = decoder.decode(bytes.subarray(12, 12 + senderSize));
    const target = decoder.decode(bytes.subarray(12 + senderSize, 12 + senderSize + targetSize));
    const text = decoder.decode(bytes.subarray(12 + senderSize + targetSize, crcAt));
    return WIFI_ID_PATTERN.test(sender) && (target === '*' || WIFI_ID_PATTERN.test(target)) ? { sequence: view.getUint32(4, true), sender, target, text } : null;
  } catch { return null; }
}
