// @ts-expect-error Node strip-types runner.
import { parseUsbFirmware, type FirmwareJob, type UsbFirmware } from './usb-firmware.ts';
// @ts-expect-error Node strip-types runner.
import { CAPI_INTERPRETER_ABI, CAPI_INTERPRETER_VERSION } from './capi-rules.ts';
import type { BoardProfileId } from './board-profiles.ts';

interface PublishedInterpreter { board: BoardProfileId; version: string; abi: number; bundle: string; bytes: number; sha256: string; }

export async function fetchInterpreterFirmware(board: BoardProfileId, signal: AbortSignal): Promise<UsbFirmware> {
  const response = await fetch(`/interpreter/${board}.json`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('El firmware intérprete todavía no está publicado en este servidor. Pedile a un administrador que genere los artefactos de la fase 36.');
  const info = await response.json() as PublishedInterpreter;
  if (info.board !== board || info.version !== CAPI_INTERPRETER_VERSION || info.abi !== CAPI_INTERPRETER_ABI || !/^[a-f0-9]{64}$/.test(info.sha256) || !Number.isSafeInteger(info.bytes) || info.bytes <= 0 || !/^[a-z0-9.-]+\.zip$/.test(info.bundle)) throw new Error('El manifiesto del intérprete no es válido.');
  const bundle = await fetch(`/interpreter/${info.bundle}`, { cache: 'no-store', signal });
  if (!bundle.ok) throw new Error('No pudimos descargar el firmware intérprete.');
  const bytes = new Uint8Array(await bundle.arrayBuffer());
  const job: FirmwareJob = { id: 'interpreter', projectId: 'interpreter', revision: 1, title: 'Intérprete CapiBloques', framework: 'esp-idf', boardProfile: board, state: 'ready', containsWifi: false, createdAt: '', expiresAt: '', message: '', sha256: info.sha256, bytes: info.bytes, metrics: {} };
  return parseUsbFirmware(bytes, job);
}
