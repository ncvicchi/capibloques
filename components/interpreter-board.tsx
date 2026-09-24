'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCapiRules, CapiRulesError, type CapiRulesBundle } from '@/lib/capi-rules';
import { InterpreterSession } from '@/lib/interpreter-protocol';
import { fetchInterpreterFirmware } from '@/lib/interpreter-firmware';
import { createEspDriver } from '@/lib/usb-esptool';
import { UsbSession, usbBusy } from '@/lib/usb-session';
import { boardProfile, type BoardProfileId } from '@/lib/board-profiles';
import type { CompiledProgram } from '@/lib/capiblocks';
import type { SceneDefinition } from '@/lib/scene-model';
import { sessionChangePending, watchSessionChange, type Account, type AccountDraftStore } from '@/lib/account-session';

const showTelemetryValue = (value: unknown) => value === undefined ? '' : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? ` · ${value}` : ` · ${JSON.stringify(value)}`;

export default function InterpreterBoard({ account, store, program, scene, board, onClose }: { account: Account; store: AccountDraftStore; program: CompiledProgram; scene: SceneDefinition; board: BoardProfileId; onClose: () => void }) {
  const [session] = useState(() => new InterpreterSession());
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [installer] = useState(() => new UsbSession(createEspDriver));
  const installState = useSyncExternalStore(installer.subscribe, installer.snapshot, installer.snapshot);
  const [installing, setInstalling] = useState(false);
  const [actionError, setActionError] = useState('');
  const wifiDevice = scene.devices.find(device => device.kind === 'wifiNode');
  const [wifiSsid, setWifiSsid] = useState(wifiDevice?.kind === 'wifiNode' ? wifiDevice.config.ssid : '');
  const [wifiPassword, setWifiPassword] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [identified, setIdentified] = useState(false), [safe, setSafe] = useState(false), [replace, setReplace] = useState(false);
  const [bundle, error] = useMemo<[CapiRulesBundle | null, string]>(() => {
    try { return [createCapiRules(program, scene, board), '']; } catch (cause) { return [null, cause instanceof CapiRulesError ? cause.message : 'No pudimos preparar las reglas.']; }
  }, [board, program, scene]);
  const available = typeof window !== 'undefined' && window.isSecureContext && typeof navigator.serial?.requestPort === 'function';
  const connected = !['idle', 'connecting', 'closing', 'error'].includes(state.stage);
  useEffect(() => () => { void session.close(); installer.dispose(); }, [installer, session]);
  useEffect(() => {
    let alive = true;
    const revoke = () => { if (!alive) return; setRevoked(true); void session.close(); installer.cancel(); };
    const stop = watchSessionChange(revoke);
    const check = async () => {
      if (!store.active || !store.remoteAllowed || sessionChangePending()) return revoke();
      try { const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!response.ok || (await response.json() as { user?: Account }).user?.id !== account.id) revoke(); } catch { revoke(); }
    };
    void check(); const timer = window.setInterval(() => void check(), 60_000);
    return () => { alive = false; stop(); clearInterval(timer); };
  }, [account.id, installer, session, store]);
  const verifySession = async (signal?: AbortSignal) => {
    if (!store.active || !store.remoteAllowed || sessionChangePending()) throw new Error('La sesión cambió. Volvé a ingresar antes de usar la placa.');
    const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
    if (!response.ok || (await response.json() as { user?: Account }).user?.id !== account.id) throw new Error('La sesión cambió. Volvé a ingresar antes de usar la placa.');
  };
  const requestVerifiedPort = () => {
    const selection = navigator.serial.requestPort();
    return selection.then(async port => { await verifySession(); return port; });
  };
  const close = () => { if (state.stage === 'sending' || usbBusy(installState)) return; void session.close().finally(onClose); };
  const beginInstall = async () => { await session.close(); setInstalling(true); };
  const flash = () => installer.flash(requestVerifiedPort, signal => fetchInterpreterFirmware(board, signal), signal => verifySession(signal));
  const act = (operation: Promise<unknown>) => { setActionError(''); void operation.catch(cause => setActionError(cause instanceof Error ? cause.message : 'La placa rechazó la operación.')); };
  const authorized = (operation: () => Promise<unknown>) => act(verifySession().then(operation));
  const configureWifi = () => authorized(async () => { await session.provisionWifi(wifiSsid, wifiPassword); setWifiPassword(''); });
  const sendAndRun = () => bundle && authorized(async () => { await session.send(bundle); await session.command('RUN'); });
  const compatible = ['ready', 'sending', 'running', 'paused', 'stopped'].includes(state.stage);
  const rulesLoaded = state.progress === 100 || state.stage === 'running' || state.stage === 'paused';
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="firmware-dialog usb-dialog" showCloseButton={state.stage !== 'sending'}>
    <DialogHeader><DialogTitle>⚡ Usar mi placa</DialogTitle><DialogDescription>Prepará la placa una sola vez. Después, cada cambio se envía como reglas en pocos segundos: no se compila el proyecto ni se manda al servidor.</DialogDescription></DialogHeader>
    <ol className="board-steps" aria-label="Pasos para usar la placa">
      <li data-active={!installing && !connected} data-done={connected}>Conectar</li>
      <li data-active={installing || state.stage === 'incompatible'} data-done={compatible}>Preparar</li>
      <li data-active={!installing && compatible && !rulesLoaded} data-done={rulesLoaded}>Enviar y ejecutar</li>
    </ol>
    {!available && <p role="alert" className="account-error">Web Serial requiere Chrome o Edge de escritorio y una dirección HTTPS o localhost.</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
    {actionError && <p role="alert" className="account-error">{actionError}</p>}
    {revoked && <p role="alert" className="account-error">La sesión cambió o perdió conexión con el servidor. Cerramos USB; volvé a ingresar antes de usar la placa.</p>}
    {!installing && <section className="usb-target">
      <h3>{boardProfile(board).name}</h3>
      <p>{connected ? 'La placa está conectada. Ya podés enviar este proyecto.' : 'Conectá el cable USB y elegí la placa. Si todavía no tiene CapiBloques, podés prepararla desde aquí.'}</p>
      {bundle && <details><summary>Datos de estas reglas</summary><p>{bundle.instructionCount} instrucciones · {bundle.bytes.length.toLocaleString('es-AR')} bytes · control {bundle.checksum}</p><p>La placa conserva las últimas reglas completas. Una transferencia interrumpida no reemplaza el programa anterior.</p></details>}
    </section>}
    {installing && <section className="usb-target"><h3>Preparar {boardProfile(board).shortName}</h3><p>Instala el firmware CapiBloques precompilado y reemplaza el programa actual. Sólo hace falta la primera vez o cuando la web pide actualizarlo.</p></section>}
    <div className="usb-status" role={state.stage === 'error' || state.stage === 'incompatible' || installState.stage === 'error' ? 'alert' : 'status'} aria-live="polite">
      <strong>{installing ? installState.message : state.message}</strong>
      {state.hello && <span>{state.hello.board} · firmware {state.hello.firmware} · ABI {state.hello.abi}</span>}
      {!installing && state.stage === 'sending' && <><progress value={state.progress} max={100} /><span>{state.progress}%</span></>}
      {installing && installState.writingStarted && <><progress value={installState.progress} max={100} /><span>{installState.progress}%</span></>}
    </div>
    {!installing && bundle?.requiredCapabilities.includes('wifi') && connected && <section className="firmware-wifi">
      <h3>📶 Red guardada en esta placa</h3>
      <p>La clave viaja directamente por USB y no entra al proyecto, al servidor ni al historial.</p>
      <label htmlFor="interpreter-wifi-ssid">Nombre de la red</label>
      <Input id="interpreter-wifi-ssid" autoComplete="off" maxLength={32} value={wifiSsid} onChange={event => setWifiSsid(event.target.value)} />
      <label htmlFor="interpreter-wifi-password">Clave de la red</label>
      <Input id="interpreter-wifi-password" type="password" autoComplete="new-password" maxLength={63} value={wifiPassword} onChange={event => setWifiPassword(event.target.value)} placeholder="Vacía sólo para una red abierta" />
      <Button variant="outline" disabled={!wifiSsid.trim() || (!!wifiPassword && wifiPassword.length < 8) || state.stage === 'running' || state.stage === 'paused'} onClick={configureWifi}>Guardar Wi-Fi en la placa</Button>
    </section>}
    {installing && <fieldset className="usb-checks" disabled={usbBusy(installState)}><legend>Antes de grabar, revisá con una persona adulta</legend><label><input type="checkbox" checked={identified} onChange={event => setIdentified(event.target.checked)} /> Identifiqué la placa correcta.</label><label><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} /> Desconecté motores y actuadores.</label><label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} /> Entiendo que reemplaza el programa actual.</label></fieldset>}
    <div className="usb-actions">
      {!installing && !connected && <Button disabled={!available || !!error || revoked || state.stage === 'connecting'} onClick={() => void session.connect(requestVerifiedPort, board)}>Conectar y comprobar</Button>}
      {!installing && !connected && state.stage !== 'connecting' && <Button variant="outline" disabled={!available || revoked} onClick={() => void beginInstall()}>Preparar esta placa</Button>}
      {!installing && state.stage === 'incompatible' && <Button onClick={() => void beginInstall()}>Instalar la versión correcta</Button>}
      {(state.stage === 'ready' || state.stage === 'stopped') && <Button disabled={!bundle} onClick={sendAndRun}>{state.progress === 100 ? 'Volver a enviar y ejecutar' : 'Enviar reglas y ejecutar'}</Button>}
      {state.stage === 'running' && <><Button onClick={() => authorized(() => session.command('PAUSE'))}>Pausar</Button><Button variant="outline" onClick={() => authorized(() => session.command('STOP'))}>Detener</Button></>}
      {state.stage === 'paused' && <><Button onClick={() => authorized(() => session.command('RESUME'))}>Continuar</Button><Button variant="outline" onClick={() => authorized(() => session.command('STOP'))}>Detener</Button></>}
      {!installing && connected && state.stage !== 'sending' && <Button variant="outline" onClick={() => void session.close()}>Desconectar</Button>}
      {installing && !usbBusy(installState) && installState.stage !== 'done' && <><Button disabled={!available || revoked || !identified || !safe || !replace} onClick={flash}>Elegir placa e instalar CapiBloques</Button><Button variant="outline" onClick={() => setInstalling(false)}>Volver</Button></>}
      {installing && usbBusy(installState) && <Button variant="outline" onClick={() => installer.cancel()}>Cancelar</Button>}
      {installing && installState.stage === 'done' && <Button onClick={() => { setInstalling(false); setIdentified(false); setSafe(false); setReplace(false); }}>Conectar y enviar mis reglas</Button>}
    </div>
    {!!state.telemetry.length && <section className="usb-monitor"><h3>Qué está haciendo la placa</h3><ol className="execution-trace">{state.telemetry.slice(-20).map((item, index) => <li key={`${item.event}-${index}`}>{item.blockId ? `${item.blockId}: ` : ''}{item.message ?? item.event}{showTelemetryValue(item.value)}</li>)}</ol></section>}
    <details><summary>¿Por qué puede pedir una actualización?</summary><p>La web compara placa, versión y ABI antes de enviar. Si el firmware es viejo o pertenece a otra placa, bloquea las reglas para evitar ejecutar algo incompatible.</p></details>
    <Button variant="outline" disabled={state.stage === 'sending' || usbBusy(installState)} onClick={close}>Cerrar</Button>
  </DialogContent></Dialog>;
}
