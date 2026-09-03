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
  Wifi,
  Wrench,
} from 'lucide-react';
import BlocklyWorkspace, {
  type BlocklyWorkspaceHandle,
} from '@/components/blockly-workspace';
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
  componentCatalog,
  downloadText,
  examples,
  generateEsp32Code,
  isProjectFile,
  makeProject,
  safeFilename,
  type ProgramNode,
  type ProjectFile,
  type SceneId,
} from '@/lib/capiblocks';
// Vite convierte el sufijo `?worker` en un constructor durante el build.
// oxlint-disable-next-line import/default
import SimulatorWorker from '@/lib/simulator.worker.ts?worker';

type SimState = {
  now: number;
  status: 'idle' | 'running' | 'paused' | 'done' | 'stopped';
  traffic: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  ledBrightness: number;
  servoAngle: number;
  buzzer: 'off' | 'active' | 'passive';
  robot: { x: number; y: number; angle: number; left: number; right: number };
  wifi: 'disconnected' | 'connecting' | 'connected' | 'error';
  counter: number;
  pins: Record<number, boolean>;
  console: string[];
  inputs: {
    button: boolean;
    light: number;
    potentiometer: number;
    wifiAvailable: boolean;
  };
  activeBlockId?: string;
};

const initialState: SimState = {
  now: 0,
  status: 'idle',
  traffic: 'OFF',
  ledBrightness: 0,
  servoAngle: 90,
  buzzer: 'off',
  robot: { x: 50, y: 72, angle: -90, left: 0, right: 0 },
  wifi: 'disconnected',
  counter: 0,
  pins: {},
  console: [],
  inputs: {
    button: false,
    light: 2500,
    potentiometer: 2000,
    wifiAvailable: true,
  },
};

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

