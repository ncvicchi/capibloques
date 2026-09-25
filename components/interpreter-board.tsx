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
type GuideStep = 'review' | 'connect' | 'prepare' | 'wifi' | 'send' | 'run';

export default function InterpreterBoard({ account, store, program, scene, board, onClose }: { account: Account; store: AccountDraftStore; program: CompiledProgram; scene: SceneDefinition; board: BoardProfileId; onClose: () => void }) {
  const [session] = useState(() => new InterpreterSession());
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [installer] = useState(() => new UsbSession(createEspDriver));
  const installState = useSyncExternalStore(installer.subscribe, installer.snapshot, installer.snapshot);
  const [installing, setInstalling] = useState(false);
  const [step, setStep] = useState<GuideStep>('review');
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
  const needsWifi = Boolean(bundle?.requiredCapabilities.includes('wifi'));
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
  const connectBoard = async () => {
    await session.connect(requestVerifiedPort, board);
    if (session.state.stage === 'incompatible') setStep('prepare');
    else if (session.state.stage === 'ready') setStep(needsWifi ? 'wifi' : 'send');
  };
  const close = () => { if (state.stage === 'sending' || usbBusy(installState)) return; void session.close().finally(onClose); };
  const beginInstall = async () => { await session.close(); setInstalling(true); setStep('prepare'); };
  const flash = () => installer.flash(requestVerifiedPort, signal => fetchInterpreterFirmware(board, signal), signal => verifySession(signal));
  const act = (operation: Promise<unknown>) => { setActionError(''); void operation.catch(cause => setActionError(cause instanceof Error ? cause.message : 'La placa rechazó la operación.')); };
  const authorized = (operation: () => Promise<unknown>) => act(verifySession().then(operation));
  const configureWifi = () => authorized(async () => { await session.provisionWifi(wifiSsid, wifiPassword); setWifiPassword(''); setStep('send'); });
  const sendAndRun = () => bundle && authorized(async () => { await session.send(bundle); await session.command('RUN'); setStep('run'); });
  const rulesLoaded = state.progress === 100 || state.stage === 'running' || state.stage === 'paused';
  const flow = useMemo(() => ['review', 'connect', ...(needsWifi ? ['wifi'] : []), 'send', 'run'] as GuideStep[], [needsWifi]);
  const flowIndex = Math.max(0, flow.indexOf(step === 'prepare' ? 'connect' : step));
  const back = () => {
    setActionError('');
    if (step === 'connect') setStep('review');
    else if (step === 'prepare' && !usbBusy(installState)) { setInstalling(false); setStep('connect'); }
    else if (step === 'wifi') setStep('connect');
    else if (step === 'send') setStep(needsWifi ? 'wifi' : 'connect');
    else if (step === 'run') setStep('send');
  };
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="firmware-dialog usb-dialog" showCloseButton={state.stage !== 'sending'}>
    <DialogHeader><DialogTitle>⚡ Usar mi placa</DialogTitle><DialogDescription>Paso {flowIndex + 1} de {flow.length} · {step === 'review' ? 'Revisar el proyecto' : step === 'connect' ? 'Conectar la placa' : step === 'prepare' ? 'Preparar la placa' : step === 'wifi' ? 'Configurar Wi-Fi' : step === 'send' ? 'Enviar el programa' : 'Programa en marcha'}</DialogDescription></DialogHeader>
    <progress className="board-guide-progress" value={flowIndex + 1} max={flow.length} aria-label={`Paso ${flowIndex + 1} de ${flow.length}`} />
    {!available && <p role="alert" className="account-error">Web Serial requiere Chrome o Edge de escritorio y una dirección HTTPS o localhost.</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
    {actionError && <p role="alert" className="account-error">{actionError}</p>}
    {revoked && <p role="alert" className="account-error">La sesión cambió o perdió conexión con el servidor. Cerramos USB; volvé a ingresar antes de usar la placa.</p>}
    {step === 'review' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🧩</div><h3>Tu proyecto está listo para continuar</h3><ul className="board-guide-checks"><li>✓ Tiene acciones para ejecutar</li><li>✓ Los bloques y componentes son compatibles</li><li>✓ Elegiste {boardProfile(board).name}</li>{store.remote?.course && <li>✓ Pertenece al curso {store.remote.course.name}</li>}</ul><p>En los cursos que exijan aprobación docente, esa comprobación ocupará esta pantalla y no quedará escondida entre datos técnicos.</p><Button onClick={() => setStep('connect')}>Continuar</Button></section>}
    {step === 'connect' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🔌</div><h3>Conectá {boardProfile(board).shortName}</h3><p>Usá un cable USB de datos. Después elegí la placa en la ventana del navegador.</p><div className="usb-status" role={state.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{state.message}</strong></div><Button disabled={!available || !!error || revoked || state.stage === 'connecting'} onClick={() => void connectBoard()}>Conectar mi placa</Button>{state.stage !== 'connecting' && <Button variant="outline" disabled={!available || revoked} onClick={() => void beginInstall()}>Todavía no tiene CapiBloques</Button>}</section>}
    {step === 'prepare' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">⚙️</div><h3>Preparar {boardProfile(board).shortName}</h3><p>Instalaremos CapiBloques una sola vez. Esto reemplaza el programa que tenga ahora la placa.</p>{!installing && <Button onClick={() => void beginInstall()}>{state.stage === 'incompatible' ? 'Instalar la versión correcta' : 'Preparar esta placa'}</Button>}{installing && <><div className="usb-status" role={installState.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{installState.message}</strong>{installState.writingStarted && <><progress value={installState.progress} max={100} /><span>{installState.progress}%</span></>}</div>{installState.stage !== 'done' && <fieldset className="usb-checks" disabled={usbBusy(installState)}><legend>Revisalo con una persona adulta</legend><label><input type="checkbox" checked={identified} onChange={event => setIdentified(event.target.checked)} /> Es la placa correcta.</label><label><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} /> Motores y actuadores están desconectados.</label><label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} /> Podemos reemplazar el programa actual.</label></fieldset>}{!usbBusy(installState) && installState.stage !== 'done' && <Button disabled={!available || revoked || !identified || !safe || !replace} onClick={flash}>Instalar CapiBloques</Button>}{usbBusy(installState) && <Button variant="outline" onClick={() => installer.cancel()}>Cancelar instalación</Button>}{installState.stage === 'done' && <Button onClick={() => { setInstalling(false); setIdentified(false); setSafe(false); setReplace(false); setStep('connect'); }}>Continuar</Button>}</>}</section>}
    {step === 'wifi' && <section className="board-guide-screen firmware-wifi"><div className="board-guide-hero" aria-hidden="true">📶</div><h3>¿Este proyecto usará Wi-Fi?</h3><p>La clave viaja directamente a la placa. No se guarda en el proyecto ni se envía al servidor.</p><label htmlFor="interpreter-wifi-ssid">Nombre de la red</label><Input id="interpreter-wifi-ssid" autoComplete="off" maxLength={32} value={wifiSsid} onChange={event => setWifiSsid(event.target.value)} /><label htmlFor="interpreter-wifi-password">Clave de la red</label><Input id="interpreter-wifi-password" type="password" autoComplete="new-password" maxLength={63} value={wifiPassword} onChange={event => setWifiPassword(event.target.value)} placeholder="Vacía sólo para una red abierta" /><Button disabled={!wifiSsid.trim() || (!!wifiPassword && wifiPassword.length < 8)} onClick={configureWifi}>Guardar y continuar</Button><Button variant="outline" onClick={() => setStep('send')}>No cambiar la red ahora</Button></section>}
    {step === 'send' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🚀</div><h3>Enviar el programa</h3><p>La placa está lista. Enviaremos las reglas y comenzará a ejecutarlas.</p><div className="usb-status" role={state.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{state.message}</strong>{state.stage === 'sending' && <><progress value={state.progress} max={100} /><span>{state.progress}%</span></>}</div><Button className="board-run-button" disabled={!bundle || state.stage === 'sending'} onClick={sendAndRun}>{rulesLoaded ? 'Volver a enviar y ejecutar' : 'Enviar y ejecutar'}</Button>{bundle && <details><summary>Ver detalles técnicos</summary><p>{bundle.instructionCount} instrucciones · {bundle.bytes.length.toLocaleString('es-AR')} bytes · control {bundle.checksum}</p><p>Una transferencia interrumpida no reemplaza las últimas reglas completas.</p>{state.hello && <p>Firmware {state.hello.firmware} · ABI {state.hello.abi}</p>}</details>}</section>}
    {step === 'run' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🎉</div><h3>¡El programa está en marcha!</h3><p>{state.message}</p><div className="usb-actions">{state.stage === 'running' && <><Button onClick={() => authorized(() => session.command('PAUSE'))}>Pausar</Button><Button variant="outline" onClick={() => authorized(() => session.command('STOP'))}>Detener</Button></>}{state.stage === 'paused' && <><Button onClick={() => authorized(() => session.command('RESUME'))}>Continuar</Button><Button variant="outline" onClick={() => authorized(() => session.command('STOP'))}>Detener</Button></>}</div>{!!state.telemetry.length && <details><summary>Ver qué está haciendo la placa</summary><ol className="execution-trace">{state.telemetry.slice(-20).map((item, index) => <li key={`${item.event}-${index}`}>{item.blockId ? `${item.blockId}: ` : ''}{item.message ?? item.event}{showTelemetryValue(item.value)}</li>)}</ol></details>}<Button variant="outline" onClick={() => setStep('send')}>Enviar cambios otra vez</Button></section>}
    {step !== 'review' && step !== 'run' && <div className="board-guide-footer"><Button variant="outline" disabled={state.stage === 'sending' || usbBusy(installState)} onClick={back}>Atrás</Button></div>}
  </DialogContent></Dialog>;
}
