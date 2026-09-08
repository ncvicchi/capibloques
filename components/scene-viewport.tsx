'use client';

// This custom camera surface needs a keyboard focus target and pointer capture.
// Its toolbar remains native buttons; the application role documents canvas keys.
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Hand, Minus, Plus, Scan } from 'lucide-react';
import { constrainCamera, fittedCamera, MAX_SCENE_ZOOM, MIN_SCENE_ZOOM, zoomScene, type SceneCamera } from '@/lib/scene-camera';

/** A local camera, deliberately outside the project's undo/save/serialization. */
export default function SceneViewport({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState<SceneCamera>(fittedCamera);
  const current = useRef(camera);
  const [hand, setHand] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const commit = (next: SceneCamera) => { current.current = constrainCamera(next, size, { width, height }); setCamera(current.current); };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const bounded = constrainCamera(camera, size, { width, height });
  const scale = Math.min(size.width / width, size.height / height) * bounded.zoom;
  const anchor = (x: number, y: number) => {
    const rect = viewport.current!.getBoundingClientRect();
    return { x: x - rect.left - size.width / 2, y: y - rect.top - size.height / 2 };
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (!hand && event.button !== 1 && (event.target as Element).closest('[data-device-id], button')) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
    let next = current.current;
    if (other) {
      const oldDistance = Math.hypot(before.x - other.x, before.y - other.y);
      const distance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (oldDistance > 2) next = zoomScene(next, next.zoom * distance / oldDistance, anchor((before.x + other.x) / 2, (before.y + other.y) / 2));
      next = { ...next, x: next.x + (event.clientX - before.x) / 2, y: next.y + (event.clientY - before.y) / 2 };
    } else next = { ...next, x: next.x + event.clientX - before.x, y: next.y + event.clientY - before.y };
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    commit(next); event.preventDefault(); event.stopPropagation();
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const changeZoom = (factor: number) => commit(zoomScene(current.current, current.current.zoom * factor, { x: 0, y: 0 }));
  return <div className="scene-camera">
    <div className="scene-camera-tools" role="toolbar" aria-label="Vista de la escena">
      <button type="button" aria-label="Alejar escena" title="Alejar escena" disabled={camera.zoom <= MIN_SCENE_ZOOM} onClick={() => changeZoom(1 / 1.25)}><Minus size={16} /></button>
      <output aria-label="Zoom de escena">{Math.round(camera.zoom * 100)}%</output>
      <button type="button" aria-label="Acercar escena" title="Acercar escena" disabled={camera.zoom >= MAX_SCENE_ZOOM} onClick={() => changeZoom(1.25)}><Plus size={16} /></button>
      <button type="button" aria-label="Ajustar escena" title="Ver la escena completa (100%)" onClick={() => commit(fittedCamera)}><Scan size={16} /><span>Ajustar</span></button>
      <button type="button" aria-label="Mover vista de la escena" aria-pressed={hand} title="Mano: mover la vista sin mover componentes. Dos dedos: zoom." onClick={() => setHand(value => !value)}><Hand size={16} /><span>Mano</span></button>
    </div>
    <div ref={viewport} className={`scene-viewport${hand ? ' hand-mode' : ''}`} tabIndex={0} role="application" aria-label="Lienzo de la escena" aria-roledescription="Lienzo navegable con flechas, más, menos y cero" data-camera-x={bounded.x.toFixed(2)} data-camera-y={bounded.y.toFixed(2)} data-camera-zoom={camera.zoom}
      onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={end} onPointerCancelCapture={end} onLostPointerCapture={end}
      onClickCapture={event => { if (hand) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const delta = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[event.key];
        if (event.key === 'Escape') setHand(false);
        else if (event.key === '+' || event.key === '=') changeZoom(1.25);
        else if (event.key === '-') changeZoom(1 / 1.25);
        else if (event.key === '0' || event.key === 'Home') commit(fittedCamera);
        else if (delta) commit({ ...current.current, x: current.current.x + delta[0], y: current.current.y + delta[1] });
        else return;
        event.preventDefault();
      }}>
      <div className="scene-camera-world" style={{ width, height, transform: `translate(${(size.width - width * scale) / 2 + bounded.x}px, ${(size.height - height * scale) / 2 + bounded.y}px) scale(${scale})` }}>{children}</div>
    </div>
    <span className="scene-camera-hint">Arrastrá el fondo o usá Mano · + / − acercan · 0 ajusta</span>
  </div>;
}
