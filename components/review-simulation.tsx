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
import BlocklyWorkspace, {
  type BlocklyWorkspaceHandle,
} from '@/components/blockly-workspace';
import SceneStage from '@/components/scene-stage';
import ExecutionPanel from '@/components/execution-panel';
import { Button } from '@/components/ui/button';
import {
  generateEsp32CodeResult,
  collectRawOutputPins,
  type ProjectFile,
  type SimulatorState,
  type CompiledProgram,
  type CapiDiagnostic,
} from '@/lib/capiblocks';
// Vite convierte el worker durante el build.
// oxlint-disable-next-line import/default
import SimulatorWorker from '@/lib/simulator.worker.ts?worker';

const WiringGuide = lazy(() => import('@/components/wiring-guide'));

export default function ReviewSimulation({
  project,
  onCode,
}: {
  project: ProjectFile;
  onCode: (code: string | null) => void;
}) {
  const editor = useRef<BlocklyWorkspaceHandle>(null);
  const worker = useRef<Worker | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const sounds = useRef(new Map<string, OscillatorNode>());
  const soundEnabled = useRef(false);
  const [muted, setMuted] = useState(true);
  const [program, setProgram] = useState<CompiledProgram | null>(null);
  const [state, setState] = useState<SimulatorState | null>(null);
  const [diagnostics, setDiagnostics] = useState<CapiDiagnostic[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [speed, setSpeed] = useState(1);
  const [wiringOpen, setWiringOpen] = useState(false);
  const [wiringChecked, setWiringChecked] = useState(false);
  const generated = useMemo(
    () =>
      program
        ? generateEsp32CodeResult(
            program,
            project.metadata.title,
            project.scene,
          )
        : null,
    [program, project],
  );
  const rawPins = useMemo(
    () =>
      generated ? collectRawOutputPins(generated.program, project.scene) : [],
    [generated, project.scene],
  );
  const needsWiring =
    project.scene.devices.some((device) => device.kind !== 'wifiNode') ||
    rawPins.length > 0;
  const speedRef = useRef(1);
  const stopSounds = useCallback((key?: string) => {
    for (const [id, oscillator] of sounds.current) {
      if (key && key !== id) continue;
      try {
        oscillator.stop();
      } catch {
        /* Ya terminó. */
      }
      sounds.current.delete(id);
    }
  }, []);
  useEffect(() => {
    const instance: Worker = new SimulatorWorker();
    worker.current = instance;
    instance.onmessage = (event) => {
      if (event.data.type === 'SNAPSHOT') {
        const next = event.data.state as SimulatorState;
        setState(next);
        editor.current?.highlight(
          Object.values(next.activeBlockIds).filter((id): id is string =>
            Boolean(id),
          ),
        );
      }
      if (event.data.type === 'DIAGNOSTICS') {
        setDiagnostics(event.data.diagnostics);
        setBlocked(event.data.simulationBlocked);
      }
      if (event.data.type === 'SOUND_STOP') stopSounds(event.data.deviceId);
      if (
        event.data.type === 'SOUND' &&
        soundEnabled.current &&
        audio.current
      ) {
        const context = audio.current,
          id = String(event.data.deviceId);
        stopSounds(id);
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.frequency.value = Math.max(
          40,
          Math.min(5000, event.data.frequency),
        );
        gain.gain.setValueAtTime(0.025, context.currentTime);
        const end =
          context.currentTime +
          Math.max(0.01, event.data.durationMs / speedRef.current / 1000);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain).connect(context.destination);
        sounds.current.set(id, oscillator);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          if (sounds.current.get(id) === oscillator) sounds.current.delete(id);
        };
        oscillator.start();
        oscillator.stop(end);
      }
    };
    instance.onerror = () => {
      setError(
        'La simulación se interrumpió. Recargá la revisión para volver a probar.',
      );
      setBlocked(true);
      stopSounds();
    };
    return () => {
      instance.terminate();
      worker.current = null;
      stopSounds();
      void audio.current?.close();
      audio.current = null;
    };
  }, [stopSounds]);
  useEffect(() => {
    if (!program) return;
    worker.current?.postMessage({
      type: 'LOAD',
      program,
      scene: project.scene,
    });
    worker.current?.postMessage({ type: 'SET_SPEED', speed: speedRef.current });
  }, [program, project]);
  useEffect(() => {
    onCode(
      !generated ||
        generated.diagnostics.some((item) => item.severity === 'error') ||
        (needsWiring && !wiringChecked)
        ? null
        : generated.code,
    );
  }, [generated, needsWiring, onCode, wiringChecked]);
  const compile = useCallback(() => {
    if (editor.current) setProgram(editor.current.compile());
  }, []);
  function command(type: string) {
    if (type !== 'RUN') stopSounds();
    worker.current?.postMessage({ type });
  }
  const status = {
    idle: 'Lista para probar',
    running: 'Ejecutando',
    paused: 'En pausa',
    stopped: 'Detenida',
    done: 'Terminó',
  };
  return (
    <div className="review-lab">
      <section className="review-blocks" aria-label="Programa de sólo lectura">
        <h2>Bloques · sólo lectura</h2>
        <Button variant="outline" onClick={() => editor.current?.zoomToFit()}>
          Encuadrar bloques
        </Button>
        <BlocklyWorkspace
          ref={editor}
          readOnly
          initialWorkspace={project.workspace}
          revision={1}
          devices={project.scene.devices}
          onChange={compile}
          onError={(message) => {
            setError(message);
            setBlocked(true);
          }}
        />
      </section>
      <section className="review-stage" aria-label="Simulación de la versión">
        <h2>Probar sin cambiar el trabajo</h2>
        <Button
          variant="outline"
          disabled={!generated}
          onClick={() => setWiringOpen(true)}
        >
          Revisar cableado de esta versión
        </Button>
        {needsWiring && !wiringChecked && (
          <p className="account-help">
            Para descargar Arduino, revisá primero la guía de conexiones y
            completá su chequeo. La simulación no certifica seguridad eléctrica.
          </p>
        )}
        <div className="account-actions">
          <Button
            disabled={!program || blocked || state?.status === 'running'}
            onClick={() => command('RUN')}
          >
            Simular
          </Button>
          <Button
            variant="outline"
            disabled={state?.status !== 'running'}
            onClick={() => command('PAUSE')}
          >
            Pausar
          </Button>
          <Button
            variant="outline"
            disabled={!program || blocked || state?.status === 'running'}
            onClick={() => command('STEP')}
          >
            Un paso
          </Button>
          <Button
            variant="outline"
            disabled={!program}
            onClick={() => command('STOP')}
          >
            Detener
          </Button>
          <Button
            variant="outline"
            disabled={!program}
            onClick={() => command('RESET')}
          >
            Reiniciar simulación
          </Button>
        </div>
        <div className="review-sim-options">
          <label>
            Velocidad de simulación{' '}
            <select
              value={speed}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSpeed(next);
                speedRef.current = next;
                worker.current?.postMessage({ type: 'SET_SPEED', speed: next });
              }}
            >
              <option value={0.25}>Lenta · ¼×</option>
              <option value={0.5}>Media · ½×</option>
              <option value={1}>Normal · 1×</option>
              <option value={2}>Rápida · 2×</option>
            </select>
          </label>
          <Button
            variant="outline"
            aria-pressed={!muted}
            onClick={() => {
              if (muted) {
                try {
                  audio.current ??= new AudioContext();
                  void audio.current
                    .resume()
                    .catch(() =>
                      setError('El navegador no permitió activar sonido.'),
                    );
                } catch {
                  setError('Este navegador no permite sonido.');
                  return;
                }
              } else stopSounds();
              soundEnabled.current = muted;
              setMuted(!muted);
            }}
          >
            {muted ? 'Activar sonido' : 'Silenciar'}
          </Button>
        </div>
        <output className="review-sim-status">
          {state ? status[state.status] : 'Preparando simulación…'} ·{' '}
          {((state?.now ?? 0) / 1000).toFixed(1)} s · Contador:{' '}
          {state?.counter ?? 0}
        </output>
        <ExecutionPanel state={state} post={message => worker.current?.postMessage(message)} onFollow={blockId => editor.current?.focusBlock(blockId)} />
        <SceneStage
          activeDeviceId={state?.execution?.trace.at(-1)?.deviceId}
          scene={project.scene}
          runtimeDevices={state?.devices}
          counter={state?.counter}
        />
        <fieldset className="review-inputs" disabled={!program}>
          <legend>Sensores simulados</legend>
          {project.scene.devices.map((device) => {
            const runtime = state?.devices[device.id];
            if (device.kind === 'button')
              return (
                <label key={device.id}>
                  <input
                    type="checkbox"
                    checked={
                      runtime?.kind === 'button'
                        ? runtime.pressed
                        : device.config.pressed
                    }
                    onChange={(event) =>
                      worker.current?.postMessage({
                        type: 'SET_INPUT',
                        deviceId: device.id,
                        value: event.target.checked,
                      })
                    }
                  />
                  {device.name} · presionado
                </label>
              );
            if (
              device.kind === 'lightSensor' ||
              device.kind === 'potentiometer'
            )
              return (
                <label key={device.id}>
                  {device.name} ·{' '}
                  {runtime && 'value' in runtime
                    ? runtime.value
                    : device.config.value}
                  <input
                    type="range"
                    min={0}
                    max={4095}
                    value={
                      runtime && 'value' in runtime
                        ? runtime.value
                        : device.config.value
                    }
                    onChange={(event) =>
                      worker.current?.postMessage({
                        type: 'SET_INPUT',
                        deviceId: device.id,
                        value: Number(event.target.value),
                      })
                    }
                  />
                </label>
              );
            return null;
          })}
          <label>
            <input
              type="checkbox"
              checked={state?.wifiAvailable ?? true}
              onChange={(event) =>
                worker.current?.postMessage({
                  type: 'SET_INPUT',
                  name: 'wifiAvailable',
                  value: event.target.checked,
                })
              }
            />
            Red Wi-Fi simulada disponible
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        {diagnostics.length > 0 && (
          <details className="review-diagnostics">
            <summary>
              Avisos de bloques y cableado ({diagnostics.length})
            </summary>
            <ul>
              {diagnostics.map((item, index) => (
                <li key={index}>{item.message}</li>
              ))}
            </ul>
          </details>
        )}
        <h3>Consola simulada · no es la placa</h3>
        {/* El área de salida necesita foco para desplazarla por teclado. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <pre className="review-console" tabIndex={0}>
          {state?.console.join('\n') ||
            'Los mensajes del programa aparecerán aquí.'}
        </pre>
        <p className="account-help">
          Cambiar sensores, velocidad o sonido sólo afecta esta prueba. No se
          guarda en el proyecto.
        </p>
      </section>
      <Suspense fallback={null}>
        {generated && (
          <WiringGuide
            open={wiringOpen}
            onOpenChange={setWiringOpen}
            scene={project.scene}
            rawPins={rawPins}
            diagnostics={generated.diagnostics}
            acknowledged={wiringChecked}
            onAcknowledgedChange={setWiringChecked}
          />
        )}
      </Suspense>
    </div>
  );
}
