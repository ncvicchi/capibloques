'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PixelArtEditor } from '@/components/pixel-art-editor';
import { pixelIsOn } from '@/lib/pixel-art';
import { MAX_ANIMATION_FRAMES, MAX_FRAME_ANIMATIONS, validFrameAnimations, type FrameAnimation } from '@/lib/frame-animation';

type Props = { width: number; animations: FrameAnimation[]; drawings: { name: string; rows: number[] }[]; onChange: (items: FrameAnimation[]) => void };
function Pixels({ rows, width }: { rows: number[]; width: number }) {
  return <span className="animation-pixels" style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width}/8` }}>{Array.from({ length: width * 8 }, (_, i) => <i key={i} className={pixelIsOn(rows, width, i % width, Math.floor(i / width)) ? 'on' : ''} />)}</span>;
}
export function FrameAnimationEditor(props: Props) {
  const [editing, setEditing] = useState<FrameAnimation | null>(null);
  const blank = () => Array(8).fill(0) as number[];
  return <fieldset><legend>Animaciones por cuadros</legend>
    <p>Creá hasta {MAX_FRAME_ANIMATIONS} animaciones de {MAX_ANIMATION_FRAMES} cuadros. Después elegilas en el bloque «Mostrar animación».</p>
    {props.animations.map(item => <div key={item.id} className="animation-list-item"><Pixels width={props.width} rows={item.frames[0]} /><span>{item.name} · {item.frames.length} cuadros · {item.frameMs} ms</span><Button type="button" variant="outline" onClick={() => setEditing(item)}>Editar {item.name}</Button><Button type="button" variant="ghost" onClick={() => { if (window.confirm(`¿Quitar ${item.name}? Los bloques que la usan necesitarán otra animación.`)) props.onChange(props.animations.filter(value => value.id !== item.id)); }}>Quitar {item.name}</Button></div>)}
    <Button type="button" disabled={props.animations.length >= MAX_FRAME_ANIMATIONS} onClick={() => {
      let number = 1; while (props.animations.some(item => item.name === `Animación ${number}`)) number++;
      setEditing({ id: `anim-${crypto.randomUUID().slice(0, 24)}`, name: `Animación ${number}`, frameMs: 200, frames: [blank()] });
    }}>Nueva animación</Button>
    {editing && <AnimationDraft key={editing.id} {...props} initial={editing} onClose={() => setEditing(null)} onSave={item => { props.onChange([...props.animations.filter(value => value.id !== item.id), item]); setEditing(null); }} />}
  </fieldset>;
}
function AnimationDraft({ width, drawings, animations, initial, onClose, onSave }: Props & { initial: FrameAnimation; onClose: () => void; onSave: (item: FrameAnimation) => void }) {
  const [draft, setDraft] = useState<FrameAnimation>(() => structuredClone(initial));
  const [selected, setSelected] = useState(0), [editingPixels, setEditingPixels] = useState(false);
  const [playing, setPlaying] = useState(false), [preview, setPreview] = useState(0);
  const [error, setError] = useState(''), [importing, setImporting] = useState(false);
  const [source, setSource] = useState('0');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPreview(value => (value + 1) % draft.frames.length), Math.max(40, Math.min(2000, draft.frameMs || 200)));
    return () => window.clearInterval(timer);
  }, [playing, draft.frames.length, draft.frameMs]);
  const replaceFrames = (frames: number[][], index: number) => { setPlaying(false); setDraft(value => ({ ...value, frames })); setSelected(index); };
  const move = (direction: number) => {
    const next = selected + direction; if (next < 0 || next >= draft.frames.length) return;
    const frames = [...draft.frames]; [frames[selected], frames[next]] = [frames[next], frames[selected]]; replaceFrames(frames, next);
  };
  const close = () => { if (!importing && (!dirty || window.confirm('¿Cerrar sin guardar la animación?'))) onClose(); };
  const importImages = async (files: File[]) => {
    if (!files.length) return;
    if (draft.frames.length + files.length > MAX_ANIMATION_FRAMES) { setError(`Podés tener hasta ${MAX_ANIMATION_FRAMES} cuadros. Quitá algunos antes de importar.`); return; }
    setImporting(true); setError('');
    try {
      const frames: number[][] = [];
      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Usá imágenes PNG, JPG o WebP de hasta 10 MB.');
        const bitmap = await createImageBitmap(file);
        try {
          if (bitmap.width > 4096 || bitmap.height > 4096) throw new Error('La imagen no puede superar 4096 × 4096 píxeles.');
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 8;
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No pudimos convertir la imagen.');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, 8); ctx.imageSmoothingEnabled = false;
          const scale = Math.min(width / bitmap.width, 8 / bitmap.height), w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
          ctx.drawImage(bitmap, Math.floor((width - w) / 2), Math.floor((8 - h) / 2), w, h);
          const pixels = ctx.getImageData(0, 0, width, 8).data, rows = Array(8).fill(0) as number[];
          for (let y = 0; y < 8; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; if (pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114 < 128) rows[y] += 2 ** (width - x - 1); }
          frames.push(rows);
        } finally { bitmap.close(); }
      }
      replaceFrames([...draft.frames, ...frames], draft.frames.length);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos abrir esas imágenes.'); }
    finally { setImporting(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="pixel-editor-dialog">
    <DialogHeader><DialogTitle>Animación por cuadros</DialogTitle><DialogDescription>{width} × 8 puntos. Los píxeles oscuros de una imagen se encienden; el blanco y lo transparente se apagan. Revisá la conversión antes de guardar.</DialogDescription></DialogHeader>
    <fieldset disabled={importing}>
    <label>Nombre de animación<input aria-label="Nombre de animación" value={draft.name} maxLength={30} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} /></label>
    <label>Tiempo de cada cuadro (ms)<input aria-label="Tiempo de cada cuadro (ms)" type="number" min={40} max={2000} step={10} value={draft.frameMs} onChange={event => setDraft(value => ({ ...value, frameMs: Number(event.target.value) }))} /></label>
    <div className="animation-frames" aria-label="Cuadros de la animación">{draft.frames.map((rows, index) => <button type="button" key={index} aria-label={`Cuadro ${index + 1}`} aria-pressed={selected === index} onClick={() => { setSelected(index); setPlaying(false); }}><Pixels rows={rows} width={width} /><span>{index + 1}</span></button>)}</div>
    <div className="pixel-editor-actions">
      <Button type="button" onClick={() => setEditingPixels(true)}>Dibujar cuadro {selected + 1}</Button>
      <Button type="button" disabled={draft.frames.length >= MAX_ANIMATION_FRAMES} onClick={() => replaceFrames([...draft.frames, Array(8).fill(0)], draft.frames.length)}>Agregar cuadro vacío</Button>
      <Button type="button" disabled={draft.frames.length >= MAX_ANIMATION_FRAMES} onClick={() => { const frames = [...draft.frames]; frames.splice(selected + 1, 0, [...frames[selected]]); replaceFrames(frames, selected + 1); }}>Duplicar cuadro</Button>
      <Button type="button" disabled={selected === 0} onClick={() => move(-1)}>Mover cuadro antes</Button><Button type="button" disabled={selected === draft.frames.length - 1} onClick={() => move(1)}>Mover cuadro después</Button>
      <Button type="button" disabled={draft.frames.length === 1} onClick={() => replaceFrames(draft.frames.filter((_, index) => index !== selected), Math.min(selected, draft.frames.length - 2))}>Quitar cuadro</Button>
      {drawings.length > 0 && <><select aria-label="Dibujo para agregar" value={source} onChange={event => setSource(event.target.value)}>{drawings.map((item, i) => <option key={i} value={i}>{item.name}</option>)}</select><Button type="button" disabled={draft.frames.length >= MAX_ANIMATION_FRAMES} onClick={() => replaceFrames([...draft.frames, [...drawings[Number(source)].rows]], draft.frames.length)}>Agregar dibujo guardado</Button></>}
      <label>Importar imágenes<input aria-label="Importar cuadros desde imágenes" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={importing} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void importImages(files); }} /></label>
    </div>
    <div className="animation-preview"><Pixels width={width} rows={draft.frames[playing ? preview % draft.frames.length : selected]} /><Button type="button" disabled={!Number.isInteger(draft.frameMs) || draft.frameMs < 40 || draft.frameMs > 2000} onClick={() => { setPreview(0); setPlaying(value => !value); }}>{playing ? 'Pausar vista previa' : 'Reproducir vista previa'}</Button><span>{draft.frames.length}/{MAX_ANIMATION_FRAMES} cuadros · {(draft.frames.length * draft.frameMs / 1000).toFixed(2)} s por vuelta</span></div>
    {error && <p role="alert">{error}</p>}
    </fieldset>
    <DialogFooter><Button type="button" variant="outline" disabled={importing} onClick={close}>Cancelar</Button><Button type="button" disabled={importing} onClick={() => { const item = { ...draft, name: draft.name.trim() }; if (!validFrameAnimations([...animations.filter(value => value.id !== item.id), item], width)) { setError('Elegí un nombre único, de hasta 30 letras, y un tiempo entero entre 40 y 2000 ms.'); return; } onSave(item); }}>Guardar animación</Button></DialogFooter>
    <PixelArtEditor open={editingPixels} name={`cuadro ${selected + 1}`} width={width} height={8} rows={draft.frames[selected]} onCancel={() => setEditingPixels(false)} onSave={rows => { replaceFrames(draft.frames.map((value, index) => index === selected ? rows : value), selected); setEditingPixels(false); }} />
  </DialogContent></Dialog>;
}
