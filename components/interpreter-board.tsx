'use client';

/* oxlint-disable next/no-img-element -- User-supplied board photos are static recognition assets, not responsive content. */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCapiRules, CapiRulesError, type CapiRulesBundle } from '@/lib/capi-rules';
import { createPairCredentials, InterpreterSession, type PairCredentials } from '@/lib/interpreter-protocol';
import { fetchInterpreterFirmware } from '@/lib/interpreter-firmware';
import { createEspDriver } from '@/lib/usb-esptool';
import { UsbSession, usbBusy } from '@/lib/usb-session';
import { boardProfile, boardProfiles, type BoardProfileId, type CentralDisplayTarget } from '@/lib/board-profiles';
import { validateProgramForScene, type CompiledProgram } from '@/lib/capiblocks';
import { assignSafePins, type SceneDefinition } from '@/lib/scene-model';
import { sessionChangePending, watchSessionChange, type Account, type AccountDraftStore } from '@/lib/account-session';

const showTelemetryValue = (value: unknown) => value === undefined ? '' : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? ` · ${value}` : ` · ${JSON.stringify(value)}`;
const operationNames: Record<string, string> = {
  traffic: 'cambiar el semáforo', wait: 'esperar', jump: 'repetir o continuar', jumpIfFalse: 'comprobar una condición',
  led: 'cambiar la luz', motor: 'mover el motor', robot: 'mover el robot', servo: 'mover el servo',
  buzzer: 'hacer sonar el buzzer', tone: 'reproducir un tono', serial: 'mostrar un mensaje',
  fork: 'comenzar caminos en paralelo', join: 'esperar los caminos',
};
function programBlocks(program: CompiledProgram) {
  const blocks = new Map<string, Record<string, unknown>>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const item = value as Record<string, unknown>;
    if (typeof item.blockId === 'string') blocks.set(item.blockId, item);
    Object.values(item).forEach(visit);
  };
  visit(program); return blocks;
}
type GuideStep = 'review' | 'board' | 'pair-screen' | 'pair-project' | 'connect' | 'prepare' | 'wifi' | 'send' | 'run';
const WAVESHARE = 'waveshare-esp32-s3-touch-lcd-5-28117' as const;
export type PhysicalBoardCommand = 'RUN' | 'PAUSE' | 'RESUME' | 'STOP' | 'SHOW';
export type PhysicalBoardControl = (command: PhysicalBoardCommand) => void;
const boardPhotos: Record<BoardProfileId, string> = {
  'wemos-d1-r32': '/boards/wemos-d1-r32.png',
  'diymall-esp32-s3-devkitc-v1-n16r8': '/boards/diymall-esp32-s3-devkitc-v1-n16r8.png',
  [WAVESHARE]: '/boards/waveshare-esp32-s3-touch-lcd-5-28117-front-back.png',
};

function BoardPhoto({ id }: { id: BoardProfileId }) {
  const [back, setBack] = useState(false);
  useEffect(() => {
    if (id !== WAVESHARE || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setBack(value => !value), 2000);
    return () => window.clearInterval(timer);
  }, [id]);
  if (id === WAVESHARE) return <figure className="board-photo-figure"><div className={`waveshare-photo ${back ? 'is-back' : 'is-front'}`} aria-hidden="true" style={{ backgroundImage: `url(${boardPhotos[id]})` }} /><figcaption>Waveshare ESP32-S3 Touch LCD 5 · {back ? 'vista trasera' : 'vista frontal'} · cambia cada 2 segundos</figcaption></figure>;
  return <figure className={`board-photo-figure ${id === 'diymall-esp32-s3-devkitc-v1-n16r8' ? 'is-diymall' : ''}`}><img src={boardPhotos[id]} alt={`${boardProfile(id).name}, vista superior`} loading="lazy" /><figcaption>{boardProfile(id).shortName}</figcaption></figure>;
}

