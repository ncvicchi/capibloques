'use client';

import {
  useEffect,
  useRef,
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
  kind: string;
  color?: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  brightness?: number;
  x?: number;
  y?: number;
  angle?: number;
  left?: number;
  right?: number;
  power?: number;
  playing?: boolean;
  frequency?: number;
  pressed?: boolean;
  value?: number;
  status?: 'idle' | 'disconnected' | 'connecting' | 'connected' | 'error';
};

interface SceneStageProps {
  scene: SceneDefinition;
  runtimeDevices?: Record<string, RuntimeVisualDevice>;
  counter?: number;
  selectedId?: string;
  editing?: boolean;
  onSelect?: (deviceId: string) => void;
  onMove?: (deviceId: string, position: ScenePosition) => void;
}

const icons: Record<SceneDevice['kind'], string> = {
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

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

type MovableSceneItem = Pick<SceneDevice | SceneWidget, 'id' | 'position'>;

function DeviceVisual({
  device,
  runtime,
}: {
  device: SceneDevice;
  runtime?: RuntimeVisualDevice;
}) {
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
  if (device.kind === 'robot') {
    const left = Math.round(runtime?.left ?? 0);
    const right = Math.round(runtime?.right ?? 0);
    return (
      <span className="stage-robot" aria-hidden="true">
        🤖<small>{left}/{right}%</small>
      </span>
    );
  }
  if (device.kind === 'motor') {
    return (
      <span className={(runtime?.power ?? 0) ? 'stage-motor active' : 'stage-motor'}>
        ⚙️<small>{Math.round(runtime?.power ?? 0)}%</small>
      </span>
    );
  }
  if (device.kind === 'servo') {
    const angle = Math.round(runtime?.angle ?? device.config.angle);
    return (
      <span className="stage-servo">
        🦾<small>{angle}°</small>
      </span>
    );
  }
  if (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') {
    return (
      <span className={runtime?.playing ? 'stage-buzzer playing' : 'stage-buzzer'}>
        {icons[device.kind]}
        <small>{runtime?.playing ? 'sonando' : 'listo'}</small>
      </span>
    );
  }
  if (device.kind === 'button') {
    return (
      <span className={runtime?.pressed ? 'stage-button pressed' : 'stage-button'}>
        🔘<small>{runtime?.pressed ? 'pulsado' : 'libre'}</small>
      </span>
    );
  }
  if (device.kind === 'lightSensor' || device.kind === 'potentiometer') {
    return (
      <span className="stage-sensor">
        {icons[device.kind]}<small>{Math.round(runtime?.value ?? device.config.value)}</small>
      </span>
    );
  }
  if (device.kind === 'wifiNode') {
    const status = runtime?.status ?? device.config.status;
    return (
      <span className={`stage-wifi ${status}`}>
        📶<small>{status === 'connected' ? 'conectado' : status === 'connecting' ? 'buscando' : status === 'error' ? 'sin red' : 'listo'}</small>
      </span>
    );
  }
  return null;
}

export default function SceneStage({
  scene,
  runtimeDevices = {},
  counter = 0,
  selectedId,
  editing = false,
  onSelect,
  onMove,
}: SceneStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
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

  useEffect(
    () => () => {
      if (moveFrameRef.current !== null)
        window.cancelAnimationFrame(moveFrameRef.current);
    },
    [],
  );

  const pointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: MovableSceneItem,
  ) => {
    onSelect?.(item.id);
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
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || drag.pointerId !== event.pointerId || !onMove) return;
    const rect = stage.getBoundingClientRect();
    let x = ((event.clientX - rect.left - drag.offsetX) / rect.width) * scene.canvas.width;
    let y = ((event.clientY - rect.top - drag.offsetY) / rect.height) * scene.canvas.height;
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
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const moveWithKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    item: MovableSceneItem,
  ) => {
    if (!editing || !onMove) return;
    const step = event.shiftKey ? scene.canvas.gridSize : 5;
    const delta = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key];
    if (!delta) return;
    onMove(item.id, {
      x: clamp(item.position.x + delta.x, 24, scene.canvas.width - 24),
      y: clamp(item.position.y + delta.y, 24, scene.canvas.height - 24),
    });
    event.preventDefault();
  };

  return (
    <div
      ref={stageRef}
      className={`scene-stage scene-background-${scene.canvas.background}${editing ? ' editing' : ''}`}
      style={{ aspectRatio: `${scene.canvas.width} / ${scene.canvas.height}` }}
      data-testid="scene-stage"
    >
      <div className="scene-grid" aria-hidden="true" />
      {scene.widgets.map((widget) => (
        <button
          type="button"
          className={`scene-widget${selectedId === widget.id ? ' selected' : ''}`}
          key={widget.id}
          style={{
            left: `${(widget.position.x / scene.canvas.width) * 100}%`,
            top: `${(widget.position.y / scene.canvas.height) * 100}%`,
          }}
          aria-label={`${editing ? 'Mover' : 'Ver'} ${widget.name}`}
          tabIndex={editing ? 0 : -1}
          onPointerDown={(event) => pointerDown(event, widget)}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onFocus={() => editing && onSelect?.(widget.id)}
          onClick={() => editing && onSelect?.(widget.id)}
          onKeyDown={(event) => moveWithKeyboard(event, widget)}
        >
          <strong>{counter}</strong>
          <span>{widget.config.mascot}</span>
          <small>{widget.name}</small>
        </button>
      ))}
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
          device.rotation +
          (device.kind === 'robot' && typeof runtime?.angle === 'number'
            ? runtime.angle
            : 0);
        return (
          <button
            type="button"
            key={device.id}
            data-device-id={device.id}
            className={`scene-device scene-device-${device.kind}${selectedId === device.id ? ' selected' : ''}`}
            style={{
              left: `${(position.x / scene.canvas.width) * 100}%`,
              top: `${(position.y / scene.canvas.height) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
            aria-label={`${editing ? 'Mover' : 'Ver'} ${device.name}`}
            tabIndex={editing ? 0 : -1}
            onFocus={() => editing && onSelect?.(device.id)}
            onClick={() => editing && onSelect?.(device.id)}
            onPointerDown={(event) => pointerDown(event, device)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onKeyDown={(event) => moveWithKeyboard(event, device)}
          >
            <DeviceVisual device={device} runtime={runtime} />
            <span className="scene-device-name">{device.name}</span>
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
    </div>
  );
}
