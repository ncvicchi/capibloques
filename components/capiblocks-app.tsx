'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Blocks,
  Braces,
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
  RotateCcw,
  Settings2,
  StepForward,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import BlocklyWorkspace, {
  type BlocklyWorkspaceHandle,
} from '@/components/blockly-workspace';
import SceneBuilder from '@/components/scene-builder';
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
  decodeProject,
  downloadText,
  examples,
  generateEsp32CodeResult,
  makeProject,
  safeFilename,
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

const PROJECT_STORAGE_KEY = 'capibloques-project-v2';
const LEGACY_STORAGE_KEY = 'capibloques-project-v1';
const emptyProgram = (): CompiledProgram => ({ version: 2, threads: [] });

let sharedAudioContext: AudioContext | null = null;

function sound(
  frequency: number,
  durationMs: number,
  muted: boolean,
  volume = 0.055,
) {
  if (muted || typeof window === 'undefined') return;
  sharedAudioContext ??= new AudioContext();
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
        angle: device.config.heading,
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
          device.config.status === 'idle' ? 'disconnected' : device.config.status,
      };
  }
}

function makeInitialState(scene: SceneDefinition): SimulatorState {
  const devices = Object.fromEntries(
    scene.devices.map((device) => [device.id, runtimeFromDevice(device, scene)]),
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
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('Guardado automático activo');
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
    worker.addEventListener('message', (event) => {
      if (event.data.type === 'SNAPSHOT')
        setSim(event.data.state as SimulatorState);
      if (event.data.type === 'BLOCK_ACTIVE')
        editorRef.current?.highlight(event.data.blockId);
      if (event.data.type === 'SOUND')
        sound(
          event.data.frequency,
          event.data.durationMs,
          mutedRef.current,
          0.035,
        );
      if (event.data.type === 'DONE') {
        sound(980, 140, mutedRef.current);
        window.setTimeout(() => sound(1320, 180, mutedRef.current), 100);
      }
    });
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved =
          localStorage.getItem(PROJECT_STORAGE_KEY) ??
          localStorage.getItem(LEGACY_STORAGE_KEY);
        const soundSetting = localStorage.getItem('capibloques-muted');
        if (soundSetting) setMuted(soundSetting === 'true');
        if (saved) {
          const decoded = decodeProject(JSON.parse(saved) as unknown);
          if (decoded.project) {
            setProjectName(decoded.project.metadata.title);
            setScene(cloneScene(decoded.project.scene));
            setSim(makeInitialState(decoded.project.scene));
            setSpeed(decoded.project.simulation.speed);
            setWorkspace(normalizeWorkspace(decoded.project.workspace));
            setWorkspaceRevision((value) => value + 1);
            setNotice(
              decoded.migrated
                ? 'Convertimos tu proyecto anterior al editor de escenas'
                : 'Recuperamos tu último proyecto',
            );
          } else {
            setNotice(
              decoded.diagnostics[0]?.message ??
                'El proyecto guardado no era compatible; empezamos uno nuevo',
            );
          }
        }
      } catch {
        setNotice('Empezamos con un proyecto nuevo');
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const project = makeProject(projectName, scene, workspace, speed);
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectName, scene, speed, workspace]);

  useEffect(() => {
    mutedRef.current = muted;
    localStorage.setItem('capibloques-muted', String(muted));
  }, [muted]);

  const onBlockSnap = useCallback(
    () => sound(420, 45, mutedRef.current, 0.025),
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
        return;
      }
      postToWorker({ type: 'LOAD', program, scene });
      postToWorker({ type: 'SET_SPEED', speed });
    }
    postToWorker({ type: 'STEP' });
    setNotice('Avanzamos una acción del próximo programa listo');
  }, [compile, postToWorker, scene, sim.status, speed]);

  const reset = useCallback(() => {
    postToWorker({ type: 'RESET' });
    editorRef.current?.highlight();
    setSim(makeInitialState(scene));
    setNotice('Escena reiniciada');
  }, [postToWorker, scene]);

  const changeScene = useCallback(
    (nextScene: SceneDefinition) => {
      const customizedScene = cloneScene(nextScene);
      delete customizedScene.sourceTemplate;
      setScene(customizedScene);
      setNotice('Escena actualizada; los bloques ya ven sus componentes');
    },
    [],
  );

  const toggleSceneBuilder = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        postToWorker({ type: 'STOP' });
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
      setProjectName(example.title);
      setScene(nextScene);
      setSim(makeInitialState(nextScene));
      setWorkspace(example.workspace);
      setWorkspaceRevision((value) => value + 1);
      setExamplesOpen(false);
      setActiveTab('scene');
      setNotice(`Ejemplo cargado: ${example.title}`);
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

  const exportJson = useCallback(() => {
    const project = currentProject();
    downloadText(
      `${safeFilename(projectName)}.capibloques.json`,
      JSON.stringify(project, null, 2),
      'application/json',
    );
    setNotice('Proyecto JSON exportado con escena, bloques y conexiones');
    sound(860, 100, muted);
  }, [currentProject, muted, projectName]);

  const buildCode = useCallback(() => {
    const program = compile();
    const result = generateEsp32CodeResult(program, projectName, scene);
    setCode(result.code);
    const errors = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    const warnings = result.diagnostics.length - errors.length;
    if (errors.length)
      setNotice(`${errors.length} problema(s) impiden completar el código`);
    else if (warnings)
      setNotice(`Código generado con ${warnings} aviso(s) de cableado`);
    return result;
  }, [compile, projectName, scene]);

  const openCode = useCallback(() => {
    buildCode();
    setCodeOpen(true);
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
      sound(190, 160, muted, 0.035);
      return;
    }
    downloadText(
      `${safeFilename(projectName)}.ino`,
      generated.code,
      'text/x-c++src',
    );
    setNotice('Código .ino descargado para la Wemos D1 R32');
  }, [buildCode, muted, projectName]);

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
        setProjectName(decoded.project.metadata.title);
        setScene(nextScene);
        setSim(makeInitialState(nextScene));
        setSpeed(decoded.project.simulation.speed);
        setWorkspace(normalizeWorkspace(decoded.project.workspace));
        setWorkspaceRevision((value) => value + 1);
        setNotice(
          decoded.migrated
            ? 'Proyecto anterior convertido y abierto correctamente'
            : 'Proyecto importado correctamente',
        );
        sound(880, 120, muted);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'No pudimos abrir ese archivo',
        );
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
    void Promise.all(registrations.map((value) => Promise.resolve(value))).catch(
      () => undefined,
    );
    return () => lifecycle.abort();
  }, [addSceneComponent, loadExample]);

  const inputDevices = scene.devices.filter((device) =>
    ['button', 'lightSensor', 'potentiometer'].includes(device.kind),
  );
  const programNodeCount = lastProgram.threads.reduce(
    (total, thread) => total + thread.nodes.length,
    0,
  );

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
            onChange={(event) => setProjectName(event.target.value)}
            aria-label="Nombre del proyecto"
          />
        </label>
        <nav className="header-actions" aria-label="Acciones del proyecto">
          <button
            className="header-text-button scene-builder-button"
            onClick={() => toggleSceneBuilder(true)}
          >
            <Blocks size={18} /> Armar escena
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
                <DropdownMenuLabel>Guarda o lleva tu proyecto</DropdownMenuLabel>
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
            className="visually-hidden"
            type="file"
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
            onClick={() => postToWorker({ type: 'PAUSE' })}
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
        <button onClick={() => postToWorker({ type: 'STOP' })}>
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
        <span className="board-badge">
          <span /> WEMOS D1 R32 · Arduino-ESP32 3.3.11
        </span>
      </section>

      <div className="workspace-grid functional">
        <section className="canvas-panel" aria-label="Programa visual">
          <div className="canvas-header">
            <div>
              <span>Programa visual</span>
              <strong>Arrastra, encaja y elige qué objeto controlas</strong>
            </div>
            <button
              onClick={() => editorRef.current?.zoomToFit()}
              title="Centrar todos los bloques"
            >
              <Maximize2 size={17} /> Centrar
            </button>
          </div>
          <BlocklyWorkspace
            ref={editorRef}
            initialWorkspace={workspace}
            revision={workspaceRevision}
            devices={scene.devices}
            onChange={setWorkspace}
            onBlockSnap={onBlockSnap}
          />
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
                  {scene.devices.some((device) => device.kind === 'wifiNode') && (
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
                    : 'la placa real puede reaccionar distinto'}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <output className="notice" aria-live="polite">
        <Check size={15} /> {notice}
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

      <SceneBuilder
        open={sceneBuilderOpen}
        onOpenChange={toggleSceneBuilder}
        scene={scene}
        onSceneChange={changeScene}
      />

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
            <button onClick={exportCode}>
              <Download size={16} /> Descargar .ino
            </button>
          </div>
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
