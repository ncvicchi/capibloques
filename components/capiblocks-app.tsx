'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  AlertTriangle,
  Blocks,
  Braces,
  Cable,
  Check,
  CircleStop,
  Clipboard,
  Code2,
  Download,
  FileJson,
  FolderOpen,
  Gauge,
  Maximize2,
  LogOut,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  StepForward,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import BlocklyWorkspace, {
  type BlocklyHistoryState,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly-workspace';
import SceneStage from '@/components/scene-stage';
import ExecutionPanel from '@/components/execution-panel';
import UserAvatar from '@/components/user-avatar';
import PreferencesPicker from '@/components/preferences-picker';
import { useAccountPreferences } from '@/components/use-account-preferences';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  collectRawOutputPins,
  decodeProject,
  downloadText,
  examples,
  generateEsp32CodeResult,
  programUsesWifi,
  makeProject,
  safeFilename,
  validateProgramForScene,
  type CapiDiagnostic,
  type CompiledProgram,
  type ExecutionTaskState,
  type ProjectFile,
  type RuntimeDeviceState,
  type SceneId,
  type SimulatorState,
  type FirmwareFramework,
} from '@/lib/capiblocks';
import { createEspIdfArchive, downloadFirmwareArchive } from '@/lib/firmware-archive';
import {
  addDeviceToScene,
  cloneScene,
  sceneDeviceKinds,
  type SceneDefinition,
  type SceneDevice,
  type SceneDeviceKind,
} from '@/lib/scene-model';
import { exportLocalSceneCopy, isSceneDraft, type SceneDraft } from '@/lib/scene-recovery';
// Vite convierte el sufijo `?worker` en un constructor durante el build.
// oxlint-disable-next-line import/default
import SimulatorWorker from '@/lib/simulator.worker.ts?worker';
import type { Account, AccountDraftStore } from '@/lib/account-session';
import type { EditorCheckpoint } from '@/components/editor-access';
import ProjectLibrary, { type ProjectLibraryHandle } from '@/components/project-library';
import FirmwareBuilds from '@/components/firmware-builds';
import UsbBoard from '@/components/usb-board';
import type { FirmwareJob } from '@/lib/usb-firmware';
import { projectFingerprint } from '@/lib/project-library';

const SceneBuilder = lazy(() => import('@/components/scene-builder'));
const WiringGuide = lazy(() => import('@/components/wiring-guide'));

const emptyProgram = (): CompiledProgram => ({ version: 2, threads: [] });

function wiringReviewSignature(
  scene: SceneDefinition,
  program: CompiledProgram,
) {
  return JSON.stringify([
    scene.devices.map((device) => [device.id, device.kind, device.pins, device.kind === 'display' ? device.config : null]),
    collectRawOutputPins(program, scene),
  ]);
}

function hasPhysicalConnections(
  scene: SceneDefinition,
  program: CompiledProgram,
) {
  return (
    scene.devices.some((device) => device.kind !== 'wifiNode') ||
    collectRawOutputPins(program, scene).length > 0
  );
}

let sharedAudioContext: AudioContext | null = null;
const activeSounds = new Map<
  string,
  { oscillator: OscillatorNode; gain: GainNode }
>();

function stopSound(key?: string) {
  const entries = key
    ? ([[key, activeSounds.get(key)]] as const)
    : [...activeSounds.entries()];
  for (const [soundKey, nodes] of entries) {
    if (!nodes) continue;
    try {
      nodes.gain.gain.cancelScheduledValues(
        sharedAudioContext?.currentTime ?? 0,
      );
      nodes.gain.gain.setValueAtTime(
        0.0001,
        sharedAudioContext?.currentTime ?? 0,
      );
      nodes.oscillator.stop();
    } catch {
      // El navegador puede haber finalizado el oscilador entre eventos.
    }
    activeSounds.delete(soundKey);
  }
}

function sound(
  frequency: number,
  durationMs: number,
  muted: boolean,
  volume = 0.055,
  key = 'interface',
) {
  if (muted || typeof window === 'undefined') return;
  sharedAudioContext ??= new AudioContext();
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => undefined);
  }
  stopSound(key);
  const oscillator = sharedAudioContext.createOscillator();
  const gain = sharedAudioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = Math.max(40, Math.min(5000, frequency));
  gain.gain.setValueAtTime(volume, sharedAudioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    sharedAudioContext.currentTime + durationMs / 1000,
  );
  oscillator.connect(gain).connect(sharedAudioContext.destination);
  activeSounds.set(key, { oscillator, gain });
  oscillator.addEventListener('ended', () => {
    if (activeSounds.get(key)?.oscillator === oscillator) {
      activeSounds.delete(key);
    }
  });
  oscillator.start();
  oscillator.stop(sharedAudioContext.currentTime + durationMs / 1000);
}

function runtimeFromDevice(
  device: SceneDevice,
  scene: SceneDefinition,
): RuntimeDeviceState {
  switch (device.kind) {
    case 'display': return { kind: 'display', texts: {} };
    case 'trafficLight':
      return { kind: device.kind, color: 'OFF' };
    case 'led':
      return { kind: device.kind, brightness: device.config.brightness };
    case 'robot':
      return {
        kind: device.kind,
        x: (device.position.x / scene.canvas.width) * 100,
        y: (device.position.y / scene.canvas.height) * 100,
        angle: device.rotation + device.config.heading,
        left: 0,
        right: 0,
      };
    case 'motor':
      return { kind: device.kind, power: 0 };
    case 'servo':
      return { kind: device.kind, angle: device.config.angle };
    case 'activeBuzzer':
    case 'passiveBuzzer':
      return {
        kind: device.kind,
        playing: false,
        frequency:
          device.kind === 'passiveBuzzer' ? device.config.frequency : 0,
        stopAt: 0,
      };
    case 'button':
      return { kind: device.kind, pressed: device.config.pressed };
    case 'lightSensor':
    case 'potentiometer':
      return { kind: device.kind, value: device.config.value };
    case 'wifiNode':
      return {
        kind: device.kind,
        status:
          device.config.status === 'idle'
            ? 'disconnected'
            : device.config.status,
      };
  }
}

function makeInitialState(scene: SceneDefinition): SimulatorState {
  const devices = Object.fromEntries(
    scene.devices.map((device) => [
      device.id,
      runtimeFromDevice(device, scene),
    ]),
  );
  const traffic = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { kind: 'trafficLight' }> =>
      device.kind === 'trafficLight',
  );
  const led = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { kind: 'led' }> =>
      device.kind === 'led',
  );
  const servo = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { kind: 'servo' }> =>
      device.kind === 'servo',
  );
  const robot = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { kind: 'robot' }> =>
      device.kind === 'robot',
  );
  const button = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { kind: 'button' }> =>
      device.kind === 'button',
  );
  const light = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { value: number }> =>
      device.kind === 'lightSensor',
  );
  const potentiometer = Object.values(devices).find(
    (device): device is Extract<RuntimeDeviceState, { value: number }> =>
      device.kind === 'potentiometer',
  );
  return {
    now: 0,
    status: 'idle',
    devices,
    wifi: 'disconnected',
    wifiAvailable: true,
    counter: 0,
    pins: {},
    console: [],
    activeBlockIds: {},
    traffic: traffic?.color ?? 'OFF',
    ledBrightness: led?.brightness ?? 0,
    servoAngle: servo?.angle ?? 90,
    buzzer: 'off',
    robot: robot ?? { x: 50, y: 50, angle: 0, left: 0, right: 0 },
    inputs: {
      button: button?.pressed ?? false,
      light: light?.value ?? 2048,
      potentiometer: potentiometer?.value ?? 2048,
      wifiAvailable: true,
    },
  };
}

