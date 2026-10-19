'use client';
import { useRef, useState, type PointerEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  lineLimits,
  linePreset,
  linePresetNames,
  segmentDistance,
  validLineCircuit,
  type LineCircuit,
} from '@/lib/line-world';
import type { ScenePosition } from '@/lib/scene-model';
type Props = {
  value: LineCircuit;
  onSave: (v: LineCircuit) => void;
  onCancel: () => void;
};
export default function LineCircuitEditor({ value, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(value)),
    [history, setHistory] = useState<LineCircuit[]>([structuredClone(value)]),
    [index, setIndex] = useState(0),
    [tool, setTool] = useState('pencil'),
    [selected, setSelected] = useState(-1),
    [anchors, setAnchors] = useState<ScenePosition[]>([]),
    [message, setMessage] = useState('');
  const gesture = useRef<{
      base: LineCircuit;
      start: ScenePosition;
      points: ScenePosition[];
      pointer: number;
      stroke: number;
    } | null>(null),
    latest = useRef(draft);
  const update = (v: LineCircuit) => {
    latest.current = v;
    setDraft(v);
  };
  const commit = (v: LineCircuit) => {
    if (!validLineCircuit(v)) {
      setMessage(
        `Límite: ${lineLimits.strokes} trazos, ${lineLimits.points} puntos en total y ${lineLimits.perStroke} por trazo. No se perdió el dibujo anterior.`,
      );
      update(history[index]);
      return;
    }
    if (JSON.stringify(v) === JSON.stringify(history[index])) {
      update(v);
      return;
    }
    const next = [...history.slice(0, index + 1), v].slice(-60);
    setHistory(next);
    setIndex(next.length - 1);
    update(v);
    setMessage('');
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const cancel = () => {
    if (!dirty || window.confirm('¿Cerrar sin guardar el circuito?'))
      onCancel();
  };
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(45, Math.min(915, ((e.clientX - b.left) * 960) / b.width)),
      ),
      y: Math.round(
        Math.max(75, Math.min(485, ((e.clientY - b.top) * 540) / b.height)),
      ),
    };
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || gesture.current) return;
    const p = point(e);
    e.preventDefault();
    if (tool === 'curve') {
      const a = [...anchors, p];
      if (a.length === 3) {
        const [p0, p1, p2] = a;
        commit({
          ...draft,
          strokes: [
            ...draft.strokes,
            Array.from({ length: 33 }, (_, i) => {
              const t = i / 32;
              return {
                x: Math.round(
                  (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
                ),
                y: Math.round(
                  (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
                ),
              };
            }),
          ],
        });
        setAnchors([]);
      } else setAnchors(a);
      return;
    }
    let stroke = -1;
    if (tool === 'move') {
      let best = 25;
      draft.strokes.forEach((s, i) =>
        s.forEach((b, j) => {
          if (j) {
            const d = segmentDistance(p, s[j - 1], b);
            if (d < best) {
              best = d;
              stroke = i;
            }
          }
        }),
      );
      setSelected(stroke);
      if (stroke < 0) return;
    }
    gesture.current = {
      base: structuredClone(draft),
      start: p,
      points: [p],
      pointer: e.pointerId,
      stroke,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    const p = point(e);
    if (tool === 'pencil') {
      if (Math.hypot(p.x - g.points.at(-1)!.x, p.y - g.points.at(-1)!.y) < 3)
        return;
      if (g.points.length >= lineLimits.perStroke) {
        setMessage(
          'Se alcanzó el límite del trazo: soltá para continuar con otro.',
        );
        return;
      }
      g.points.push(p);
      update({ ...g.base, strokes: [...g.base.strokes, [...g.points]] });
    } else if (tool === 'line')
      update({ ...g.base, strokes: [...g.base.strokes, [g.start, p]] });
    else if (tool === 'move') {
      const stroke = g.base.strokes[g.stroke],
        dx = Math.max(
          45 - Math.min(...stroke.map((q) => q.x)),
          Math.min(915 - Math.max(...stroke.map((q) => q.x)), p.x - g.start.x),
        ),
        dy = Math.max(
          75 - Math.min(...stroke.map((q) => q.y)),
          Math.min(485 - Math.max(...stroke.map((q) => q.y)), p.y - g.start.y),
        );
      update({
        ...g.base,
        strokes: g.base.strokes.map((s, i) =>
          i === g.stroke ? s.map((q) => ({ x: q.x + dx, y: q.y + dy })) : s,
        ),
      });
    }
  };
  const finish = (e: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    gesture.current = null;
    if (cancelled) update(g.base);
    else commit(latest.current);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const remove = () => {
    if (selected >= 0) {
      commit({
        ...draft,
        strokes: draft.strokes.filter((_, i) => i !== selected),
      });
      setSelected(-1);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent
        className="pixel-editor-dialog"
        onKeyDown={(e) => {
          if (
            e.key === 'Delete' &&
            !(e.target instanceof HTMLInputElement) &&
            !(e.target instanceof HTMLTextAreaElement)
          ) {
            e.preventDefault();
            remove();
          }
        }}
        overlayClassName="bg-black/35"
      >
        <DialogHeader>
          <DialogTitle>Editar circuito de línea</DialogTitle>
          <DialogDescription>
            El negro que dibujás es exactamente lo que detectan los sensores.
            Curva: tres clics (inicio, control y final). Seleccionar/mover:
            arrastrá un trazo.
          </DialogDescription>
        </DialogHeader>
        <div className="scene-toolbar">
          {Object.entries(linePresetNames).map(([id, name]) => (
            <button
              type="button"
              key={id}
              onClick={() => {
                if (
                  !draft.strokes.length ||
                  window.confirm('¿Reemplazar el trazado? Podés deshacer.')
                ) {
                  commit(linePreset(id as keyof typeof linePresetNames));
                  setAnchors([]);
                  setSelected(-1);
                }
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="scene-toolbar">
          {Object.entries({
            pencil: 'Lápiz',
            line: 'Recta',
            curve: 'Curva',
            move: 'Seleccionar y mover',
          }).map(([id, name]) => (
            <button
              type="button"
              key={id}
              aria-pressed={tool === id}
              onClick={() => {
                setTool(id);
                setAnchors([]);
              }}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              setIndex(index - 1);
              update(history[index - 1]);
              setAnchors([]);
              setSelected(-1);
            }}
          >
            Deshacer trazo
          </button>
          <button
            type="button"
            disabled={index === history.length - 1}
            onClick={() => {
              setIndex(index + 1);
              update(history[index + 1]);
              setAnchors([]);
              setSelected(-1);
            }}
          >
            Rehacer trazo
          </button>
        </div>
        <label>
          Ancho de línea: {draft.width}
          <input
            aria-label="Ancho de línea"
            type="range"
            min="12"
            max="24"
            step="1"
            value={draft.width}
            onChange={(e) =>
              commit({ ...draft, width: Number(e.target.value) })
            }
          />
        </label>
        <svg
          className="line-circuit-canvas"
          viewBox="0 0 960 540"
          aria-label="Lienzo del circuito"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={(e) => finish(e, true)}
        >
          <rect width="960" height="540" fill="#fffdf3" />
          <rect
            x="45"
            y="75"
            width="870"
            height="410"
            fill="none"
            stroke="#a4b3b6"
            strokeDasharray="6 6"
          />
          {draft.strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={i === selected ? '#475cb6' : '#222733'}
              strokeWidth={draft.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {anchors.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="7" fill="#ce6e3f" />
          ))}
        </svg>
        <div className="scene-toolbar">
          <label>
            Trazo seleccionado{' '}
            <select
              aria-label="Trazo seleccionado"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              <option value={-1}>Ninguno</option>
              {draft.strokes.map((_, i) => (
                <option key={i} value={i}>
                  Trazo {i + 1}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={selected < 0} onClick={remove}>
            Borrar trazo
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('¿Borrar todo el circuito? Podés deshacer.')) {
                commit({ ...draft, strokes: [] });
                setSelected(-1);
                setAnchors([]);
              }
            }}
          >
            Borrar todo
          </button>
        </div>
        <output aria-live="polite">
          {message ||
            `${draft.strokes.length}/${lineLimits.strokes} trazos · ${draft.strokes.reduce((n, s) => n + s.length, 0)}/${lineLimits.points} puntos. Una curva pendiente no se guarda hasta el tercer clic.`}
        </output>
        <DialogFooter>
          <button type="button" onClick={cancel}>
            Cancelar circuito
          </button>
          <button
            type="button"
            onClick={() => {
              if (!gesture.current && validLineCircuit(draft)) onSave(draft);
            }}
          >
            Guardar circuito
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
