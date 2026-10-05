'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { drawPixelShape, pixelIsOn, setPixel, transformPixelRows, type PixelPoint, type PixelTool } from '@/lib/pixel-art';

const tools: readonly [PixelTool, string][] = [
  ['pencil', '✏️ Lápiz'], ['eraser', '🧽 Borrador'], ['line', '╱ Línea'], ['curve', '⌒ Curva'],
  ['rectangle', '▭ Rectángulo'], ['filled-rectangle', '▰ Relleno'], ['ellipse', '◯ Círculo'], ['fill', '🪣 Balde'],
];

type PixelArtEditorProps = {
  open: boolean; name: string; width: number; height: number; rows: readonly number[];
  onCancel: () => void; onSave: (rows: number[]) => void;
};

export function PixelArtEditor(props: PixelArtEditorProps) {
  return props.open ? <PixelArtEditorDraft {...props} /> : null;
}

function PixelArtEditorDraft({ open, name, width, height, rows, onCancel, onSave }: PixelArtEditorProps) {
  const initial = useMemo(() => Array.from({ length: height }, (_, y) => rows[y] ?? 0), [height, rows]);
  const [draft, setDraft] = useState(initial);
  const [history, setHistory] = useState<number[][]>([initial]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<PixelTool>('pencil');
  const [pointer, setPointer] = useState<PixelPoint | null>(null);
  const draftRef = useRef<number[]>(initial);
  const activePointer = useRef<number | null>(null);
  const start = useRef<PixelPoint | null>(null);
  const last = useRef<PixelPoint | null>(null);
  const gestureBase = useRef<number[]>(initial);
  const updateDraft = (next: number[]) => { draftRef.current = next; setDraft(next); };
  const commit = (next: number[]) => {
    if (next.every((row, index) => row === history[historyIndex]?.[index])) { updateDraft(next); return; }
    const branch = history.slice(0, historyIndex + 1);
    setHistory([...branch, next].slice(-60)); setHistoryIndex(Math.min(59, branch.length)); updateDraft(next);
  };
  const undo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); updateDraft(history[historyIndex - 1]); } };
  const redo = () => { if (historyIndex + 1 < history.length) { setHistoryIndex(historyIndex + 1); updateDraft(history[historyIndex + 1]); } };
  const pointFrom = (event: React.PointerEvent<HTMLDivElement>): PixelPoint => {
    const grid = event.currentTarget, bounds = grid.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width - 1, Math.floor((event.clientX - bounds.left - grid.clientLeft) * width / grid.clientWidth))),
      y: Math.max(0, Math.min(height - 1, Math.floor((event.clientY - bounds.top - grid.clientTop) * height / grid.clientHeight))),
    };
  };
  const begin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || activePointer.current !== null) return;
    const point = pointFrom(event); setPointer(point);
    if (tool === 'fill') { commit(drawPixelShape(draftRef.current, width, tool, point, point)); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId; start.current = point; last.current = point; gestureBase.current = draftRef.current;
    updateDraft(drawPixelShape(gestureBase.current, width, tool, point, point));
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointFrom(event); setPointer(point);
    if (activePointer.current !== event.pointerId || !start.current) return;
    const freehand = tool === 'pencil' || tool === 'eraser';
    updateDraft(drawPixelShape(freehand ? draftRef.current : gestureBase.current, width, tool, freehand ? last.current! : start.current, point));
    last.current = point;
  };
  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId || !start.current) return;
    move(event);
    activePointer.current = null; start.current = null; last.current = null;
    commit(draftRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cancelGesture = () => {
    if (activePointer.current === null) return;
    activePointer.current = null; start.current = null; last.current = null;
    updateDraft(gestureBase.current);
  };
  const transform = (action: Parameters<typeof transformPixelRows>[2]) => commit(transformPixelRows(draft, width, action));
  const dirty = draft.some((row, index) => row !== initial[index]);
  return <Dialog open={open} onOpenChange={value => { if (!value && (!dirty || window.confirm('¿Cerrar sin guardar el dibujo?'))) onCancel(); }}>
    <DialogContent className="pixel-editor-dialog">
      <DialogHeader><DialogTitle>Editar {name}</DialogTitle><DialogDescription>{width} × {height} puntos. Arrastrá para dibujar; verás la forma antes de soltar. El balde rellena con un clic. Las guías no forman parte del dibujo.</DialogDescription></DialogHeader>
      <div className="pixel-editor-tools" role="toolbar" aria-label="Herramientas de dibujo">
        {tools.map(([id, label]) => <Button key={id} type="button" variant={tool === id ? 'default' : 'outline'} aria-pressed={tool === id} onClick={() => setTool(id)}>{label}</Button>)}
      </div>
      <div className="pixel-editor-actions" role="toolbar" aria-label="Editar dibujo">
        <Button type="button" variant="outline" disabled={historyIndex === 0} onClick={undo}>↶ Deshacer</Button>
        <Button type="button" variant="outline" disabled={historyIndex + 1 >= history.length} onClick={redo}>↷ Rehacer</Button>
        <Button type="button" variant="outline" onClick={() => transform('left')}>←</Button><Button type="button" variant="outline" onClick={() => transform('right')}>→</Button>
        <Button type="button" variant="outline" onClick={() => transform('up')}>↑</Button><Button type="button" variant="outline" onClick={() => transform('down')}>↓</Button>
        <Button type="button" variant="outline" onClick={() => transform('flip-horizontal')}>↔ Voltear</Button><Button type="button" variant="outline" onClick={() => transform('flip-vertical')}>↕ Voltear</Button>
        <Button type="button" variant="outline" onClick={() => transform('invert')}>◐ Invertir</Button>
        <Button type="button" variant="ghost" onClick={() => commit(Array.from({ length: height }, () => 0))}>Borrar todo</Button>
      </div>
      <div className="pixel-editor-body">
        <div className="pixel-editor-grid" style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width}/${height}` }} aria-label={`Lienzo de ${name}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture} onPointerLeave={() => { if (activePointer.current === null) setPointer(null); }}>
          {Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
            const on = pixelIsOn(draft, width, x, y);
            return <button type="button" key={`${x}-${y}`} data-x={x} data-y={y} aria-label={`Columna ${x + 1}, fila ${y + 1}`} aria-pressed={on} className={on ? 'on' : ''} onClick={event => { if (event.detail === 0) commit(setPixel(draft, width, { x, y }, !on)); }} />;
          }))}
        </div>
        <aside><strong>Vista real</strong><div className="pixel-editor-preview" style={{ gridTemplateColumns: `repeat(${width}, 3px)` }}>{Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => <i key={`${x}-${y}`} className={pixelIsOn(draft, width, x, y) ? 'on' : ''} />))}</div><small>{pointer ? `Columna ${pointer.x + 1}, fila ${pointer.y + 1}` : 'Mové el puntero sobre el dibujo'}</small></aside>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="button" onClick={() => onSave(draft)}>Guardar dibujo</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
