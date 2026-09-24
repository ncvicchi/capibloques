'use client';
import { DisplayPreview } from '@/components/display-preview';
import { LedMatrixPreview } from '@/components/led-matrix-preview';
import SceneViewport from '@/components/scene-viewport';

import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  SceneDefinition,
  SceneDevice,
  ScenePosition,
  SceneWidget,
} from '@/lib/scene-model';

export type RuntimeVisualDevice = {
  texts?: Record<string, string[]>;
  artworkRows?: number[];
  rows?: number[];
  kind: string;
  color?: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  brightness?: number;
  pixels?: string[];
  animation?: string | null;
  x?: number;
  y?: number;
  angle?: number;
  left?: number;
  right?: number;
  power?: number;
  playing?: boolean;
  frequency?: number;
  motion?: string;
  phase?: number;
  speed?: number;
  distance?: number;
  expression?: string;
  sound?: string | null;
  arms?: string;
  pressed?: boolean;
  interrupted?: boolean;
  value?: number;
  pressedButton?: 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' | null;
  status?: 'idle' | 'disconnected' | 'connecting' | 'connected' | 'error';
};

interface SceneStageProps {
  activeDeviceId?: string;
  activeDeviceMessage?: string;
  scene: SceneDefinition;
  runtimeDevices?: Record<string, RuntimeVisualDevice>;
  counter?: number;
  selectedId?: string;
  editing?: boolean;
  onSelect?: (deviceId: string) => boolean | void;
  onMove?: (deviceId: string, position: ScenePosition) => void;
  onMoveStart?: (deviceId: string) => void;
  onMoveEnd?: (deviceId: string) => void;
  onDelete?: (deviceId: string) => void;
  onDuplicate?: (deviceId: string) => void;
  dashboardModes?: Record<string, 'program' | 'manual'>;
  onDashboardAction?: (deviceId: string, action: 'cycle' | 'program') => void;
}