export default function InterpreterBoard({ account, store, program, scene, board, centralDisplay, onChangeBoard, onChangeCentralDisplay, onMirrorCommand, onPhysicalStatus, onPhysicalLog, controlRef, onClose }: { account: Account; store: AccountDraftStore; program: CompiledProgram; scene: SceneDefinition; board: BoardProfileId; centralDisplay?: CentralDisplayTarget; onChangeBoard: (board: BoardProfileId, scene: SceneDefinition) => void; onChangeCentralDisplay: (centralDisplay?: CentralDisplayTarget) => void; onMirrorCommand: (command: 'RUN' | 'PAUSE' | 'RESUME' | 'STOP' | 'DONE') => void; onPhysicalStatus: (stage: string, message: string) => void; onPhysicalLog: (message: string) => void; controlRef: RefObject<PhysicalBoardControl | null>; onClose: () => void }) {
  const [session] = useState(() => new InterpreterSession());
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [installer] = useState(() => new UsbSession(createEspDriver));
  const installState = useSyncExternalStore(installer.subscribe, installer.snapshot, installer.snapshot);
  const [installing, setInstalling] = useState(false);
  const [step, setStep] = useState<GuideStep>('review');
  const [pairCredentials, setPairCredentials] = useState<PairCredentials | null>(null);
  const [installTarget, setInstallTarget] = useState<BoardProfileId>(board);
  const [installReturn, setInstallReturn] = useState<GuideStep>('connect');
  const [candidate, setCandidate] = useState<BoardProfileId | null>(null);
  const [actionError, setActionError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const reportedDone = useRef<object | null>(null);
  const reportedTelemetry = useRef<object[]>([]);
  const wifiDevice = scene.devices.find(device => device.kind === 'wifiNode');
  const [wifiSsid, setWifiSsid] = useState(wifiDevice?.kind === 'wifiNode' ? wifiDevice.config.ssid : '');
  const [wifiPassword, setWifiPassword] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [identified, setIdentified] = useState(false), [safe, setSafe] = useState(false), [replace, setReplace] = useState(false);
  const waveshareSimulation = board === WAVESHARE;
  const [bundle, error] = useMemo<[CapiRulesBundle | null, string]>(() => {
    try { return [createCapiRules(program, scene, board), '']; } catch (cause) { return [null, cause instanceof CapiRulesError ? cause.message : 'No pudimos preparar las reglas.']; }
  }, [board, program, scene]);
  const telemetryNames = useMemo(() => {
    const devices = new Map(scene.devices.map(device => [device.id, device.name]));
    return { devices, blocks: programBlocks(program) };
  }, [program, scene.devices]);
  const telemetryText = useCallback((item: (typeof state.telemetry)[number]) => {
    if (item.event === 'program-done') return 'Programa terminado';
    if (item.event === 'task-done') return 'Camino terminado';
    const block = item.blockId ? telemetryNames.blocks.get(item.blockId) : undefined;
    const deviceId = item.deviceId ?? (typeof block?.deviceId === 'string' ? block.deviceId : undefined);
    const deviceName = deviceId ? telemetryNames.devices.get(deviceId) : undefined;
    const op = typeof block?.op === 'string' ? block.op : item.message ?? '';
    const action = item.event === 'block' && op === 'traffic' && typeof block?.color === 'string' ? `cambió a ${block.color.toLowerCase()}`
      : item.event === 'block' && op === 'led' && typeof block?.brightness === 'number' ? `cambió el brillo a ${block.brightness}%`
        : item.event === 'block' && op === 'servo' && typeof block?.angle === 'number' ? `se movió a ${block.angle}°`
          : item.event === 'block' && op === 'motor' && typeof block?.power === 'number' ? `cambió a ${block.power}%${typeof block.direction === 'string' ? ` hacia ${block.direction.toLowerCase()}` : ''}`
            : item.event === 'block' && op === 'robot' && typeof block?.action === 'string' ? `${block.action.toLowerCase()}${typeof block.speed === 'number' ? ` a ${block.speed}%` : ''}`
              : item.event === 'block' && op === 'wait' && typeof block?.ms === 'number' ? `esperando ${block.ms >= 1000 ? `${block.ms / 1000} s` : `${block.ms} ms`}`
              : item.message && item.event !== 'block' ? item.message
                : operationNames[item.message ?? op] ?? (item.event === 'block' ? 'ejecutó una acción' : item.event);
    return `${deviceName ? `${deviceName}: ` : ''}${action}${showTelemetryValue(item.value)}`;
  }, [telemetryNames]);
  useEffect(() => {
    const latest = state.telemetry.at(-1);
    if (latest?.event !== 'program-done' || reportedDone.current === latest) return;
    reportedDone.current = latest;
    onMirrorCommand('DONE');
  }, [onMirrorCommand, state.telemetry]);
  useEffect(() => { onPhysicalStatus(state.stage, state.message); }, [onPhysicalStatus, state.message, state.stage]);
  useEffect(() => {
    const known = new Set(reportedTelemetry.current);
    const fresh = state.telemetry.filter(item => item.event !== 'device' && !known.has(item));
    fresh.forEach(item => onPhysicalLog(telemetryText(item)));
    reportedTelemetry.current = [...reportedTelemetry.current, ...fresh].slice(-120);
  }, [onPhysicalLog, state.telemetry, telemetryText]);
  const available = typeof window !== 'undefined' && window.isSecureContext && typeof navigator.serial?.requestPort === 'function';
  const needsWifi = Boolean(bundle?.requiredCapabilities.includes('wifi'));
  const needsManualWifi = needsWifi && !centralDisplay;
  const boardChoices = useMemo(() => Object.values(boardProfiles).filter(profile => profile.id !== WAVESHARE).map(profile => {
    const assignment = assignSafePins(scene, { boardProfile: profile.id });
    const diagnostics = validateProgramForScene(program, assignment.scene, profile.id).filter(item => item.severity === 'error');
    const changes = scene.devices.flatMap(device => {
      const next = assignment.scene.devices.find(item => item.id === device.id);
      if (!next) return [];
      return Object.entries(device.pins).flatMap(([signal, previous]) => {
        const following = (next.pins as Record<string, number | null>)[signal] ?? null;
        return previous === following ? [] : [`${device.name} · ${signal}: ${previous === null ? 'sin pin' : `GPIO ${previous}`} → ${following === null ? 'sin pin' : `GPIO ${following}`}`];
      });
    });
    let rulesError = '';
    try { createCapiRules(program, assignment.scene, profile.id); } catch (cause) { rulesError = cause instanceof Error ? cause.message : 'El proyecto no puede convertirse en reglas para esta placa.'; }
    const interpreterMissing = profile.id === WAVESHARE;
    return {
      profile,
      scene: assignment.scene,
      warnings: assignment.warnings,
      changes,
      errors: diagnostics.map(item => item.message),
      available: !interpreterMissing && diagnostics.length === 0 && !rulesError,
      reason: interpreterMissing ? 'El firmware de reglas para su pantalla y touch todavía está pendiente.' : diagnostics[0]?.message ?? rulesError,
    };
  }), [program, scene]);
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
    if (session.state.stage === 'incompatible') { setInstallTarget(board); setInstallReturn('connect'); setStep('prepare'); }
    else if (session.state.stage === 'ready') setStep(needsManualWifi ? 'wifi' : 'send');
  };
  const connectPairScreen = async () => {
    setActionError('');
    await session.close();
    await session.connect(requestVerifiedPort, WAVESHARE);
    if (session.state.stage === 'incompatible') { setInstallTarget(WAVESHARE); setInstallReturn('pair-screen'); setStep('prepare'); return; }
    if (session.state.stage !== 'ready' || !session.state.hello) return;
    try {
      await verifySession();
      const credentials = createPairCredentials(session.state.hello);
      await session.provisionPair('screen', credentials);
      setPairCredentials(credentials);
      await session.close();
      setStep('pair-project');
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'No pudimos preparar la pantalla central.'); }
  };
  const connectPairProject = async () => {
    if (!pairCredentials) { setStep('pair-screen'); return; }
    setActionError('');
    await session.close();
    await session.connect(requestVerifiedPort, board);
    if (session.state.stage === 'incompatible') { setInstallTarget(board); setInstallReturn('pair-project'); setStep('prepare'); return; }
    if (session.state.stage !== 'ready') return;
    try {
      await verifySession();
      await session.provisionPair('project', pairCredentials);
      onChangeCentralDisplay({ boardProfile: WAVESHARE, hardwareId: pairCredentials.screenHardwareId, ssid: pairCredentials.ssid });
      setStep('send');
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'No pudimos vincular la placa del proyecto.'); }
  };
  const close = () => { if (state.stage === 'sending' || usbBusy(installState)) return; void session.close().finally(onClose); };
  const beginInstall = async (target = board, returnTo: GuideStep = 'connect') => { await session.close(); setInstallTarget(target); setInstallReturn(returnTo); setInstalling(true); setStep('prepare'); };
  const flash = () => installer.flash(requestVerifiedPort, signal => fetchInterpreterFirmware(installTarget, signal), signal => verifySession(signal));
  const act = (operation: Promise<unknown>) => { setActionError(''); void operation.catch(cause => setActionError(cause instanceof Error ? cause.message : 'La placa rechazó la operación.')); };
  const authorized = (operation: () => Promise<unknown>) => act(verifySession().then(operation));
  const configureWifi = () => authorized(async () => { await session.provisionWifi(wifiSsid, wifiPassword); setWifiPassword(''); setStep('send'); });
  const sendAndRun = () => bundle && authorized(async () => { await session.send(bundle); await session.command('RUN'); onMirrorCommand('RUN'); setStep('run'); setMinimized(true); });
  const physicalCommand = (command: 'RUN' | 'PAUSE' | 'RESUME' | 'STOP') => authorized(async () => { await session.command(command); onMirrorCommand(command); });
  useEffect(() => {
    controlRef.current = command => { if (command === 'SHOW') setMinimized(false); else physicalCommand(command); };
    return () => { controlRef.current = null; };
  });
  const rulesLoaded = state.progress === 100 || state.stage === 'running' || state.stage === 'paused';
  const flow = useMemo(() => ['review', ...(centralDisplay ? ['pair-screen', 'pair-project'] : []), 'connect', ...(needsManualWifi ? ['wifi'] : []), 'send', 'run'] as GuideStep[], [centralDisplay, needsManualWifi]);
  const flowIndex = Math.max(0, flow.indexOf(step === 'prepare' ? 'connect' : step === 'board' ? 'review' : step));
  const back = () => {
    setActionError('');
    if (step === 'board') { setCandidate(null); setStep('review'); }
    else if (step === 'connect') setStep('review');
    else if (step === 'pair-screen') setStep('review');
    else if (step === 'pair-project') { setPairCredentials(null); setStep('pair-screen'); }
    else if (step === 'prepare' && !usbBusy(installState)) { setInstalling(false); setStep(installReturn); }
    else if (step === 'wifi') setStep('connect');
    else if (step === 'send') setStep(needsManualWifi ? 'wifi' : 'connect');
    else if (step === 'run') setStep('send');
  };
  const visibleTelemetry = state.telemetry.filter(item => item.event !== 'device').slice(-20);
  return <><Dialog open={!minimized} onOpenChange={open => { if (!open && !minimized) close(); }}><DialogContent className="firmware-dialog usb-dialog" showCloseButton={state.stage !== 'sending'}>
    <DialogHeader><DialogTitle>⚡ Usar mi placa</DialogTitle><DialogDescription>Paso {flowIndex + 1} de {flow.length} · {step === 'review' ? 'Revisar las placas' : step === 'board' ? 'Elegir la placa del proyecto' : step === 'pair-screen' ? 'Preparar la pantalla central' : step === 'pair-project' ? 'Vincular la placa del proyecto' : step === 'connect' ? 'Conectar la placa' : step === 'prepare' ? 'Preparar la placa' : step === 'wifi' ? 'Configurar Wi-Fi' : step === 'send' ? 'Enviar el programa' : 'Programa en marcha'}</DialogDescription></DialogHeader>
    <progress className="board-guide-progress" value={flowIndex + 1} max={flow.length} aria-label={`Paso ${flowIndex + 1} de ${flow.length}`} />
    {!available && <p role="alert" className="account-error">Web Serial requiere Chrome o Edge de escritorio y una dirección HTTPS o localhost.</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
    {actionError && <p role="alert" className="account-error">{actionError}</p>}
    {revoked && <p role="alert" className="account-error">La sesión cambió o perdió conexión con el servidor. Cerramos USB; volvé a ingresar antes de usar la placa.</p>}
    {step === 'review' && <section className="board-guide-screen"><h3>{waveshareSimulation ? 'Simulación en la Waveshare' : 'Placas del proyecto'}</h3><div className="board-role-grid"><article className="board-role-card"><span>{waveshareSimulation ? 'Representa componentes virtuales' : 'Ejecuta el programa'}</span><h4>{waveshareSimulation ? 'Simulación en pantalla' : 'Placa del proyecto'}</h4><BoardPhoto id={board} /><strong>{boardProfile(board).name}</strong>{waveshareSimulation && <p>La pantalla muestra la escena y actualiza sus componentes virtuales. No se conectan a sus bornes ni necesitan GPIO.</p>}<Button variant="outline" onClick={() => setStep('board')}>{waveshareSimulation ? 'Usar una placa física' : 'Cambiar placa'}</Button></article>{!waveshareSimulation && <article className="board-role-card"><span>Muestra y controla la escena</span><h4>Pantalla central</h4>{centralDisplay ? <><BoardPhoto id={WAVESHARE} /><strong>{boardProfile(WAVESHARE).name}</strong><p>{centralDisplay.ssid ? `Emparejada como ${centralDisplay.ssid}` : 'Todavía falta emparejar las dos placas.'}</p><Button variant="outline" onClick={() => { setPairCredentials(null); setStep('pair-screen'); }}>{centralDisplay.ssid ? 'Volver a emparejar' : 'Preparar pareja'}</Button><Button variant="outline" onClick={() => onChangeCentralDisplay(undefined)}>Quitar pantalla</Button></> : <><div className="board-guide-hero" aria-hidden="true">🖥️</div><p>Opcional. Agrega la Waveshare sin reemplazar la placa que ejecuta.</p><Button variant="outline" onClick={() => { onChangeCentralDisplay({ boardProfile: WAVESHARE }); setPairCredentials(null); setStep('pair-screen'); }}>Agregar Waveshare</Button></>}</article>}</div><ul className="board-guide-checks"><li>✓ Tiene acciones para ejecutar</li><li>✓ Los bloques y componentes son compatibles</li>{waveshareSimulation && <li>✓ No requiere conexiones físicas</li>}{store.remote?.course && <li>✓ Pertenece al curso {store.remote.course.name}</li>}</ul><Button onClick={() => setStep(!waveshareSimulation && centralDisplay && !centralDisplay.hardwareId ? 'pair-screen' : 'connect')}>Continuar</Button></section>}
    {step === 'board' && <section className="board-guide-screen board-picker-screen"><h3>¿Qué placa ejecutará el programa?</h3><p>La Waveshare se elige aparte como Pantalla central. Las conexiones propuestas se aplican recién al confirmar.</p><div className="board-choice-grid">{boardChoices.map(choice => <article className="board-choice" data-current={choice.profile.id === board} data-unavailable={!choice.available && choice.profile.id !== board} key={choice.profile.id}><BoardPhoto id={choice.profile.id} /><h4>{choice.profile.shortName}</h4><p>{choice.profile.flashSize} flash{choice.profile.psramBytes ? ` · ${choice.profile.psramBytes / 1024 / 1024} MB PSRAM` : ''}</p>{choice.profile.id === board ? <strong>Placa actual</strong> : choice.available ? <Button variant="outline" onClick={() => setCandidate(choice.profile.id)}>Revisar cambio</Button> : <p className="account-help">No disponible: {choice.reason}</p>}</article>)}</div>{candidate && (() => { const choice = boardChoices.find(item => item.profile.id === candidate)!; return <output className="board-change-confirm"><h4>Cambiar a {choice.profile.name}</h4><p>{choice.changes.length ? `Hay ${choice.changes.length} conexión${choice.changes.length === 1 ? '' : 'es'} que cambiará${choice.changes.length === 1 ? '' : 'n'} al confirmar.` : 'Todas las conexiones actuales sirven en esta placa.'}</p>{(choice.changes.length > 0 || choice.warnings.length > 0) && <details><summary>Ver cambios de conexión</summary><ul>{choice.changes.map(change => <li key={change}>{change}</li>)}{choice.warnings.map((warning, index) => <li key={`warning-${index}`}>{warning}</li>)}</ul></details>}<div className="usb-actions"><Button onClick={() => { onChangeBoard(candidate, choice.scene); setCandidate(null); setStep('review'); }}>Confirmar cambio</Button><Button variant="outline" onClick={() => setCandidate(null)}>Cancelar</Button></div></output>; })()}</section>}
    {step === 'pair-screen' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">1️⃣</div><h3>Primero, conectá la pantalla central</h3><BoardPhoto id={WAVESHARE} /><p>CapiBloques leerá su identidad y creará automáticamente una red llamada <strong>WS + 6 caracteres</strong>. No tendrás que elegir una red ni escribir una contraseña.</p><div className="usb-status" role={state.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{state.message}</strong></div><Button disabled={!available || revoked || state.stage === 'connecting'} onClick={() => void connectPairScreen()}>Conectar y preparar Waveshare</Button><Button variant="outline" disabled={!available || revoked} onClick={() => void beginInstall(WAVESHARE, 'pair-screen')}>Instalar CapiBloques en la pantalla</Button></section>}
    {step === 'pair-project' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">2️⃣</div><h3>Ahora, conectá la placa del proyecto</h3><BoardPhoto id={board} /><p>Desconectá la Waveshare del USB y conectá {boardProfile(board).shortName}. CapiBloques copiará el perfil <strong>{pairCredentials?.ssid}</strong> de forma privada y automática.</p><div className="usb-status" role={state.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{state.message}</strong></div><Button disabled={!available || revoked || state.stage === 'connecting' || !pairCredentials} onClick={() => void connectPairProject()}>Conectar y terminar la pareja</Button><Button variant="outline" disabled={!available || revoked} onClick={() => void beginInstall(board, 'pair-project')}>Instalar CapiBloques en esta placa</Button></section>}
    {step === 'connect' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🔌</div><h3>Conectá {boardProfile(board).shortName}</h3><p>{waveshareSimulation ? 'Usá el USB de datos. Enviaremos la escena virtual: no conectes el semáforo ni otros componentes a la Waveshare.' : 'Usá un cable USB de datos. Después elegí la placa en la ventana del navegador.'}</p><div className="usb-status" role={state.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{state.message}</strong></div><Button disabled={!available || !!error || revoked || state.stage === 'connecting'} onClick={() => void connectBoard()}>Conectar mi placa</Button>{state.stage !== 'connecting' && <Button variant="outline" disabled={!available || revoked} onClick={() => void beginInstall(board, 'connect')}>Todavía no tiene CapiBloques</Button>}</section>}
    {step === 'prepare' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">⚙️</div><h3>Preparar {boardProfile(installTarget).shortName}</h3><p>Instalaremos CapiBloques una sola vez. Esto reemplaza el programa que tenga ahora la placa.</p>{!installing && <Button onClick={() => void beginInstall(installTarget, installReturn)}>{state.stage === 'incompatible' ? 'Instalar la versión correcta' : 'Preparar esta placa'}</Button>}{installing && <><div className="usb-status" role={installState.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{installState.message}</strong>{installState.writingStarted && <><progress value={installState.progress} max={100} /><span>{installState.progress}%</span></>}</div>{installState.stage !== 'done' && <fieldset className="usb-checks" disabled={usbBusy(installState)}><legend>Revisalo con una persona adulta</legend><label><input type="checkbox" checked={identified} onChange={event => setIdentified(event.target.checked)} /> Es la placa correcta.</label><label><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} /> Motores y actuadores están desconectados.</label><label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} /> Podemos reemplazar el programa actual.</label></fieldset>}{!usbBusy(installState) && installState.stage !== 'done' && <Button disabled={!available || revoked || !identified || !safe || !replace} onClick={flash}>Instalar CapiBloques</Button>}{usbBusy(installState) && <Button variant="outline" onClick={() => installer.cancel()}>Cancelar instalación</Button>}{installState.stage === 'done' && <Button onClick={() => { setInstalling(false); setIdentified(false); setSafe(false); setReplace(false); setStep(installReturn); }}>Continuar</Button>}</>}</section>}
    {step === 'wifi' && <section className="board-guide-screen firmware-wifi"><div className="board-guide-hero" aria-hidden="true">📶</div><h3>¿Este proyecto usará Wi-Fi?</h3><p>La clave viaja directamente a la placa. No se guarda en el proyecto ni se envía al servidor.</p><label htmlFor="interpreter-wifi-ssid">Nombre de la red</label><Input id="interpreter-wifi-ssid" autoComplete="off" maxLength={32} value={wifiSsid} onChange={event => setWifiSsid(event.target.value)} /><label htmlFor="interpreter-wifi-password">Clave de la red</label><Input id="interpreter-wifi-password" type="password" autoComplete="new-password" maxLength={63} value={wifiPassword} onChange={event => setWifiPassword(event.target.value)} placeholder="Vacía sólo para una red abierta" /><Button disabled={!wifiSsid.trim() || (!!wifiPassword && wifiPassword.length < 8)} onClick={configureWifi}>Guardar y continuar</Button><Button variant="outline" onClick={() => setStep('send')}>No cambiar la red ahora</Button></section>}
    {step === 'send' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🚀</div><h3>Enviar el programa</h3><p>La placa está lista. Enviaremos las reglas y comenzará a ejecutarlas.</p><div className="usb-status" role={state.stage === 'error' ? 'alert' : 'status'} aria-live="polite"><strong>{state.message}</strong>{state.stage === 'sending' && <><progress value={state.progress} max={100} /><span>{state.progress}%</span></>}</div><Button className="board-run-button" disabled={!bundle || state.stage === 'sending'} onClick={sendAndRun}>{rulesLoaded ? 'Volver a enviar y ejecutar' : 'Enviar y ejecutar'}</Button>{bundle && <details><summary>Ver detalles técnicos</summary><p>{bundle.instructionCount} instrucciones · {bundle.bytes.length.toLocaleString('es-AR')} bytes · control {bundle.checksum}</p><p>Una transferencia interrumpida no reemplaza las últimas reglas completas.</p>{state.hello && <p>Firmware {state.hello.firmware} · ABI {state.hello.abi}</p>}</details>}</section>}
    {step === 'run' && <section className="board-guide-screen"><div className="board-guide-hero" aria-hidden="true">🎉</div><h3>¡El programa está en marcha!</h3><p>{state.message}</p><div className="usb-actions">{state.stage === 'running' && <><Button onClick={() => physicalCommand('PAUSE')}>Pausar</Button><Button variant="outline" onClick={() => physicalCommand('STOP')}>Detener</Button></>}{state.stage === 'paused' && <><Button onClick={() => physicalCommand('RESUME')}>Continuar</Button><Button variant="outline" onClick={() => physicalCommand('STOP')}>Detener</Button></>}</div>{!!visibleTelemetry.length && <details><summary>Ver qué está haciendo la placa</summary><ol className="execution-trace">{visibleTelemetry.map((item, index) => <li key={`${item.event}-${index}`}>{telemetryText(item)}</li>)}</ol></details>}<Button onClick={() => setMinimized(true)}>Ver la escena sincronizada</Button><Button variant="outline" onClick={() => setStep('send')}>Enviar cambios otra vez</Button></section>}
    {step !== 'review' && step !== 'run' && <div className="board-guide-footer"><Button variant="outline" disabled={state.stage === 'sending' || usbBusy(installState)} onClick={back}>Atrás</Button></div>}
  </DialogContent></Dialog></>;
}