function statusText(status: SimState['status']) {
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

export default function CapiBlocksApp() {
  const editorRef = useRef<BlocklyWorkspaceHandle>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const currentExample = examples[0];
  const [projectName, setProjectName] = useState(currentExample.title);
  const [scene, setScene] = useState<SceneId>(currentExample.id);
  const [workspace, setWorkspace] = useState<Record<string, unknown>>(
    currentExample.workspace,
  );
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [sim, setSim] = useState<SimState>(initialState);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [componentsOpen, setComponentsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('Guardado automático activo');
  const [activeTab, setActiveTab] = useState('scene');
  const [lastProgram, setLastProgram] = useState<ProgramNode[]>([]);

  const selectedExample = useMemo(
    () => examples.find((example) => example.id === scene) ?? examples[0],
    [scene],
  );

  const postToWorker = useCallback((message: Record<string, unknown>) => {
    workerRef.current?.postMessage(message);
  }, []);

  useEffect(() => {
    const worker = new SimulatorWorker();
    workerRef.current = worker;
    worker.addEventListener('message', (event) => {
      if (event.data.type === 'SNAPSHOT') {
        const next = event.data.state as SimState;
        setSim(next);
      }
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
        setTimeout(() => sound(1320, 180, mutedRef.current), 100);
      }
    });
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('capibloques-project-v1');
        const soundSetting = localStorage.getItem('capibloques-muted');
        if (soundSetting) setMuted(soundSetting === 'true');
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (isProjectFile(parsed)) {
            setProjectName(parsed.metadata.title);
            setScene(parsed.simulation.scene);
            setSpeed(parsed.simulation.speed);
            setWorkspace(parsed.workspace);
            setWorkspaceRevision((value) => value + 1);
            setNotice('Recuperamos tu último proyecto');
          }
        }
      } catch {
        setNotice('Empezamos con un proyecto nuevo');
      } finally {
        hydratedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const project = makeProject(projectName, scene, workspace, speed);
    localStorage.setItem('capibloques-project-v1', JSON.stringify(project));
  }, [projectName, scene, speed, workspace]);

  useEffect(() => {
    mutedRef.current = muted;
    localStorage.setItem('capibloques-muted', String(muted));
  }, [muted]);

  const compile = useCallback(() => {
    const program = editorRef.current?.compile() ?? [];
    setLastProgram(program);
    return program;
  }, []);

  const run = useCallback(() => {
    const program = compile();
    if (!program.length) {
      setNotice('Agrega un bloque “al comenzar” para ejecutar tu idea');
      sound(210, 180, muted);
      return;
    }
    postToWorker({ type: 'LOAD', program });
    postToWorker({ type: 'SET_SPEED', speed });
    postToWorker({ type: 'RUN' });
    setNotice('Simulación de comportamiento iniciada');
    sound(620, 90, muted);
  }, [compile, muted, postToWorker, speed]);

  const step = useCallback(() => {
    if (
      sim.status === 'idle' ||
      sim.status === 'done' ||
      sim.status === 'stopped'
    ) {
      const program = compile();
      if (!program.length) {
        setNotice('Agrega un bloque “al comenzar” para avanzar paso a paso');
        return;
      }
      postToWorker({ type: 'LOAD', program });
    }
    postToWorker({ type: 'STEP' });
    setNotice('Avanzamos una acción del programa');
  }, [compile, postToWorker, sim.status]);

  const loadExample = useCallback(
    (id: SceneId) => {
      const example = examples.find((item) => item.id === id) ?? examples[0];
      postToWorker({ type: 'STOP' });
      setProjectName(example.title);
      setScene(example.id);
      setWorkspace(example.workspace);
      setWorkspaceRevision((value) => value + 1);
      setExamplesOpen(false);
      setActiveTab('scene');
      setNotice(`Ejemplo cargado: ${example.title}`);
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
    setNotice('Proyecto JSON exportado');
    sound(860, 100, muted);
  }, [currentProject, muted, projectName]);

  const buildCode = useCallback(() => {
    const program = compile();
    const generated = generateEsp32Code(program, projectName);
    setCode(generated);
    return generated;
  }, [compile, projectName]);

  const openCode = useCallback(() => {
    buildCode();
    setCodeOpen(true);
  }, [buildCode]);

  const exportCode = useCallback(() => {
    const generated = buildCode();
    downloadText(
      `${safeFilename(projectName)}.ino`,
      generated,
      'text/x-c++src',
    );
    setNotice('Código .ino descargado');
  }, [buildCode, projectName]);

  const importProject = useCallback(
    async (file: File) => {
      try {
        if (file.size > 2_000_000)
          throw new Error('El archivo supera el límite de 2 MB');
        const parsed = JSON.parse(await file.text()) as unknown;
        if (!isProjectFile(parsed))
          throw new Error('No es un proyecto CapiBloques compatible');
        postToWorker({ type: 'STOP' });
        setProjectName(parsed.metadata.title);
        setScene(parsed.simulation.scene);
        setSpeed(parsed.simulation.speed);
        setWorkspace(normalizeWorkspace(parsed.workspace));
        setWorkspaceRevision((value) => value + 1);
        setNotice('Proyecto importado correctamente');
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

  const setInput = useCallback(
    (name: keyof SimState['inputs'], value: boolean | number) => {
      postToWorker({ type: 'SET_INPUT', name, value });
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
    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'load_capiblocks_example',
          title: 'Cargar ejemplo de CapiBloques',
          description:
            'Carga un ejemplo visible de semáforo, contador, robot o Wi-Fi en el editor.',
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
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadExample]);

  const trafficClass = (color: SimState['traffic']) =>
    sim.traffic === color
      ? `light ${color.toLowerCase()} on`
      : `light ${color.toLowerCase()}`;

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
            className="header-text-button"
            onClick={() => setComponentsOpen(true)}
          >
            <Blocks size={18} /> Componentes
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
          <strong>Misión: {selectedExample.title}</strong>
          <span>{selectedExample.mission}</span>
        </div>
        <button
          className="mission-button"
          onClick={() => setExamplesOpen(true)}
        >
          Cambiar misión
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
        <button onClick={() => postToWorker({ type: 'RESET' })}>
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
              <strong>Arrastra y encaja los bloques</strong>
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
            onChange={setWorkspace}
            onBlockSnap={() => sound(420, 45, muted, 0.025)}
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
              {scene === 'traffic' && (
                <div className="sim-stage traffic-scene">
                  <div className="sky-decor">
                    <span>☁️</span>
                    <span>☁️</span>
                  </div>
                  <div className="traffic-light">
                    <span className={trafficClass('RED')} />
                    <span className={trafficClass('YELLOW')} />
                    <span className={trafficClass('GREEN')} />
                  </div>
                  <div className="road">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="sim-character" aria-label="Capi, tu guía">
                    🦫
                  </div>
                </div>
              )}
              {scene === 'robot' && (
                <div className="sim-stage robot-scene">
                  <div className="robot-grid" />
                  <div className="obstacle one">🪨</div>
                  <div className="obstacle two">🌵</div>
                  <div
                    className="robot-sprite"
                    style={{
                      left: `${sim.robot.x}%`,
                      top: `${sim.robot.y}%`,
                      transform: `translate(-50%, -50%) rotate(${sim.robot.angle}deg)`,
                    }}
                  >
                    🤖<span />
                  </div>
                  <div className="scene-label">
                    Velocidad L {Math.round(sim.robot.left)}% · R{' '}
                    {Math.round(sim.robot.right)}%
                  </div>
                </div>
              )}
              {scene === 'wifi' && (
                <div className={`sim-stage wifi-scene ${sim.wifi}`}>
                  <div className="wifi-house">🏡</div>
                  <div className="wifi-router">
                    <Wifi size={55} />
                    <span>
                      {sim.wifi === 'connected'
                        ? 'Conectado'
                        : sim.wifi === 'connecting'
                          ? 'Buscando…'
                          : sim.wifi === 'error'
                            ? 'Sin señal'
                            : 'Listo'}
                    </span>
                  </div>
                  <div className="wifi-leds">
                    <span className={trafficClass('RED')} />
                    <span className={trafficClass('GREEN')} />
                  </div>
                  <div className="sim-character">🦫</div>
                </div>
              )}
              {scene === 'counter' && (
                <div className="sim-stage counter-scene">
                  <div className="counter-number">{sim.counter}</div>
                  <div
                    className={
                      sim.status === 'running' ? 'frog hopping' : 'frog'
                    }
                  >
                    🐸
                  </div>
                  <div className="lily-pads">
                    <span>🍃</span>
                    <span>🍃</span>
                    <span>🍃</span>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="state" className="sim-content state-content">
              <div className="state-grid">
                <article>
                  <span>💡 LED</span>
                  <strong>{Math.round(sim.ledBrightness)}%</strong>
                  <div className="brightness-track">
                    <i style={{ width: `${sim.ledBrightness}%` }} />
                  </div>
                </article>
                <article>
                  <span>🦾 Servo</span>
                  <strong>{Math.round(sim.servoAngle)}°</strong>
                  <div className="servo-dial">
                    <i
                      style={{ transform: `rotate(${sim.servoAngle - 90}deg)` }}
                    />
                  </div>
                </article>
                <article>
                  <span>📣 Buzzer</span>
                  <strong>
                    {sim.buzzer === 'off'
                      ? 'Apagado'
                      : sim.buzzer === 'active'
                        ? 'Beep activo'
                        : 'Nota pasiva'}
                  </strong>
                </article>
                <article>
                  <span>🔢 Contador</span>
                  <strong>{sim.counter}</strong>
                </article>
              </div>
              <div className="input-lab">
                <h3>Entradas para probar</h3>
                <div className="switch-row">
                  <span>🔘 Botón presionado</span>
                  <Switch
                    aria-label="Simular botón presionado"
                    checked={sim.inputs.button}
                    onCheckedChange={(checked) => setInput('button', checked)}
                  />
                </div>
                <div className="switch-row">
                  <span>📶 Red disponible</span>
                  <Switch
                    aria-label="Simular red Wi-Fi disponible"
                    checked={sim.inputs.wifiAvailable}
                    onCheckedChange={(checked) =>
                      setInput('wifiAvailable', checked)
                    }
                  />
                </div>
                <div className="range-row">
                  <span>
                    ☀️ Luz <b>{sim.inputs.light}</b>
                  </span>
                  <Slider
                    aria-label="Nivel de luz simulado"
                    min={0}
                    max={4095}
                    step={1}
                    value={[sim.inputs.light]}
                    onValueChange={(values) =>
                      setInput(
                        'light',
                        Array.isArray(values) ? values[0] : values,
                      )
                    }
                  />
                </div>
                <div className="range-row">
                  <span>
                    🎚️ Potenciómetro <b>{sim.inputs.potentiometer}</b>
                  </span>
                  <Slider
                    aria-label="Valor simulado del potenciómetro"
                    min={0}
                    max={4095}
                    step={1}
                    value={[sim.inputs.potentiometer]}
                    onValueChange={(values) =>
                      setInput(
                        'potentiometer',
                        Array.isArray(values) ? values[0] : values,
                      )
                    }
                  />
                </div>
              </div>
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
                {(sim.now / 1000).toFixed(1)} s de tiempo simulado ·{' '}
                {sim.status === 'running'
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
              Cada ejemplo combina bloques reales y una escena que puedes
              manipular.
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

      <Dialog open={componentsOpen} onOpenChange={setComponentsOpen}>
        <DialogContent className="components-dialog">
          <DialogHeader>
            <DialogTitle>Kit de componentes Wemos</DialogTitle>
            <DialogDescription>
              Los bloques usan nombres sencillos; el perfil técnico se ocupa de
              GPIO, PWM y ADC.
            </DialogDescription>
          </DialogHeader>
          <div className="safety-banner">
            <Wrench size={20} />
            <p>
              <strong>La placa usa lógica de 3,3 V.</strong> Motores y servos
              necesitan alimentación adecuada; los motores además necesitan un
              driver. La simulación no puede comprobar el cableado.
            </p>
          </div>
          <div className="component-table" aria-label="Componentes compatibles">
            {componentCatalog.map((component) => (
              <div className="component-row" key={component.id}>
                <span className="component-icon">{component.icon}</span>
                <span>
                  <strong>{component.name}</strong>
                  <small>{component.control}</small>
                </span>
                <code>{component.pins}</code>
                <em className={component.status}>
                  {component.status === 'ready'
                    ? 'Disponible'
                    : 'Siguiente fase'}
                </em>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="code-dialog">
          <DialogHeader>
            <DialogTitle>Código para WEMOS D1 R32</DialogTitle>
            <DialogDescription>
              Selecciona “WEMOS D1 R32” con Arduino-ESP32 3.x. Las esperas se
              generan con millis(), sin delay().
            </DialogDescription>
          </DialogHeader>
          <div className="code-actions">
            <span>{lastProgram.length} acciones visuales compiladas</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
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
