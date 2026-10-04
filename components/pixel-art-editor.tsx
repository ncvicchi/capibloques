'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { drawPixelShape, pixelIsOn, setPixel, transformPixelRows, type PixelPoint, type PixelTool } from '@/lib/pixel-art';

const tools: readonly [PixelTool, string][] = [
  ['pencil', '✏️ Lápiz'], ['eraser', '🧽 Borrador'], ['line', '╱ Línea'], ['curve', '⌒ Curva'],
  ['rectangle', '▭ Rectángulo'], ['filled-rectangle', '▰ Relleno'], ['ellipse', '◯ Círculo'], ['fill', '🪣 Balde'],
];

export function PixelArtEditor({ open, name, width, height, rows, onCancel, onSave }: {
  open: boolean; name: string; width: number; height: number; rows: readonly number[];
  onCancel: () => void; onSave: (rows: number[]) => void;
}) {
  const initial = useMemo(() => Array.from({ length: height }, (_, y) => rows[y] ?? 0), [height, rows]);
  const [draft, setDraft] = useState(initial);
  const [history, setHistory] = useState<number[][]>([initial]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<PixelTool>('pencil');
  const [pointer, setPointer] = useState<PixelPoint | null>(null);
  const [drawing, setDrawing] = useState(false);
  const start = useRef<PixelPoint | null>(null);
  const gestureBase = useRef<number[]>(initial);
  useEffect(() => { if (open) { setDraft(initial); setHistory([initial]); setHistoryIndex(0); setDrawing(false); start.current = null; } }, [open, initial]);
  const commit = (next: number[]) => {
    if (next.every((row, index) => row === history[historyIndex]?.[index])) { setDraft(next); return; }
    const branch = history.slice(0, historyIndex + 1);
    setHistory([...branch, next].slice(-60)); setHistoryIndex(Math.min(59, branch.length)); setDraft(next);
  };
  const undo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setDraft(history[historyIndex - 1]); } };
  const redo = () => { if (historyIndex + 1 < history.length) { setHistoryIndex(historyIndex + 1); setDraft(history[historyIndex + 1]); } };
  const pointFrom = (target: HTMLElement): PixelPoint => ({ x: Number(target.dataset.x), y: Number(target.dataset.y) });
  const begin = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFrom(event.currentTarget); start.current = point; gestureBase.current = draft; setPointer(point); setDrawing(true);
    if (tool === 'fill') { commit(drawPixelShape(draft, width, tool, point, point)); setDrawing(false); }
    else if (tool === 'pencil' || tool === 'eraser') setDraft(setPixel(draft, width, point, tool === 'pencil'));
  };
  const enter = (event: React.PointerEvent<HTMLButtonElement>) => {
    const point = pointFrom(event.currentTarget); setPointer(point);
    if (!drawing || (tool !== 'pencil' && tool !== 'eraser')) return;
    setDraft(current => setPixel(current, width, point, tool === 'pencil'));
  };
  const end = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drawing || !start.current) return;
    const point = pointFrom(event.currentTarget);
    const next = tool === 'pencil' || tool === 'eraser' ? draft : drawPixelShape(gestureBase.current, width, tool, start.current, point);
    setDrawing(false); start.current = null; commit(next);
  };
  const transform = (action: Parameters<typeof transformPixelRows>[2]) => commit(transformPixelRows(draft, width, action));
  const dirty = draft.some((row, index) => row !== initial[index]);
  return <Dialog open={open} onOpenChange={value => { if (!value && (!dirty || window.confirm('¿Cerrar sin guardar el dibujo?'))) onCancel(); }}>
    <DialogContent className="pixel-editor-dialog">
      <DialogHeader><DialogTitle>Editar {name}</DialogTitle><DialogDescription>{width} × {height} puntos. Las guías no forman parte del dibujo.</DialogDescription></DialogHeader>
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
        <div className="pixel-editor-grid" style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width}/${height}` }} aria-label={`Lienzo de ${name}`} onPointerLeave={() => setPointer(null)}>
          {Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
            const on = pixelIsOn(draft, width, x, y);
            return <button type="button" key={`${x}-${y}`} data-x={x} data-y={y} aria-label={`Columna ${x + 1}, fila ${y + 1}`} aria-pressed={on} className={on ? 'on' : ''} onPointerDown={begin} onPointerEnter={enter} onPointerUp={end} onClick={event => { if (event.detail === 0) commit(setPixel(draft, width, { x, y }, !on)); }} />;
          }))}
        </div>
        <aside><strong>Vista real</strong><div className="pixel-editor-preview" style={{ gridTemplateColumns: `repeat(${width}, 3px)` }}>{Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => <i key={`${x}-${y}`} className={pixelIsOn(draft, width, x, y) ? 'on' : ''} />))}</div><small>{pointer ? `Columna ${pointer.x + 1}, fila ${pointer.y + 1}` : 'Mové el puntero sobre el dibujo'}</small></aside>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="button" onClick={() => onSave(draft)}>Guardar dibujo</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
