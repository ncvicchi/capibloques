'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  makeProject,
  safeFilename,
  validateProgramForScene,
  type CapiDiagnostic,
  type CompiledProgram,
  type ProjectFile,
  type RuntimeDeviceState,
  type SceneId,
  type SimulatorState,
} from '@/lib/capiblocks';
import {
  addDeviceToScene,
  cloneScene,
  sceneDeviceKinds,
  type SceneDefinition,
  type SceneDevice,
  type SceneDeviceKind,
} from '@/lib/scene-model';
// Vite convierte el sufijo `?worker` en un constructor durante el build.
// oxlint-disable-next-line import/default
import SimulatorWorker from '@/lib/simulator.worker.ts?worker';

const SceneBuilder = lazy(() => import('@/components/scene-builder'));
const WiringGuide = lazy(() => import('@/components/wiring-guide'));

const PROJECT_STORAGE_KEY = 'capibloques-project-v2';
const LEGACY_STORAGE_KEY = 'capibloques-project-v1';
const emptyProgram = (): CompiledProgram => ({ version: 2, threads: [] });

function wiringReviewSignature(
  scene: SceneDefinition,
  program: CompiledProgram,
) {
  return JSON.stringify([
    scene.devices.map((device) => [device.id, device.kind, device.pins]),
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

export default function CapiBlocksApp() {
  const currentExample = examples[0];
  const initialScene = useMemo(
    () => cloneScene(currentExample.scene),
    [currentExample.scene],
  );
  const editorRef = useRef<BlocklyWorkspaceHandle>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutedRef = useRef(false);
  const speedRef = useRef(1);
  const pendingHighlightFrameRef = useRef<number | null>(null);
  const pendingActiveBlocksRef = useRef(new Map<string, string>());
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
  const [wiringOpen, setWiringOpen] = useState(false);
  const [wiringAcknowledgedSignature, setWiringAcknowledgedSignature] =
    useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('Guardado automático activo');
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
      examples.find((example) => example.id === scene.sourceTemplate) ?? null,
    [scene.sourceTemplate],
  );

  const postToWorker = useCallback((message: Record<string, unknown>) => {
    workerRef.current?.postMessage(message);
  }, []);

  useEffect(() => {
    const worker = new SimulatorWorker();
    workerRef.current = worker;
    const flushHighlights = () => {
      pendingHighlightFrameRef.current = null;
      editorRef.current?.highlight([
        ...pendingActiveBlocksRef.current.values(),
      ]);
    };
    const scheduleHighlight = () => {
      if (pendingHighlightFrameRef.current !== null) return;
      pendingHighlightFrameRef.current = requestAnimationFrame(flushHighlights);
    };
    worker.addEventListener('message', (event) => {
      if (event.data.type === 'SNAPSHOT') {
        const nextState = event.data.state as SimulatorState;
        setSim(nextState);
        pendingActiveBlocksRef.current = new Map(
          Object.entries(nextState.activeBlockIds).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        );
        scheduleHighlight();
      }
      if (event.data.type === 'BLOCK_ACTIVE') {
        pendingActiveBlocksRef.current.set(
          String(event.data.threadId ?? 'main'),
          String(event.data.blockId ?? ''),
        );
        scheduleHighlight();
      }
      if (event.data.type === 'SOUND') {
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
        sound(980, 140, mutedRef.current);
        window.setTimeout(() => sound(1320, 180, mutedRef.current), 100);
      }
    });
    return () => {
      if (pendingHighlightFrameRef.current !== null) {
        cancelAnimationFrame(pendingHighlightFrameRef.current);
      }
      stopSound();
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const currentSaved = localStorage.getItem(PROJECT_STORAGE_KEY);
        const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
        const soundSetting = localStorage.getItem('capibloques-muted');
        if (soundSetting !== null) setMuted(soundSetting === 'true');

        let recovered: ReturnType<typeof decodeProject> | null = null;
        let recoveredFromLegacy = false;
        let recoveryMessage = '';
        for (const [index, saved] of [currentSaved, legacySaved].entries()) {
          if (!saved) continue;
          try {
            const decoded = decodeProject(JSON.parse(saved) as unknown);
            if (decoded.project) {
              recovered = decoded;
              recoveredFromLegacy = index === 1;
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
            recoveredFromLegacy || recovered.migrated
              ? 'Recuperamos y actualizamos tu proyecto anterior'
              : 'Recuperamos tu último proyecto',
          );
          setNoticeTone('ok');
        } else if (currentSaved || legacySaved) {
          setNotice(
            recoveryMessage ||
              'El proyecto guardado no era compatible; empezamos uno nuevo',
          );
          setNoticeTone('warning');
        }
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `No pudimos usar el guardado del navegador: ${error.message}`
            : 'No pudimos usar el guardado del navegador',
        );
        setNoticeTone('warning');
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
        localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `No pudimos guardar en este navegador: ${error.message}`
            : 'No pudimos guardar en este navegador',
        );
        setNoticeTone('error');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectName, scene, speed, workspace]);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted) stopSound();
    if (!hydrated) return;
    try {
      localStorage.setItem('capibloques-muted', String(muted));
    } catch {
      // Silenciar sigue funcionando aunque el navegador bloquee preferencias.
    }
  }, [hydrated, muted]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const onBlockSnap = useCallback(
    () => sound(420, 45, mutedRef.current, 0.025),
    [],
  );

  const onWorkspaceChange = useCallback(
    (nextWorkspace: Record<string, unknown>) => {
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
      setNotice('Agrega un bloque “al comenzar” con acciones para ejecutar');
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
        setNotice('Agrega un bloque “al comenzar” para avanzar paso a paso');
        setNoticeTone('warning');
        return;
      }
      postToWorker({ type: 'LOAD', program, scene });
      postToWorker({ type: 'SET_SPEED', speed });
    }
    postToWorker({ type: 'STEP' });
    setNotice('Avanzamos una acción del próximo programa listo');
    setNoticeTone('ok');
  }, [compile, postToWorker, scene, sim.status, speed]);

  const reset = useCallback(() => {
    postToWorker({ type: 'RESET' });
    stopSound();
    pendingActiveBlocksRef.current.clear();
    editorRef.current?.highlight();
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
        editorRef.current?.highlight();
      }
      setSceneBuilderOpen(nextOpen);
    },
    [postToWorker, scene],
  );

  const loadExample = useCallback(
    (id: SceneId) => {
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
    },
    [postToWorker],
  );

  const addSceneComponent = useCallback(
    (kind: SceneDeviceKind) => {
      postToWorker({ type: 'STOP' });
      setScene((current) => {
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
    return makeProject(projectName, scene, savedWorkspace, speed);
  }, [projectName, scene, speed, workspace]);

  const saveToBrowser = useCallback(() => {
    try {
      localStorage.setItem(
        PROJECT_STORAGE_KEY,
        JSON.stringify(currentProject()),
      );
      setNotice('Proyecto guardado en este navegador');
      setNoticeTone('ok');
      sound(760, 80, muted);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `No pudimos guardar: ${error.message}`
          : 'No pudimos guardar el proyecto',
      );
      setNoticeTone('error');
    }
  }, [currentProject, muted]);

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

  const buildCode = useCallback(() => {
    const program = compile();
    const result = generateEsp32CodeResult(program, projectName, scene);
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
  }, [compile, projectName, scene]);

  const openCode = useCallback(() => {
    buildCode();
    setCodeOpen(true);
  }, [buildCode]);

  const openWiring = useCallback(() => {
    buildCode();
    setWiringOpen(true);
  }, [buildCode]);

  const exportCode = useCallback(() => {
    const generated = buildCode();
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
    downloadText(
      `${safeFilename(projectName)}.ino`,
      generated.code,
      'text/x-c++src',
    );
    setNotice('Código .ino descargado para la Wemos D1 R32');
    setNoticeTone('ok');
  }, [buildCode, muted, projectName, scene, wiringAcknowledgedSignature]);

  const importProject = useCallback(
    async (file: File) => {
      try {
        if (file.size > 2_000_000)
          throw new Error('El archivo supera el límite de 2 MB');
        const decoded = decodeProject(JSON.parse(await file.text()) as unknown);
        if (!decoded.project)
          throw new Error(
            decoded.diagnostics[0]?.message ??
              'No es un proyecto CapiBloques compatible',
          );
        const nextScene = cloneScene(decoded.project.scene);
        postToWorker({ type: 'STOP' });
        stopSound();
        setProjectName(decoded.project.metadata.title);
        setScene(nextScene);
        setSim(makeInitialState(nextScene));
        setSpeed(decoded.project.simulation.speed);
        setWorkspace(normalizeWorkspace(decoded.project.workspace));
        setWorkspaceRevision((value) => value + 1);
        setWiringAcknowledgedSignature(null);
        setDiagnostics(decoded.diagnostics);
        setNotice(
          decoded.migrated
            ? 'Proyecto anterior convertido y abierto correctamente'
            : 'Proyecto importado correctamente',
        );
        setNoticeTone(decoded.diagnostics.length ? 'warning' : 'ok');
        sound(880, 120, muted);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'No pudimos abrir ese archivo',
        );
        setNoticeTone('error');
        sound(190, 180, muted);
      }
    },
    [muted, postToWorker],
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
            const example = (input as { example?: SceneId })?.example;
            if (!example || !examples.some((item) => item.id === example))
              throw new Error('Ejemplo no válido');
            loadExample(example);
            return { loaded: example };
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
  }, [addSceneComponent, loadExample]);

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            🐾
          </span>
          <div>
            <strong>CapiBloques</strong>
            <span>Laboratorio Wemos D1 R32</span>
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
          <button
            className="header-text-button save-project-button"
            onClick={saveToBrowser}
          >
            <Save size={18} /> Guardar
          </button>
          <button
            className="header-text-button scene-builder-button"
            onClick={() => toggleSceneBuilder(true)}
          >
            <Blocks size={18} /> Armar escena
          </button>
          <button
            className="header-text-button wiring-button"
            onClick={openWiring}
          >
            <Cable size={18} /> Conectar
          </button>
          <button
            className="icon-button"
            onClick={() => setExamplesOpen(true)}
            aria-label="Abrir ejemplos"
            title="Ejemplos"
          >
            <FolderOpen size={20} />
          </button>
          <button
            className="icon-button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Activar sonidos' : 'Silenciar sonidos'}
            title="Sonidos"
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
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
                <DropdownMenuItem onClick={exportCode}>
                  <Code2 /> Código Arduino .ino
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload /> Importar proyecto JSON
              </DropdownMenuItem>
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

      <section className="mission-strip">
        <span className="guide-avatar" aria-hidden="true">
          🦫
        </span>
        <div>
          <strong>Escena: {scene.name}</strong>
          <span>
            {scene.description ||
              sourceExample?.mission ||
              'Combina componentes y crea tu propia aventura.'}
          </span>
        </div>
        <button
          className="mission-button"
          onClick={() => toggleSceneBuilder(true)}
        >
          Editar escena
        </button>
      </section>

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
            pendingActiveBlocksRef.current.clear();
            editorRef.current?.highlight();
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
        <button
          type="button"
          className="board-badge"
          onClick={openWiring}
          title="Abrir guía de conexiones"
        >
          <span /> WEMOS D1 R32 · Arduino-ESP32 3.3.11
        </button>
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
            <TabsContent value="scene" className="sim-content">
              <div className="sim-stage composed-scene">
                <SceneStage
                  scene={scene}
                  runtimeDevices={sim.devices}
                  counter={sim.counter}
                />
                <button
                  type="button"
                  className="edit-scene-fab"
                  onClick={() => toggleSceneBuilder(true)}
                >
                  <Blocks size={15} /> Editar
                </button>
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
            onSceneChange={changeScene}
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

      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="code-dialog">
          <DialogHeader>
            <DialogTitle>Código para WEMOS D1 R32</DialogTitle>
            <DialogDescription>
              Usa cada componente y pin de tu escena. Las tareas avanzan juntas
              con millis(), sin delay().
            </DialogDescription>
          </DialogHeader>
          <div className="code-actions">
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
              onClick={exportCode}
              disabled={diagnostics.some((item) => item.severity === 'error')}
              title={
                diagnostics.some((item) => item.severity === 'error')
                  ? 'Corregí los problemas antes de descargar'
                  : 'Descargar código Arduino'
              }
            >
              <Download size={16} /> Descargar .ino
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