const icons: Record<SceneDevice['kind'], string> = {
  trafficLight: '🚦',
  robot: '🤖',
  otto: '🕺',
  motor: '⚙️',
  led: '💡',
  smartLights: '🌈',
  servo: '🦾',
  activeBuzzer: '📣',
  passiveBuzzer: '🎵',
  button: '🔘',
  infraredBarrier: '🚧',
  lightSensor: '☀️',
  potentiometer: '🎚️',
  wifiNode: '📶',
  display: '📺',
  ledMatrix: '🟨',
  messages: '↔️',
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

type MovableSceneItem = Pick<SceneDevice | SceneWidget, 'id' | 'position'>;

function DeviceVisual({
  device,
  runtime,
  sceneDevices,
  runtimeDevices,
  dashboardModes,
  onDashboardAction,
}: {
  device: SceneDevice;
  runtime?: RuntimeVisualDevice;
  sceneDevices: readonly SceneDevice[];
  runtimeDevices: Record<string, RuntimeVisualDevice>;
  dashboardModes?: Record<string, 'program' | 'manual'>;
  onDashboardAction?: (deviceId: string, action: 'cycle' | 'program') => void;
}) {
  if (device.kind === 'display')
    return (
      <DisplayPreview
        device={device}
        texts={runtime?.texts}
        artworkRows={runtime?.artworkRows}
        pressedButton={runtime?.pressedButton}
        dashboardDevices={sceneDevices}
        dashboardRuntime={runtimeDevices as Record<string, Record<string, unknown> | undefined>}
        dashboardModes={dashboardModes}
        onDashboardAction={onDashboardAction}
      />
    );
  if (device.kind === 'ledMatrix') return <LedMatrixPreview device={device} rows={runtime?.rows} />;
  if (device.kind === 'messages') return <span className="stage-messages" aria-hidden="true">↔️<small>{device.config.mode === 'send' ? 'enviar' : device.config.mode === 'receive' ? 'recibir' : 'ambos'}</small></span>;
  if (device.kind === 'trafficLight') {
    const color = runtime?.color ?? 'OFF';
    return (
      <span className="stage-traffic" aria-hidden="true">
        <i className={color === 'RED' ? 'red on' : 'red'} />
        <i className={color === 'YELLOW' ? 'yellow on' : 'yellow'} />
        <i className={color === 'GREEN' ? 'green on' : 'green'} />
      </span>
    );
  }
  if (device.kind === 'led') {
    const brightness = runtime?.brightness ?? device.config.brightness;
    return (
      <span
        className="stage-led"
        aria-hidden="true"
        style={{
          color: device.config.color,
          filter: `saturate(${0.5 + brightness / 80})`,
          opacity: 0.35 + brightness / 155,
        }}
      >
        💡
      </span>
    );
  }
  if (device.kind === 'smartLights') {
    const pixels = runtime?.kind === 'smartLights' && runtime.pixels ? runtime.pixels : Array.from({ length: Math.min(device.config.count, 16) }, () => '#000000');
    return <span className="stage-smart-lights" aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${device.config.geometry === 'matrix' ? device.config.width : Math.min(device.config.count, 8)}, 10px)`, gap: 2 }}>{pixels.slice(0, 32).map((color, index) => <i key={index} style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: color === '#000000' ? 'none' : `0 0 6px ${color}` }} />)}<small style={{ gridColumn: '1 / -1' }}>{runtime?.kind === 'smartLights' && runtime.animation ? runtime.animation : `${device.config.count} luces`}</small></span>;
  }
  if (device.kind === 'robot') {
    const left = Math.round(runtime?.left ?? 0);
    const right = Math.round(runtime?.right ?? 0);
    return (
      <span className="stage-robot" aria-hidden="true">
        🤖
        <small>
          {left}/{right}%
        </small>
      </span>
    );
  }
  if (device.kind === 'otto') {
    const moving = runtime?.motion && runtime.motion !== 'HOME';
    const expressive = device.config.profile === 'biped4-expressive' || device.config.profile === 'humanoid6-expressive';
    const humanoid = device.config.profile === 'humanoid6-expressive';
    const explorer = ['biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile);
    const hasSound = device.config.profile !== 'biped4';
    const faces: Record<string, string> = { SMILE: '😄', SAD: '😢', ANGRY: '😠', SURPRISED: '😮', SLEEPY: '😴', LOVE: '😍', CLEAR: '▫️' };
    const profileLabel = humanoid ? 'humanoide' : expressive ? 'expresivo' : explorer ? 'explorador' : hasSound ? 'con sonido' : 'bípedo';
    return (
      <span
        className={`stage-otto${moving ? ' moving' : ''}${humanoid ? ' humanoid' : ''}`}
        data-profile={device.config.profile}
        aria-hidden="true"
        style={{ '--otto-tilt': `${moving ? ((runtime?.phase ?? 0) % 2 ? 6 : -6) : 0}deg` } as CSSProperties}
      >
        <i className="otto-head">
          <b className="otto-face">{expressive ? (faces[runtime?.expression ?? 'SMILE'] ?? '😄') : explorer ? '◉‿◉' : '•‿•'}</b>
        </i>
        <i className="otto-body">{hasSound && <b>♪</b>}{explorer && <b>⌁</b>}</i>
        {humanoid && <><i className={`otto-arm left ${runtime?.arms && runtime.arms !== 'DOWN' ? 'raised' : ''}`} /><i className={`otto-arm right ${runtime?.arms && runtime.arms !== 'DOWN' ? 'raised' : ''}`} /></>}
        <i className="otto-leg left" /><i className="otto-leg right" />
        <small>{moving ? runtime?.motion?.replaceAll('_', ' ').toLowerCase() : profileLabel}{explorer ? ` · ${Math.round(runtime?.distance ?? 30)} cm` : ''}{runtime?.sound ? ' ♪' : ''}</small>
      </span>
    );
  }
  if (device.kind === 'motor') {
    return (
      <span
        className={(runtime?.power ?? 0) ? 'stage-motor active' : 'stage-motor'}
        aria-hidden="true"
      >
        ⚙️<small>{Math.round(runtime?.power ?? 0)}%</small>
      </span>
    );
  }
  if (device.kind === 'servo') {
    const angle = Math.round(runtime?.angle ?? device.config.angle);
    return (
      <span className="stage-servo" aria-hidden="true">
        🦾<small>{angle}°</small>
      </span>
    );
  }
  if (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') {
    return (
      <span
        className={runtime?.playing ? 'stage-buzzer playing' : 'stage-buzzer'}
        aria-hidden="true"
      >
        {icons[device.kind]}
        <small>{runtime?.playing ? 'sonando' : 'listo'}</small>
      </span>
    );
  }
  if (device.kind === 'button') {
    return (
      <span
        className={runtime?.pressed ? 'stage-button pressed' : 'stage-button'}
        aria-hidden="true"
      >
        🔘<small>{runtime?.pressed ? 'pulsado' : 'libre'}</small>
      </span>
    );
  }
  if (device.kind === 'infraredBarrier') {
    const interrupted = runtime?.interrupted ?? device.config.interrupted;
    return (
      <span className={interrupted ? 'stage-barrier interrupted' : 'stage-barrier'} aria-hidden="true">
        🚧<small>{interrupted ? 'interrumpida' : 'libre'}</small>
      </span>
    );
  }
  if (device.kind === 'lightSensor' || device.kind === 'potentiometer') {
    return (
      <span className="stage-sensor" aria-hidden="true">
        {icons[device.kind]}
        <small>{Math.round(runtime?.value ?? device.config.value)}</small>
      </span>
    );
  }
  if (device.kind === 'wifiNode') {
    const status = runtime?.status ?? device.config.status;
    return (
      <span className={`stage-wifi ${status}`} aria-hidden="true">
        📶
        <small>
          {status === 'connected'
            ? 'conectado'
            : status === 'connecting'
              ? 'buscando'
              : status === 'error'
                ? 'sin red'
                : 'listo'}
        </small>
      </span>
    );
  }
  return null;
}

export default function SceneStage({
  activeDeviceId,
  activeDeviceMessage,
  scene,
  runtimeDevices = {},
  counter = 0,
  selectedId,
  editing = false,
  onSelect,
  onMove,
  onMoveStart,
  onMoveEnd,
  onDelete,
  onDuplicate,
  dashboardModes,
  onDashboardAction,
}: SceneStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    deviceId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pendingMoveRef = useRef<{
    deviceId: string;
    position: ScenePosition;
  } | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const keyboardMoveRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (moveFrameRef.current !== null)
        window.cancelAnimationFrame(moveFrameRef.current);
    },
    [],
  );

  const flushPendingMove = () => {
    if (moveFrameRef.current !== null) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (pending) onMove?.(pending.deviceId, pending.position);
  };

  const pointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: MovableSceneItem,
  ) => {
    if (onSelect?.(item.id) === false) return;
    if (!editing || !onMove || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const currentX = (item.position.x / scene.canvas.width) * rect.width;
    const currentY = (item.position.y / scene.canvas.height) * rect.height;
    dragRef.current = {
      pointerId: event.pointerId,
      deviceId: item.id,
      offsetX: event.clientX - rect.left - currentX,
      offsetY: event.clientY - rect.top - currentY,
    };
    onMoveStart?.(item.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || drag.pointerId !== event.pointerId || !onMove)
      return;
    const rect = stage.getBoundingClientRect();
    let x =
      ((event.clientX - rect.left - drag.offsetX) / rect.width) *
      scene.canvas.width;
    let y =
      ((event.clientY - rect.top - drag.offsetY) / rect.height) *
      scene.canvas.height;
    if (scene.canvas.snapToGrid) {
      x = Math.round(x / scene.canvas.gridSize) * scene.canvas.gridSize;
      y = Math.round(y / scene.canvas.gridSize) * scene.canvas.gridSize;
    }
    pendingMoveRef.current = {
      deviceId: drag.deviceId,
      position: {
        x: clamp(x, 24, scene.canvas.width - 24),
        y: clamp(y, 24, scene.canvas.height - 24),
      },
    };
    if (moveFrameRef.current === null) {
      moveFrameRef.current = window.requestAnimationFrame(() => {
        moveFrameRef.current = null;
        const pending = pendingMoveRef.current;
        pendingMoveRef.current = null;
        if (pending) onMove(pending.deviceId, pending.position);
      });
    }
    event.preventDefault();
  };

  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    flushPendingMove();
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onMoveEnd?.(drag.deviceId);
  };

  const moveWithKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    item: MovableSceneItem,
  ) => {
    if (!editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      if (onSelect?.(item.id) === false) return;
      onDuplicate?.(item.id);
      event.preventDefault();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (onSelect?.(item.id) === false) return;
      onDelete?.(item.id);
      event.preventDefault();
      return;
    }
    if (!onMove) return;
    const step = scene.canvas.snapToGrid
      ? scene.canvas.gridSize
      : event.shiftKey
        ? 20
        : 5;
    const delta = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key];
    if (!delta) return;
    if (onSelect?.(item.id) === false) return;
    if (keyboardMoveRef.current !== item.id) {
      if (keyboardMoveRef.current) onMoveEnd?.(keyboardMoveRef.current);
      keyboardMoveRef.current = item.id;
      onMoveStart?.(item.id);
    }
    const nextX = item.position.x + delta.x;
    const nextY = item.position.y + delta.y;
    onMove(item.id, {
      x: clamp(
        scene.canvas.snapToGrid
          ? Math.round(nextX / scene.canvas.gridSize) * scene.canvas.gridSize
          : nextX,
        24,
        scene.canvas.width - 24,
      ),
      y: clamp(
        scene.canvas.snapToGrid
          ? Math.round(nextY / scene.canvas.gridSize) * scene.canvas.gridSize
          : nextY,
        24,
        scene.canvas.height - 24,
      ),
    });
    event.preventDefault();
  };

  const finishKeyboardMove = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    item: MovableSceneItem,
  ) => {
    if (!event.key.startsWith('Arrow') || keyboardMoveRef.current !== item.id)
      return;
    keyboardMoveRef.current = null;
    onMoveEnd?.(item.id);
  };

  const finishKeyboardMoveOnBlur = (item: MovableSceneItem) => {
    if (keyboardMoveRef.current !== item.id) return;
    keyboardMoveRef.current = null;
    onMoveEnd?.(item.id);
  };

  const gridStyle = {
    aspectRatio: `${scene.canvas.width} / ${scene.canvas.height}`,
    '--scene-grid-x': `${(scene.canvas.gridSize / scene.canvas.width) * 100}%`,
    '--scene-grid-y': `${(scene.canvas.gridSize / scene.canvas.height) * 100}%`,
  } as CSSProperties;

  return (
    <SceneViewport key={`${scene.id}:${scene.canvas.width}:${scene.canvas.height}`} width={scene.canvas.width} height={scene.canvas.height}>
    <section
      ref={stageRef}
      className={`scene-stage scene-background-${scene.canvas.background}${editing ? ' editing' : ''}`}
      style={gridStyle}
      data-testid="scene-stage"
      aria-label={
        editing ? 'Objetos de la escena editable' : 'Simulación de la escena'
      }
      aria-describedby={editing ? 'scene-stage-keyboard-help' : undefined}
    >
      {editing && (
        <p id="scene-stage-keyboard-help" className="sr-only">
          Selecciona un objeto con Tab. Muévelo con las flechas, elimínalo con
          Suprimir y duplica componentes con Control o Comando más D. El
          contador global es único.
        </p>
      )}
      <div className="scene-grid" aria-hidden="true" />
      {scene.widgets.map((widget) => {
        const style = {
          left: `${(widget.position.x / scene.canvas.width) * 100}%`,
          top: `${(widget.position.y / scene.canvas.height) * 100}%`,
        };
        const contents = (
          <>
            <strong>{counter}</strong>
            <span>{widget.config.mascot}</span>
            <small>{widget.name}</small>
          </>
        );
        if (!editing) {
          return (
            <article
              className="scene-widget"
              key={widget.id}
              style={style}
              aria-label={`${widget.name}: contador en ${counter}`}
            >
              {contents}
            </article>
          );
        }
        return (
          <button
            type="button"
            className={`scene-widget${selectedId === widget.id ? ' selected' : ''}`}
            key={widget.id}
            style={style}
            aria-label={`Mover ${widget.name}`}
            aria-pressed={selectedId === widget.id}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete Control+D Meta+D"
            onPointerDown={(event) => pointerDown(event, widget)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onLostPointerCapture={pointerUp}
            onClick={() => onSelect?.(widget.id)}
            onKeyDown={(event) => moveWithKeyboard(event, widget)}
            onKeyUp={(event) => finishKeyboardMove(event, widget)}
            onBlur={() => finishKeyboardMoveOnBlur(widget)}
          >
            {contents}
          </button>
        );
      })}
      {scene.devices.map((device) => {
        const runtime = runtimeDevices[device.id];
        const runtimeX = device.kind === 'robot' ? runtime?.x : undefined;
        const runtimeY = device.kind === 'robot' ? runtime?.y : undefined;
        const position = {
          x:
            typeof runtimeX === 'number' && !editing
              ? (runtimeX / 100) * scene.canvas.width
              : device.position.x,
          y:
            typeof runtimeY === 'number' && !editing
              ? (runtimeY / 100) * scene.canvas.height
              : device.position.y,
        };
        const rotation =
          device.kind === 'robot'
            ? typeof runtime?.angle === 'number'
              ? runtime.angle
              : device.rotation + device.config.heading
            : device.rotation;
        const style = {
          left: `${(position.x / scene.canvas.width) * 100}%`,
          top: `${(position.y / scene.canvas.height) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        };
        const contents = (
          <>
            <DeviceVisual device={device} runtime={runtime} sceneDevices={scene.devices} runtimeDevices={runtimeDevices} dashboardModes={dashboardModes} onDashboardAction={onDashboardAction} />
            <span className="scene-device-name">{device.name}</span>
          </>
        );
        if (!editing) {
          return (
            <article
              key={device.id}
              data-device-id={device.id}
              className={`scene-device scene-device-${device.kind}${activeDeviceId === device.id ? ' scene-device-active' : ''}`}
              style={style}
              aria-label={
                activeDeviceId === device.id && activeDeviceMessage
                  ? `${device.name}. ${activeDeviceMessage}`
                  : device.name
              }
            >
              {contents}
              {activeDeviceId === device.id && (
                <strong className="device-now">
                  ➜ {activeDeviceMessage ?? 'Ahora'}
                </strong>
              )}
            </article>
          );
        }
        return (
          <button
            type="button"
            key={device.id}
            data-device-id={device.id}
            className={`scene-device scene-device-${device.kind}${selectedId === device.id ? ' selected' : ''}`}
            style={style}
            aria-label={`Mover ${device.name}`}
            aria-pressed={selectedId === device.id}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete Control+D Meta+D"
            onClick={() => onSelect?.(device.id)}
            onPointerDown={(event) => pointerDown(event, device)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onLostPointerCapture={pointerUp}
            onKeyDown={(event) => moveWithKeyboard(event, device)}
            onKeyUp={(event) => finishKeyboardMove(event, device)}
            onBlur={() => finishKeyboardMoveOnBlur(device)}
          >
            {contents}
          </button>
        );
      })}
      {!scene.devices.length && !scene.widgets.length && (
        <div className="scene-empty">
          <span>🧰</span>
          <strong>La escena está vacía</strong>
          <small>Agrega un componente desde la biblioteca.</small>
        </div>
      )}
    </section>
    </SceneViewport>
  );
}