function statusText(status: SimulatorState['status']) {
  const labels = {
    idle: 'Listo para probar',
    running: 'Programa en marcha',
    paused: 'Programa en pausa',
    done: 'Programa terminado',
    stopped: 'Programa detenido',
  };
  return labels[status];
}

function normalizeWorkspace(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function hasExecutableNodes(program: CompiledProgram) {
  return program.threads.some((thread) => thread.nodes.length > 0);
}

function deviceReading(device: RuntimeDeviceState | undefined) {
  if (!device) return 'Listo';
  switch (device.kind) {
    case 'trafficLight':
      return device.color === 'OFF' ? 'Apagado' : device.color;
    case 'display': return Object.values(device.texts).some(lines => lines.join('').trim()) ? 'Con texto' : 'Sin texto';
    case 'led':
      return `${Math.round(device.brightness)}%`;
    case 'robot':
      return `L ${Math.round(device.left)}% · R ${Math.round(device.right)}%`;
    case 'motor':
      return `${Math.round(device.power)}%`;
    case 'servo':
      return `${Math.round(device.angle)}°`;
    case 'activeBuzzer':
    case 'passiveBuzzer':
      return device.playing ? `${Math.round(device.frequency)} Hz` : 'Apagado';
    case 'button':
      return device.pressed ? 'Presionado' : 'Libre';
    case 'lightSensor':
    case 'potentiometer':
      return String(Math.round(device.value));
    case 'wifiNode':
      return device.status === 'connected'
        ? 'Conectado'
        : device.status === 'connecting'
          ? 'Buscando…'
          : device.status === 'error'
            ? 'Sin red'
            : 'Listo';
  }
}

function DeviceStateCard({
  device,
  runtime,
}: {
  device: SceneDevice;
  runtime?: RuntimeDeviceState;
}) {
  const icons: Record<SceneDeviceKind, string> = {
    trafficLight: '🚦',
    robot: '🤖',
    motor: '⚙️',
    led: '💡',
    servo: '🦾',
    activeBuzzer: '📣',
    passiveBuzzer: '🎵',
    button: '🔘',
    lightSensor: '☀️',
    potentiometer: '🎚️',
    wifiNode: '📶',
    display: '📺',
  };
  return (
    <article>
      <span>
        {icons[device.kind]} {device.name}
      </span>
      <strong>{deviceReading(runtime)}</strong>
      {runtime?.kind === 'led' && (
        <div className="brightness-track">
          <i style={{ width: `${runtime.brightness}%` }} />
        </div>
      )}
      {runtime?.kind === 'servo' && (
        <div className="servo-dial">
          <i style={{ transform: `rotate(${runtime.angle - 90}deg)` }} />
        </div>
      )}
    </article>
  );
}

export default function CapiBlocksApp({ account, draftStore, checkpointRef, onLogout, csrfToken, offline = false }: {
  offline?: boolean;
  csrfToken: string;
  account: Account;
  draftStore: AccountDraftStore;
  checkpointRef: RefObject<EditorCheckpoint | null>;
  onLogout: () => void;
}) {
  const currentExample = examples[0];
  const preferences = useAccountPreferences(account.id, !offline && draftStore.remoteAllowed);
  const [preferencesOpen, setPreferencesOpen] = useState<'avatar'|'favorites'|null>(null);
  const initialScene = useMemo(
    () => cloneScene(currentExample.scene),
    [currentExample.scene],
  );
  const editorRef = useRef<BlocklyWorkspaceHandle>(null);
  const libraryRef = useRef<ProjectLibraryHandle>(null);
  const workerRef = useRef<Worker | null>(null);
  const playbackSourceRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImportRef = useRef<(() => void) | null>(null);
  const mutedRef = useRef(false);
  const speedRef = useRef(1);
  const pendingHighlightFrameRef = useRef<number | null>(null);
  const pendingExecutionTasksRef = useRef<ExecutionTaskState[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [projectName, setProjectName] = useState(currentExample.title);
  const [scene, setScene] = useState<SceneDefinition>(initialScene);
  const [workspace, setWorkspace] = useState<Record<string, unknown>>(
    currentExample.workspace,
  );
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [sim, setSim] = useState<SimulatorState>(() =>
    makeInitialState(initialScene),
  );
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [sceneBuilderOpen, setSceneBuilderOpen] = useState(false);
  const sceneCommitRef = useRef<SceneDefinition | null>(null);
  const localSaveTimerRef = useRef<number | undefined>(undefined);
  const [sceneStorage, setSceneStorage] = useState({ error: draftStore.recoveryError, busy: draftStore.recovering });
  useEffect(() => draftStore.subscribe(() => setSceneStorage({ error: draftStore.recoveryError, busy: draftStore.recovering })), [draftStore]);
  const [wiringOpen, setWiringOpen] = useState(false);
  const [wiringAcknowledgedSignature, setWiringAcknowledgedSignature] =
    useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeFramework, setCodeFramework] = useState<FirmwareFramework>('arduino');
  const [exportBusy, setExportBusy] = useState(false);
  const [buildsOpen, setBuildsOpen] = useState(false);
  const [usbOpen, setUsbOpen] = useState(false);
  const [usbJob, setUsbJob] = useState<FirmwareJob | null>(null);
  const exportInFlight = useRef(false);
  const exportEpoch = useRef(0);
  useEffect(() => { const current = ++exportEpoch.current; return () => { exportEpoch.current = current + 1; }; }, [account.id]);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('Recuperación local activa · Guardar sube a tu cuenta');
  const [noticeTone, setNoticeTone] = useState<'ok' | 'warning' | 'error'>(
    'ok',
  );
  const [diagnostics, setDiagnostics] = useState<CapiDiagnostic[]>([]);
  const [blockHistory, setBlockHistory] = useState<BlocklyHistoryState>({
    canUndo: false,
    canRedo: false,
  });
  const [activeTab, setActiveTab] = useState('scene');
  const [lastProgram, setLastProgram] = useState<CompiledProgram>(emptyProgram);

  const sourceExample = useMemo(
    () =>
      examples.find((example) => example.id === scene.sourceTemplate || (example.id === 'display' && example.scene.id === scene.id)) ?? null,
    [scene.sourceTemplate, scene.id],
  );

  const postToWorker = useCallback((message: Record<string, unknown>) => {
    if (!draftStore.active && message.type !== 'PAUSE' && message.type !== 'STOP') return;
    workerRef.current?.postMessage(message);
  }, [draftStore]);

  useEffect(() => {
    let disposed = false;
    const worker = new SimulatorWorker();
    workerRef.current = worker;
    const flushHighlights = () => {
      pendingHighlightFrameRef.current = null;
      editorRef.current?.showExecution(pendingExecutionTasksRef.current);
    };
    const scheduleHighlight = () => {
      if (pendingHighlightFrameRef.current !== null) return;
      pendingHighlightFrameRef.current = requestAnimationFrame(flushHighlights);
    };
    worker.addEventListener('message', (event) => {
      if (event.data.type === 'SNAPSHOT') {
        const nextState = event.data.state as SimulatorState;
        setSim(nextState);
        pendingExecutionTasksRef.current = nextState.execution?.tasks ?? [];
        scheduleHighlight();
      }
      if (event.data.type === 'SOUND') {
        if (!draftStore.active) return;
        sound(
          event.data.frequency,
          event.data.durationMs / speedRef.current,
          mutedRef.current,
          0.035,
          `device:${String(event.data.deviceId ?? 'unknown')}`,
        );
      }
      if (event.data.type === 'SOUND_STOP') {
        const deviceId =
          typeof event.data.deviceId === 'string'
            ? `device:${event.data.deviceId}`
            : undefined;
        stopSound(deviceId);
      }
      if (event.data.type === 'DIAGNOSTICS') {
        const received = Array.isArray(event.data.diagnostics)
          ? (event.data.diagnostics as CapiDiagnostic[])
          : [];
        setDiagnostics(received);
        if (event.data.simulationBlocked) {
          setNoticeTone('error');
          setNotice('Hay bloques que necesitan una corrección antes de probar');
        } else if (received.length) {
          setNoticeTone('warning');
          setNotice(
            'La simulación puede continuar; revisá estos avisos antes de conectar la placa',
          );
        }
      }
      if (event.data.type === 'DONE') {
        if (!draftStore.active) return;
        sound(980, 140, mutedRef.current);
        window.setTimeout(() => { if (!disposed && draftStore.active) sound(1320, 180, mutedRef.current); }, 100);
      }
    });
    return () => {
      disposed = true;
      if (pendingHighlightFrameRef.current !== null) {
        cancelAnimationFrame(pendingHighlightFrameRef.current);
      }
      stopSound();
      worker.terminate();
    };
  }, [draftStore]);

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(async () => {
      try {
        const currentSaved = await draftStore.read();
        if (disposed) return;
        const soundSetting = localStorage.getItem(draftStore.mutedKey);
        if (soundSetting !== null) setMuted(soundSetting === 'true');

        let recovered: ReturnType<typeof decodeProject> | null = null;
        let recoveryMessage = '';
        for (const saved of [currentSaved]) {
          if (!saved) continue;
          try {
            const decoded = decodeProject(JSON.parse(saved) as unknown);
            if (decoded.project) {
              recovered = decoded;
              break;
            }
            recoveryMessage ||= decoded.diagnostics[0]?.message ?? '';
          } catch (error) {
            recoveryMessage ||=
              error instanceof Error ? error.message : 'JSON no válido';
          }
        }

        if (recovered?.project) {
          setProjectName(recovered.project.metadata.title);
          setScene(cloneScene(recovered.project.scene));
          setSim(makeInitialState(recovered.project.scene));
          setSpeed(recovered.project.simulation.speed);
          speedRef.current = recovered.project.simulation.speed;
          setWorkspace(normalizeWorkspace(recovered.project.workspace));
          setWorkspaceRevision((value) => value + 1);
          setNotice(
            recovered.migrated
              ? 'Recuperamos y actualizamos tu proyecto anterior'
              : 'Recuperamos tu último proyecto',
          );
          setNoticeTone('ok');
        } else if (currentSaved) {
          setNotice(
            recoveryMessage ||
              'El proyecto guardado no era compatible; empezamos uno nuevo',
          );
          setNoticeTone('warning');
        }
      } catch (error) {
        if (disposed) return;
        setNotice(
          error instanceof Error
            ? `No pudimos usar el guardado del navegador: ${error.message}`
            : 'No pudimos usar el guardado del navegador',
        );
        setNoticeTone('warning');
      } finally {
        if (!disposed) setHydrated(true);
      }
    }, 0);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [draftStore]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        const project = makeProject(
          projectName,
          scene,
          editorRef.current?.save() ?? workspace,
          speed,
        );
        draftStore.write(JSON.stringify(project));
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `No pudimos guardar en este navegador: ${error.message}`
            : 'No pudimos guardar en este navegador',
        );
        setNoticeTone('error');
      }
    }, 350);
    localSaveTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [draftStore, hydrated, projectName, scene, speed, workspace]);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted) stopSound();
    if (!hydrated) return;
    try {
      if (draftStore.active) localStorage.setItem(draftStore.mutedKey, String(muted));
    } catch {
      // Silenciar sigue funcionando aunque el navegador bloquee preferencias.
    }
  }, [draftStore, hydrated, muted]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const onBlockSnap = useCallback(
    () => sound(420, 45, mutedRef.current || !draftStore.active, 0.025),
    [draftStore],
  );

  const onWorkspaceChange = useCallback(
    (nextWorkspace: Record<string, unknown>) => {
      if (playbackSourceRef.current !== null && playbackSourceRef.current !== JSON.stringify(nextWorkspace)) {
        playbackSourceRef.current = null;
        workerRef.current?.postMessage({ type: 'STOP' });
        stopSound();
        setNotice('Cambiaste los bloques. Ejecutar o Paso comenzará con el programa actualizado.');
      }
      setWorkspace(nextWorkspace);
      setDiagnostics([]);
      setNoticeTone('ok');
    },
    [],
  );

  const compile = useCallback(() => {
    const program = editorRef.current?.compile() ?? emptyProgram();
    setLastProgram(program);
    return program;
  }, []);

  const run = useCallback(() => {
    const program = compile();
    if (!hasExecutableNodes(program)) {
      setNotice('Conectá acciones dentro de «Al comenzar» para ejecutar');
      setNoticeTone('warning');
      sound(210, 180, muted);
      return;
    }
    const programDiagnostics = validateProgramForScene(program, scene);
    const blockingDiagnostics = programDiagnostics.filter(
      (item) =>
        item.severity === 'error' &&
        ['target-missing', 'target-kind-mismatch', 'too-many-threads'].includes(
          item.code,
        ),
    );
    setDiagnostics(programDiagnostics);
    if (blockingDiagnostics.length) {
      setNoticeTone('error');
      setNotice(
        'Hay bloques sin componente. Abrí los problemas para corregirlos.',
      );
      setProblemsOpen(true);
      sound(210, 180, muted);
      return;
    }
    playbackSourceRef.current = JSON.stringify(editorRef.current?.save());
    postToWorker({ type: 'LOAD', program, scene });
    postToWorker({ type: 'SET_SPEED', speed });
    postToWorker({ type: 'RUN' });
    setNotice(
      program.threads.length > 1
        ? `${program.threads.length} programas comenzaron a la vez`
        : 'Simulación de comportamiento iniciada',
    );
    setNoticeTone('ok');
    sound(620, 90, muted);
  }, [compile, muted, postToWorker, scene, speed]);

  const step = useCallback(() => {
    if (
      sim.status === 'idle' ||
      sim.status === 'done' ||
      sim.status === 'stopped'
    ) {
      const program = compile();
      if (!hasExecutableNodes(program)) {
        setNotice('Conectá acciones dentro de «Al comenzar» para avanzar paso a paso');
        setNoticeTone('warning');
        return;
      }
      playbackSourceRef.current = JSON.stringify(editorRef.current?.save());
      postToWorker({ type: 'LOAD', program, scene });
      postToWorker({ type: 'SET_SPEED', speed });
    }
    postToWorker({ type: 'STEP' });
    setNotice('Avanzamos un paso visible. El panel «Ahora» explica qué ocurrió.');
    setNoticeTone('ok');
  }, [compile, postToWorker, scene, sim.status, speed]);

  const reset = useCallback(() => {
    postToWorker({ type: 'RESET' });
    stopSound();
    pendingExecutionTasksRef.current = [];
    editorRef.current?.showExecution();
    setSim(makeInitialState(scene));
    setNotice('Escena reiniciada');
    setNoticeTone('ok');
  }, [postToWorker, scene]);

  const changeScene = useCallback((nextScene: SceneDefinition) => {
    const customizedScene = cloneScene(nextScene);
    delete customizedScene.sourceTemplate;
    setScene(customizedScene);
    setWiringAcknowledgedSignature(null);
    setDiagnostics([]);
    setNotice('Escena actualizada; los bloques ya ven sus componentes');
    setNoticeTone('ok');
  }, []);

  const toggleSceneBuilder = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        postToWorker({ type: 'STOP' });
        stopSound();
      } else {
        setSim(makeInitialState(scene));
        editorRef.current?.showExecution();
      }
      setSceneBuilderOpen(nextOpen);
    },
    [postToWorker, scene],
  );

  const loadExample = useCallback(
    (id: SceneId | 'display') => {
      const applyExample = () => {
      libraryRef.current?.detach();
      const example = examples.find((item) => item.id === id) ?? examples[0];
      const nextScene = cloneScene(example.scene);
      postToWorker({ type: 'STOP' });
      stopSound();
      setProjectName(example.title);
      setScene(nextScene);
      setSim(makeInitialState(nextScene));
      setWorkspace(example.workspace);
      setWorkspaceRevision((value) => value + 1);
      setWiringAcknowledgedSignature(null);
      setDiagnostics([]);
      setExamplesOpen(false);
      setActiveTab('scene');
      setNotice(`Ejemplo cargado: ${example.title}`);
      setNoticeTone('ok');
      };
      if (libraryRef.current) libraryRef.current.replace(applyExample); else applyExample();
    },
    [postToWorker],
  );

  const addSceneComponent = useCallback(
    (kind: SceneDeviceKind) => {
      postToWorker({ type: 'STOP' });
      setScene((current) => {
        if (kind === 'display' && current.devices.some(device => device.kind === 'display')) {
          setNotice('Cada proyecto admite una pantalla. Configurá la existente desde Armar escena.');
          return current;
        }
        const result = addDeviceToScene(current, kind);
        delete result.scene.sourceTemplate;
        setSim(makeInitialState(result.scene));
        setWiringAcknowledgedSignature(null);
        setDiagnostics([]);
        setNotice(`${result.device.name} agregado a la escena`);
        return result.scene;
      });
    },
    [postToWorker],
  );

  const currentProject = useCallback((): ProjectFile => {
    const savedWorkspace = editorRef.current?.save() ?? workspace;
    return makeProject(projectName, sceneCommitRef.current ?? scene, savedWorkspace, speed);
  }, [projectName, scene, speed, workspace]);

  const persistSceneDraft = useCallback((draft: SceneDraft | null) => {
    if (!draftStore.active || sceneCommitRef.current) return;
    draftStore.setSceneDraft(draft);
    draftStore.write(JSON.stringify(currentProject()));
  }, [currentProject, draftStore]);

  const finishScene = useCallback(async (nextScene?: SceneDefinition) => {
    if (!draftStore.active) throw new Error('Verificá tu sesión antes de confirmar la escena.');
    window.clearTimeout(localSaveTimerRef.current);
    const previousDraft = draftStore.sceneDraft;
    if (nextScene) { sceneCommitRef.current = cloneScene(nextScene); delete sceneCommitRef.current.sourceTemplate; }
    draftStore.setSceneDraft(null);
    try {
      draftStore.write(JSON.stringify(currentProject()));
      await draftStore.flush();
      if (sceneCommitRef.current) changeScene(sceneCommitRef.current);
    } catch (failure) {
      draftStore.setSceneDraft(previousDraft);
      throw failure;
    } finally { sceneCommitRef.current = null; }
  }, [changeScene, currentProject, draftStore]);

  const fingerprint = useMemo(() => projectFingerprint(makeProject(projectName, scene, workspace, speed)), [projectName, scene, workspace, speed]);
  const applyLibraryProject = useCallback((file: ProjectFile) => {
    postToWorker({ type: 'STOP' }); stopSound();
    const nextScene = cloneScene(file.scene);
    setProjectName(file.metadata.title); setScene(nextScene); setSim(makeInitialState(nextScene));
    setSpeed(file.simulation.speed); speedRef.current = file.simulation.speed;
    setWorkspace(normalizeWorkspace(file.workspace)); setWorkspaceRevision(value => value + 1);
    setWiringAcknowledgedSignature(null); setDiagnostics([]); setActiveTab('scene');
    setNotice('Proyecto abierto · revisá el estado junto a Guardar'); setNoticeTone('ok');
  }, [postToWorker]);

  const newLibraryProject = useCallback(() => {
    const blank = cloneScene(examples[0].scene);
    blank.id = crypto.randomUUID(); blank.name = 'Mi escena'; blank.description = '';
    blank.devices = []; blank.widgets = []; blank.retiredDeviceIds = []; blank.canvas.background = 'blank'; delete blank.sourceTemplate;
    applyLibraryProject(makeProject('Mi aventura', blank, { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: crypto.randomUUID(), x: 40, y: 40 }] } }, 1));
  }, [applyLibraryProject]);

  useLayoutEffect(() => {
    checkpointRef.current = { ready: () => hydrated, suspend: () => {
      postToWorker({ type: 'PAUSE' });
      stopSound();
      // Capturar el proyecto confirmado antes de cancelar el debounce. El borrador
      // de Armar escena se conserva por separado en la misma transacción local.
      if (hydrated && draftStore.active) {
        try { draftStore.write(JSON.stringify(currentProject())); }
        catch { setNotice('No pudimos guardar el último cambio. Exportá una copia JSON antes de cerrar sesión.'); setNoticeTone('error'); return false; }
      }
      return true;
    }, resume: () => {
      const pending = pendingImportRef.current;
      pendingImportRef.current = null;
      pending?.();
    } };
    return () => { checkpointRef.current = null; };
  }, [checkpointRef, currentProject, draftStore, hydrated, postToWorker]);

  const saveToBrowser = useCallback(async () => {
    try {
      draftStore.write(JSON.stringify(currentProject()));
      await draftStore.flush();
      if (!draftStore.active) return;
      setNotice('Proyecto guardado para tu cuenta en este navegador');
      setNoticeTone('ok');
      sound(760, 80, muted);
    } catch (error) {
      if (!draftStore.active) return;
      setNotice(
        error instanceof Error
          ? `No pudimos guardar: ${error.message}`
          : 'No pudimos guardar el proyecto',
      );
      setNoticeTone('error');
    }
  }, [currentProject, draftStore, muted]);

  const exportJson = useCallback(() => {
    try {
      const project = currentProject();
      downloadText(
        `${safeFilename(projectName)}.capibloques.json`,
        JSON.stringify(project, null, 2),
        'application/json',
      );
      setNotice('Proyecto JSON exportado con escena, bloques y conexiones');
      setNoticeTone('ok');
      sound(860, 100, muted);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'No pudimos exportar el proyecto',
      );
      setNoticeTone('error');
    }
  }, [currentProject, muted, projectName]);

  const buildCode = useCallback((framework: FirmwareFramework = codeFramework) => {
    const program = compile();
    const result = generateEsp32CodeResult(program, projectName, scene, framework);
    setCodeFramework(framework);
    setCopied(false);
    setCode(result.code);
    setDiagnostics(result.diagnostics);
    const errors = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    const warnings = result.diagnostics.length - errors.length;
    if (errors.length) {
      setNotice(`${errors.length} problema(s) impiden completar el código`);
      setNoticeTone('error');
    } else if (warnings) {
      setNotice(`Código generado con ${warnings} aviso(s) de cableado`);
      setNoticeTone('warning');
    } else {
      setNotice('Código listo para revisar y descargar');
      setNoticeTone('ok');
    }
    return result;
  }, [compile, projectName, scene, codeFramework]);

  const openCode = useCallback(() => {
    buildCode();
    setCodeOpen(true);
  }, [buildCode]);

  const openWiring = useCallback(() => {
    buildCode();
    setWiringOpen(true);
  }, [buildCode]);

  const exportCode = useCallback(async (framework: FirmwareFramework = codeFramework) => {
    if (exportInFlight.current) return;
    const generated = buildCode(framework);
    const errors = generated.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    if (errors.length) {
      setNotice(
        `Corrige ${errors.length} problema(s) antes de descargar a la Wemos`,
      );
      setProblemsOpen(true);
      setNoticeTone('error');
      sound(190, 160, muted, 0.035);
      return;
    }
    const reviewSignature = wiringReviewSignature(scene, generated.program);
    if (
      hasPhysicalConnections(scene, generated.program) &&
      wiringAcknowledgedSignature !== reviewSignature
    ) {
      setNotice(
        'Antes de descargar, revisá el cableado y la seguridad de la placa',
      );
      setNoticeTone('warning');
      setCodeOpen(false);
      setWiringOpen(true);
      return;
    }
    exportInFlight.current = true;
    setExportBusy(true);
    const epoch = exportEpoch.current;
    try {
      if (framework === 'esp-idf') {
        setNotice('Preparando proyecto ESP-IDF y verificando sus archivos…');
        await new Promise(resolve => setTimeout(resolve, 0));
        const archive = await createEspIdfArchive(generated);
        if (epoch !== exportEpoch.current) return;
        downloadFirmwareArchive(`${safeFilename(projectName)}-esp-idf.zip`, archive);
      } else downloadText(`${safeFilename(projectName)}.ino`, generated.code, 'text/x-c++src');
      setNotice(framework === 'esp-idf' ? 'Proyecto ESP-IDF .zip descargado: fuentes, configuración e instrucciones; no es un binario.' : 'Código .ino descargado para la Wemos D1 R32');
      setNoticeTone('ok');
    } catch (error) {
      if (epoch === exportEpoch.current) { setNotice(error instanceof Error ? error.message : 'No pudimos preparar la descarga.'); setNoticeTone('error'); }
    } finally { exportInFlight.current = false; if (epoch === exportEpoch.current) setExportBusy(false); }
  }, [buildCode, codeFramework, muted, projectName, scene, wiringAcknowledgedSignature]);

  const importProject = useCallback(
    async (file: File) => {
      try {
        if (file.size > 4 * 1024 * 1024) throw new Error('El archivo supera el límite de 4 MiB para copias con escena pendiente.');
        const raw = JSON.parse(await file.text());
        const localCopy = raw?.application === 'CapiBloquesLocalCopy';
        if (!localCopy && file.size > 2_000_000) throw new Error('El proyecto supera el límite de 2 MB');
        if (localCopy && (raw.version !== 1 || !isSceneDraft(raw.sceneDraft) || new TextEncoder().encode(JSON.stringify(raw.project)).byteLength > 2_000_000)) throw new Error('La copia con escena pendiente no es compatible.');
        const decoded = decodeProject(localCopy ? raw.project : raw);
        if (!decoded.project)
          throw new Error(
            decoded.diagnostics[0]?.message ??
              'No es un proyecto CapiBloques compatible',
          );
        const imported = decoded.project;
        const apply = () => {
        libraryRef.current?.detach();
        if (localCopy) draftStore.setSceneDraft(raw.sceneDraft);
        const nextScene = cloneScene(imported.scene);
        postToWorker({ type: 'STOP' });
        stopSound();
        setProjectName(imported.metadata.title);
        setScene(nextScene);
        setSim(makeInitialState(nextScene));
        setSpeed(imported.simulation.speed);
        setWorkspace(normalizeWorkspace(imported.workspace));
        setWorkspaceRevision((value) => value + 1);
        setWiringAcknowledgedSignature(null);
        setDiagnostics(decoded.diagnostics);
        setNotice(
          decoded.migrated
            ? 'Proyecto anterior convertido y abierto correctamente'
            : localCopy ? 'Proyecto importado. Hay una escena pendiente: abrí Armar escena para recuperarla.' : 'Proyecto importado correctamente',
        );
        setNoticeTone(decoded.diagnostics.length ? 'warning' : 'ok');
        sound(880, 120, muted);
        };
        // El selector de archivos puede devolver foco antes de que la verificación
        // termine. Esperar la misma sesión; nunca transferir la importación a otra.
        const requestApply = () => { if (libraryRef.current) libraryRef.current.replace(apply); else apply(); };
        if (draftStore.active) requestApply(); else {
          pendingImportRef.current = requestApply;
          setNotice('Archivo leído. Esperando verificar tu sesión para importarlo.');
        }
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'No pudimos abrir ese archivo',
        );
        setNoticeTone('error');
        sound(190, 180, muted || !draftStore.active);
      }
    },
    [draftStore, muted, postToWorker],
  );

  const setDeviceInput = useCallback(
    (deviceId: string, value: boolean | number) => {
      postToWorker({ type: 'SET_INPUT', deviceId, value });
    },
    [postToWorker],
  );

  const setWifiAvailable = useCallback(
    (value: boolean) => {
      postToWorker({ type: 'SET_INPUT', name: 'wifiAvailable', value });
    },
    [postToWorker],
  );

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool(
            tool: Record<string, unknown>,
            options?: { signal?: AbortSignal },
          ): void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const registrations = [
      modelContext.registerTool(
        {
          name: 'load_capiblocks_example',
          title: 'Cargar ejemplo de CapiBloques',
          description:
            'Carga un ejemplo visible de semáforo, contador, robot o Wi-Fi.',
          inputSchema: {
            type: 'object',
            properties: {
              example: {
                type: 'string',
                enum: ['traffic', 'counter', 'robot', 'wifi'],
              },
            },
            required: ['example'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            if (!draftStore.active) throw new Error('Verificá tu sesión antes de editar');
            const example = (input as { example?: SceneId })?.example;
            if (!example || !examples.some((item) => item.id === example))
              throw new Error('Ejemplo no válido');
            loadExample(example);
            return { requested: example, note: 'Puede requerir confirmar los cambios pendientes en el editor.' };
          },
        },
        { signal: lifecycle.signal },
      ),
      modelContext.registerTool(
        {
          name: 'add_capiblocks_component',
          title: 'Agregar componente a la escena',
          description:
            'Agrega un semáforo, robot, motor, LED, servo, buzzer, sensor o Wi-Fi a la escena actual.',
          inputSchema: {
            type: 'object',
            properties: {
              component: { type: 'string', enum: sceneDeviceKinds },
            },
            required: ['component'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            if (!draftStore.active) throw new Error('Verificá tu sesión antes de editar');
            const component = (input as { component?: SceneDeviceKind })
              ?.component;
            if (!component || !sceneDeviceKinds.includes(component))
              throw new Error('Componente no válido');
            addSceneComponent(component);
            return { added: component };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];
    void Promise.all(
      registrations.map((value) => Promise.resolve(value)),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [addSceneComponent, loadExample, draftStore]);

  const inputDevices = scene.devices.filter((device) =>
    ['button', 'lightSensor', 'potentiometer'].includes(device.kind),
  );
  const programNodeCount = lastProgram.threads.reduce(
    (total, thread) => total + thread.nodes.length,
    0,
  );
  const rawOutputPins = collectRawOutputPins(lastProgram, scene);
  const currentWiringSignature = wiringReviewSignature(scene, lastProgram);
  const wiringAcknowledged =
    wiringAcknowledgedSignature === currentWiringSignature;

  if (!hydrated) return <main className="account-page" aria-busy="true"><section className="account-card"><output>Recuperando tu proyecto de esta computadora…</output></section></main>;

  return (
    <main className="app-shell workbench">
      {preferencesOpen && preferences.preferences && <PreferencesPicker kind={preferencesOpen} {...preferences} preferences={preferences.preferences} onSave={preferences.save} onRetry={()=>void preferences.refresh()} onClose={()=>setPreferencesOpen(null)}/>}
      {preferencesOpen && !preferences.preferences && <Dialog open onOpenChange={open=>{if(!open)setPreferencesOpen(null);}}><DialogContent><DialogHeader><DialogTitle>Preferencias de tu cuenta</DialogTitle><DialogDescription>{preferences.error || 'Estamos cargando tus preferencias. Tu programa no se modificó.'}</DialogDescription></DialogHeader><button className="header-text-button" onClick={()=>void preferences.refresh()}>Reintentar preferencias</button><button className="header-text-button" onClick={()=>setPreferencesOpen(null)}>Cancelar</button></DialogContent></Dialog>}
      <header className="topbar">
        <div className="brand">
          <button className="avatar-button" title="Elegir mi avatar" aria-label="Elegir mi avatar" disabled={!preferences.verified} onClick={()=>setPreferencesOpen('avatar')}><UserAvatar id={preferences.preferences?.avatarId ?? account.avatarId} decorative /></button>
          <div>
            <strong>CapiBloques</strong>
            <span title={`@${account.alias} · Borrador local de esta cuenta`}>{account.displayName} · Wemos D1 R32</span>
          </div>
        </div>
        <label className="project-name">
          <span>Proyecto</span>
          <input
            value={projectName}
            maxLength={80}
            onChange={(event) => setProjectName(event.target.value)}
            aria-label="Nombre del proyecto"
          />
        </label>
        <nav className="header-actions" aria-label="Acciones del proyecto">
          <ProjectLibrary ref={libraryRef} account={account} store={draftStore} csrfToken={csrfToken} hydrated={hydrated} sceneEditing={sceneBuilderOpen} offline={offline} fingerprint={fingerprint} capture={currentProject} apply={applyLibraryProject} onNew={newLibraryProject} onImport={() => fileInputRef.current?.click()} notice={message => { setNotice(message); setNoticeTone('ok'); }} />
          <button
            className="icon-button"
            onClick={() => setExamplesOpen(true)}
            aria-label="Abrir ejemplos"
            title="Ejemplos"
          >
            <FolderOpen size={20} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="export-button">
              <Download size={18} /> Exportar
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="export-menu">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  Guarda o lleva tu proyecto
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={exportJson}>
                  <FileJson /> Proyecto editable JSON
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exportBusy} onClick={() => void exportCode('arduino')}>
                  <Code2 /> Código Arduino .ino
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exportBusy} onClick={() => void exportCode('esp-idf')}>
                  <Code2 /> Proyecto ESP-IDF .zip
                </DropdownMenuItem>
                <DropdownMenuItem disabled={offline || sceneBuilderOpen || !hydrated} onClick={() => setBuildsOpen(true)}>
                  <Settings2 /> Compilar y descargar firmware
                </DropdownMenuItem>
                <DropdownMenuItem disabled={offline || sceneBuilderOpen || !hydrated} onClick={() => { setUsbJob(null); setUsbOpen(true); }}>
                  <Settings2 /> USB y monitor Serial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveToBrowser}><Save />Guardar sólo en este navegador</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload /> Importar proyecto JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="icon-button account-menu-button" aria-label="Opciones de mi cuenta" title="Mi cuenta y sonidos"><Settings2 size={19} /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{account.displayName} · @{account.alias}</DropdownMenuLabel>
                <DropdownMenuItem render={<a href="/cuenta/" target="_blank" rel="noopener" aria-label="Mi cuenta" />}>Mi cuenta ↗</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMuted(value => !value)}>{muted ? <VolumeX /> : <Volume2 />}{muted ? 'Activar sonidos' : 'Silenciar sonidos'}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}><LogOut />Cerrar sesión</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            tabIndex={-1}
            aria-hidden="true"
            accept=".json,.capibloques.json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importProject(file);
              event.target.value = '';
            }}
          />
        </nav>
      </header>

      {!sceneBuilderOpen && draftStore.sceneDraft && <aside className="scene-recovery-banner"><span>🧩 Hay una escena sin terminar en esta computadora. Tu escena confirmada no cambió.</span><button onClick={() => toggleSceneBuilder(true)}>Revisar escena pendiente</button></aside>}

      <section className="toolbar" aria-label="Controles del simulador">
        {sim.status === 'running' ? (
          <button
            className="pause-button"
            onClick={() => {
              postToWorker({ type: 'PAUSE' });
              stopSound();
            }}
          >
            <Pause size={18} fill="currentColor" /> Pausar
          </button>
        ) : sim.status === 'paused' ? (
          <button
            className="run-button"
            onClick={() => postToWorker({ type: 'RUN' })}
          >
            <Play size={18} fill="currentColor" /> Reanudar
          </button>
        ) : (
          <button className="run-button" onClick={run}>
            <Play size={18} fill="currentColor" /> Ejecutar
          </button>
        )}
        <button onClick={step}>
          <StepForward size={18} /> Paso
        </button>
        <button
          onClick={() => {
            postToWorker({ type: 'STOP' });
            stopSound();
            pendingExecutionTasksRef.current = [];
            editorRef.current?.showExecution();
          }}
        >
          <CircleStop size={18} /> Detener
        </button>
        <button onClick={reset}>
          <RotateCcw size={18} /> Reiniciar
        </button>
        <span className="toolbar-separator" />
        <label className="speed-control">
          <Gauge size={18} /> Velocidad
          <select
            value={speed}
            disabled={sim.execution?.mode === 'guided'}
            title={sim.execution?.mode === 'guided' ? 'En modo guiado miramos un paso por vez. Esta velocidad se aplica al modo normal.' : 'Velocidad del reloj en modo normal'}
            onChange={(event) => {
              const value = Number(event.target.value);
              setSpeed(value);
              postToWorker({ type: 'SET_SPEED', speed: value });
            }}
          >
            <option value={0.5}>0,5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
        <button onClick={openCode}>
          <Code2 size={18} /> Ver código ESP32
        </button>
        <button type="button" className="wiring-button" onClick={openWiring} title="Conexiones de la Wemos D1 R32"><Cable size={18} /> Conectar</button>
      </section>

      <div className="workspace-grid functional">
        <section className="canvas-panel" aria-label="Programa visual">
          <div className="canvas-header">
            <div>
              <span>Programa visual</span>
              <strong>Arrastra, encaja y elige qué objeto controlas</strong>
            </div>
            <div
              className="canvas-header-actions"
              aria-label="Historial de bloques"
            >
              <button
                onClick={() => editorRef.current?.undo()}
                title="Deshacer cambio en los bloques"
                disabled={!blockHistory.canUndo}
              >
                <Undo2 size={17} /> Deshacer
              </button>
              <button
                onClick={() => editorRef.current?.redo()}
                title="Rehacer cambio en los bloques"
                disabled={!blockHistory.canRedo}
              >
                <Redo2 size={17} /> Rehacer
              </button>
              <button
                onClick={() => editorRef.current?.zoomToFit()}
                title="Centrar todos los bloques"
              >
                <Maximize2 size={17} /> Centrar
              </button>
            </div>
          </div>
          {hydrated && (
            <BlocklyWorkspace
              ref={editorRef}
              favorites={preferences.preferences?.favorites}
              onChooseFavorites={()=>setPreferencesOpen('favorites')}
              initialWorkspace={workspace}
              revision={workspaceRevision}
              devices={scene.devices}
              onChange={onWorkspaceChange}
              onBlockSnap={onBlockSnap}
              onHistoryChange={setBlockHistory}
              onError={(message) => {
                setNotice(message);
                setNoticeTone('error');
                setDiagnostics([
                  {
                    severity: 'error',
                    code: 'workspace-load',
                    message,
                  },
                ]);
                setProblemsOpen(true);
              }}
            />
          )}
        </section>

        <aside
          className="simulator-panel"
          aria-label="Simulador de comportamiento"
        >
          <div className="scene-context">
            <details><summary><span aria-hidden="true">🦫</span> {scene.name}</summary><p>{scene.description || sourceExample?.mission || 'Combiná componentes y creá tu propia aventura.'}</p></details>
            <button className="header-text-button scene-builder-button" onClick={() => toggleSceneBuilder(true)}><Blocks size={17} /> Armar escena</button>
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as string)}
            className="sim-tabs-root"
          >
            <TabsList variant="line" className="sim-tabs-list">
              <TabsTrigger value="scene">Escena</TabsTrigger>
              <TabsTrigger value="state">Estado</TabsTrigger>
              <TabsTrigger value="console">Consola</TabsTrigger>
            </TabsList>
            <TabsContent value="scene" className="sim-content" keepMounted>
              <div className="sim-stage composed-scene">
                <SceneStage
                  activeDeviceId={sim.status === 'stopped' || sim.status === 'done' ? undefined : sim.execution?.trace.at(-1)?.deviceId}
                  activeDeviceMessage={sim.execution?.trace.at(-1)?.message}
                  scene={scene}
                  runtimeDevices={sim.devices}
                  counter={sim.counter}
                />
              </div>
            </TabsContent>
            <TabsContent value="state" className="sim-content state-content">
              {scene.devices.length ? (
                <div className="state-grid device-state-grid">
                  {scene.devices.map((device) => (
                    <DeviceStateCard
                      key={device.id}
                      device={device}
                      runtime={sim.devices[device.id]}
                    />
                  ))}
                  <article>
                    <span>🔢 Contador global</span>
                    <strong>{sim.counter}</strong>
                  </article>
                </div>
              ) : (
                <div className="state-empty">
                  <span>🧰</span>
                  <strong>No hay componentes todavía</strong>
                  <button onClick={() => toggleSceneBuilder(true)}>
                    Armar escena
                  </button>
                </div>
              )}
              {(inputDevices.length > 0 ||
                scene.devices.some((device) => device.kind === 'wifiNode')) && (
                <div className="input-lab">
                  <h3>Entradas para probar</h3>
                  {inputDevices.map((device) => {
                    const runtime = sim.devices[device.id];
                    if (device.kind === 'button') {
                      const checked =
                        runtime?.kind === 'button' ? runtime.pressed : false;
                      return (
                        <div className="switch-row" key={device.id}>
                          <span>🔘 {device.name}</span>
                          <Switch
                            aria-label={`Simular ${device.name}`}
                            checked={checked}
                            onCheckedChange={(value) =>
                              setDeviceInput(device.id, value)
                            }
                          />
                        </div>
                      );
                    }
                    const value =
                      runtime?.kind === 'lightSensor' ||
                      runtime?.kind === 'potentiometer'
                        ? runtime.value
                        : 2048;
                    return (
                      <div className="range-row" key={device.id}>
                        <span>
                          {device.kind === 'lightSensor' ? '☀️' : '🎚️'}{' '}
                          {device.name} <b>{Math.round(value)}</b>
                        </span>
                        <Slider
                          aria-label={`Valor simulado de ${device.name}`}
                          min={0}
                          max={4095}
                          step={1}
                          value={[value]}
                          onValueChange={(values) =>
                            setDeviceInput(
                              device.id,
                              Array.isArray(values) ? values[0] : values,
                            )
                          }
                        />
                      </div>
                    );
                  })}
                  {scene.devices.some(
                    (device) => device.kind === 'wifiNode',
                  ) && (
                    <div className="switch-row">
                      <span>📶 Red Wi-Fi disponible</span>
                      <Switch
                        aria-label="Simular red Wi-Fi disponible"
                        checked={sim.wifiAvailable}
                        onCheckedChange={setWifiAvailable}
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent
              value="console"
              className="sim-content console-content"
            >
              <div className="console-heading">
                <Braces size={18} /> Monitor serial simulado
              </div>
              <div className="console-log" aria-live="polite">
                {sim.console.length ? (
                  sim.console.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))
                ) : (
                  <p className="console-empty">
                    Los mensajes de tu programa aparecerán aquí.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <ExecutionPanel compact state={sim} post={postToWorker} onFollow={blockId => editorRef.current?.focusBlock(blockId)} />
          <div className={`sim-status ${sim.status}`}>
            <span className="status-dot" />
            <div>
              <strong>{statusText(sim.status)}</strong>
              <span>
                {(sim.now / 1000).toFixed(1)} s simulados ·{' '}
                {lastProgram.threads.length > 1
                  ? `${lastProgram.threads.length} programas independientes`
                  : sim.status === 'running'
                    ? 'puedes detenerlo cuando quieras'
                    : 'misma lógica cooperativa que el código ESP32'}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <output className={`notice ${noticeTone}`} aria-live="polite">
        {noticeTone === 'ok' ? (
          <Check size={15} />
        ) : (
          <AlertTriangle size={15} />
        )}{' '}
        <span>{notice}</span>
        {diagnostics.length > 0 && (
          <button type="button" onClick={() => setProblemsOpen(true)}>
            Ver {diagnostics.length}{' '}
            {diagnostics.length === 1 ? 'detalle' : 'detalles'}
          </button>
        )}
      </output>

      <Dialog open={examplesOpen} onOpenChange={setExamplesOpen}>
        <DialogContent className="example-dialog">
          <DialogHeader>
            <DialogTitle>Elige una misión</DialogTitle>
            <DialogDescription>
              Empieza con un ejemplo y luego combínalo con otros en el editor de
              escenas.
            </DialogDescription>
          </DialogHeader>
          <div className="example-grid">
            {examples.map((example) => (
              <button
                key={example.id}
                className="example-card"
                onClick={() => loadExample(example.id)}
              >
                <span className="example-icon">{example.icon}</span>
                <span className="level">{example.level}</span>
                <strong>{example.title}</strong>
                <p>{example.description}</p>
                <span className="open-example">Abrir misión →</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {sceneBuilderOpen && (
        <Suspense fallback={null}>
          <SceneBuilder
            open={sceneBuilderOpen}
            onOpenChange={toggleSceneBuilder}
            scene={scene}
            recoveryDraft={draftStore.sceneDraft}
            onDraft={persistSceneDraft}
            onFinish={finishScene}
            storageError={sceneStorage.error}
            storageBusy={sceneStorage.busy}
            onExportDraft={() => { if (draftStore.active && draftStore.sceneDraft) downloadText(`${safeFilename(projectName)}.capibloques-recovery.json`, exportLocalSceneCopy(JSON.stringify(currentProject()), draftStore.sceneDraft), 'application/json'); }}
          />
        </Suspense>
      )}

      {wiringOpen && (
        <Suspense fallback={null}>
          <WiringGuide
            open={wiringOpen}
            onOpenChange={setWiringOpen}
            scene={scene}
            rawPins={rawOutputPins}
            diagnostics={diagnostics}
            acknowledged={wiringAcknowledged}
            onAcknowledgedChange={(value) =>
              setWiringAcknowledgedSignature(
                value ? currentWiringSignature : null,
              )
            }
          />
        </Suspense>
      )}

      <Dialog open={problemsOpen} onOpenChange={setProblemsOpen}>
        <DialogContent className="problems-dialog">
          <DialogHeader>
            <DialogTitle>Qué hay que revisar</DialogTitle>
            <DialogDescription>
              Cada mensaje indica el objeto o bloque que necesita atención.
            </DialogDescription>
          </DialogHeader>
          <div className="diagnostic-list">
            {diagnostics.length ? (
              diagnostics.map((diagnostic, index) => (
                <button
                  type="button"
                  className={`diagnostic-item ${diagnostic.severity}`}
                  key={`${diagnostic.code}-${diagnostic.deviceId ?? diagnostic.blockId ?? index}`}
                  onClick={() => {
                    if (diagnostic.blockId) {
                      editorRef.current?.highlight(diagnostic.blockId);
                      setProblemsOpen(false);
                    } else if (diagnostic.deviceId) {
                      setProblemsOpen(false);
                      toggleSceneBuilder(true);
                    }
                  }}
                >
                  <span aria-hidden="true">
                    {diagnostic.severity === 'error' ? '⛔' : '⚠️'}
                  </span>
                  <span>
                    <strong>
                      {diagnostic.severity === 'error'
                        ? 'Hay que corregirlo'
                        : 'Consejo de conexión'}
                    </strong>
                    <small>{diagnostic.message}</small>
                  </span>
                  {(diagnostic.blockId || diagnostic.deviceId) && (
                    <em>
                      {diagnostic.blockId ? 'Mostrar bloque' : 'Abrir escena'}
                    </em>
                  )}
                </button>
              ))
            ) : (
              <div className="diagnostic-empty">
                <ShieldCheck size={34} />
                <strong>Todo está listo</strong>
                <span>No encontramos problemas en este momento.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {usbOpen && !offline && <UsbBoard account={account} store={draftStore} job={usbJob} currentFingerprint={fingerprint} onClose={() => { setUsbOpen(false); setUsbJob(null); }} onBuilds={() => { setUsbOpen(false); setUsbJob(null); setBuildsOpen(true); }} />}
      {buildsOpen && !offline && <FirmwareBuilds account={account} store={draftStore} csrfToken={csrfToken} capture={currentProject} fingerprint={fingerprint} onClose={() => setBuildsOpen(false)} onProgram={job => { setBuildsOpen(false); setUsbJob(job); setUsbOpen(true); }} validate={framework => {
        const generated = buildCode(framework);
        if (generated.diagnostics.some(item => item.severity === 'error')) { setProblemsOpen(true); return null; }
        if (hasPhysicalConnections(scene, generated.program) && wiringAcknowledgedSignature !== wiringReviewSignature(scene, generated.program)) {
          setNotice('Antes de compilar, revisá y confirmá la guía de cableado.'); setNoticeTone('warning'); setWiringOpen(true); return null;
        }
        return { wifi: programUsesWifi(generated.program) };
      }} />}
      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="code-dialog">
          <DialogHeader>
            <DialogTitle>Código para WEMOS D1 R32</DialogTitle>
            <DialogDescription>
              Usa cada componente y pin de tu escena. Los caminos avanzan juntos
              con esperas cooperativas, tanto en Arduino como en ESP-IDF.
            </DialogDescription>
          </DialogHeader>
          <div className="code-actions">
            <label>
              Formato de código{' '}
              <select aria-label="Formato de código" value={codeFramework} disabled={exportBusy} onChange={event => buildCode(event.target.value as FirmwareFramework)}>
                <option value="arduino">Arduino (.ino)</option>
                <option value="esp-idf">ESP-IDF nativo (.zip)</option>
              </select>
            </label>
            <span>
              {lastProgram.threads.length} programa(s) · {programNodeCount}{' '}
              acciones principales
            </span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              }}
            >
              <Clipboard size={16} /> {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={() => void exportCode()}
              disabled={exportBusy || diagnostics.some((item) => item.severity === 'error')}
              title={
                diagnostics.some((item) => item.severity === 'error')
                  ? 'Corregí los problemas antes de descargar'
                  : codeFramework === 'esp-idf' ? 'Descargar proyecto ESP-IDF completo' : 'Descargar código Arduino'
              }
            >
              <Download size={16} /> {exportBusy ? 'Preparando…' : codeFramework === 'esp-idf' ? 'Descargar ESP-IDF .zip' : 'Descargar .ino'}
            </button>
          </div>
          {diagnostics.length > 0 && (
            <button
              type="button"
              className="code-diagnostics-button"
              onClick={() => {
                setCodeOpen(false);
                setProblemsOpen(true);
              }}
            >
              <AlertTriangle size={17} /> Revisar {diagnostics.length}{' '}
              {diagnostics.length === 1 ? 'mensaje' : 'mensajes'} antes de usar
              la placa
            </button>
          )}
          <pre className="code-view">
            <code>{code}</code>
          </pre>
          {codeFramework === 'esp-idf' && <p>Vista de <code>main/main.cpp</code>. Para compilar necesitás el ZIP completo y ESP-IDF 5.5.5. No usa Arduino. Incluye instrucciones, configuración y licencias; todavía no descarga un binario.</p>}
          <div className="code-note">
            <Settings2 size={17} />
            <span>
              Wi-Fi se exporta con marcadores <code>TU_RED</code> y{' '}
              <code>TU_CLAVE</code>; nunca guardamos contraseñas en el JSON.
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
