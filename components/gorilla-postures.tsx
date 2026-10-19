'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import GorillaVisual from '@/components/gorilla-visual';
import {
  gorillaLegNames,
  gorillaValues,
  gorillaMove,
  advanceGorilla,
  validGorillaPostures,
  type GorillaPosture,
  type GorillaSettings,
  type GorillaMove,
} from '@/lib/gorilla-model';

export default function GorillaPostures({
  postures,
  settings,
  onSave,
  onCancel,
}: {
  postures: GorillaPosture[];
  settings: GorillaSettings;
  onSave: (v: GorillaPosture[]) => void;
  onCancel: () => void;
}) {
  const [history, setHistory] = useState<GorillaPosture[][]>([
      structuredClone(postures),
    ]),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState(postures[0]?.id ?? ''),
    [leg, setLeg] = useState(0),
    [seconds, setSeconds] = useState(2);
  const [preview, setPreview] = useState<{
    job: GorillaMove | null;
    playing: boolean;
    angles: number[] | null;
  }>({ job: null, playing: false, angles: null });
  const { job, playing, angles } = preview;
  const draft = history[index],
    pose = draft.find((p) => p.id === selected),
    valid = validGorillaPostures(draft, settings),
    dirty = JSON.stringify(draft) !== JSON.stringify(postures);
  const stop = () => setPreview({ job: null, playing: false, angles: null });
  const commit = (next: GorillaPosture[]) => {
    stop();
    const branch = history.slice(0, index + 1);
    setHistory([...branch, next].slice(-60));
    setIndex(Math.min(59, branch.length));
  };
  const update = (p: GorillaPosture) =>
    commit(draft.map((v) => (v.id === p.id ? p : v)));
  const close = () => {
    if (!dirty || window.confirm('¿Cerrar sin guardar las posturas?'))
      onCancel();
  };
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = now - previous;
      previous = now;
      setPreview((current) => {
        if (!current.job) return current;
        const next = advanceGorilla(current.job, delta);
        return { job: next.move, playing: next.moving, angles: next.angles };
      });
    }, 30);
    return () => clearInterval(timer);
  }, [playing]);
  const add = (copy: boolean) => {
    let n = 1;
    while (draft.some((p) => p.name === `Postura ${n}`)) n++;
    const p = {
      id: crypto.randomUUID(),
      name: `Postura ${n}`,
      angles: copy && pose ? [...pose.angles] : Array(8).fill(0),
    };
    commit([...draft, p]);
    setSelected(p.id);
  };
  const values = {
    ...gorillaValues(),
    ...Object.fromEntries(
      (angles ?? pose?.angles ?? Array(8).fill(0)).map((a, i) => [
        `j${i}`,
        Number.isFinite(a) ? a : 0,
      ]),
    ),
    moving: playing,
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="gorilla-postures-dialog"
        overlayClassName="bg-black/35"
      >
        <DialogHeader>
          <DialogTitle>Posturas de GorillaBot</DialogTitle>
          <DialogDescription>
            Ocho ángulos respecto de los centros calibrados. Vista previa local:
            no mueve la placa ni comprueba equilibrio o choques mecánicos. No
            hay coordenadas del pie hasta medir el robot.
          </DialogDescription>
        </DialogHeader>
        <div
          className="scene-toolbar"
          role="toolbar"
          aria-label="Editar posturas"
        >
          <Button
            type="button"
            variant="outline"
            disabled={index === 0}
            onClick={() => {
              stop();
              setIndex(index - 1);
            }}
          >
            Deshacer postura
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={index + 1 === history.length}
            onClick={() => {
              stop();
              setIndex(index + 1);
            }}
          >
            Rehacer postura
          </Button>
          <Button
            type="button"
            disabled={draft.length >= 16}
            onClick={() => add(false)}
          >
            Nueva postura
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!pose || draft.length >= 16}
            onClick={() => add(true)}
          >
            Duplicar postura
          </Button>
        </div>
        <div className="gorilla-postures-layout">
          <div>
            <label>
              Postura a editar
              <select
                value={pose?.id ?? ''}
                onChange={(e) => {
                  stop();
                  setSelected(e.target.value);
                }}
              >
                {!pose && <option value="">Elegí una postura</option>}
                {draft.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '(Sin nombre)'}
                  </option>
                ))}
              </select>
            </label>
            {pose && (
              <>
                <label>
                  Nombre de la postura
                  <input
                    value={pose.name}
                    maxLength={40}
                    onChange={(e) => update({ ...pose, name: e.target.value })}
                  />
                </label>
                {gorillaLegNames.map((name, l) => (
                  <fieldset key={name}>
                    <legend>{name}</legend>
                    {[0, 1].map((offset) => {
                      const i = l * 2 + offset;
                      return (
                        <label key={i}>
                          Motor {offset ? 'B' : 'A'} · {name}
                          <input
                            aria-label={`Motor ${offset ? 'B' : 'A'} · ${name}`}
                            type="number"
                            min={-20}
                            max={20}
                            step={1}
                            value={
                              Number.isNaN(pose.angles[i]) ? '' : pose.angles[i]
                            }
                            onChange={(e) => {
                              const a = [...pose.angles];
                              a[i] =
                                e.target.value === ''
                                  ? NaN
                                  : Number(e.target.value);
                              update({ ...pose, angles: a });
                            }}
                          />
                          °
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Eliminar esta postura? Los bloques que la usan quedarán señalados para elegir otra.',
                      )
                    ) {
                      commit(draft.filter((p) => p.id !== pose.id));
                      setSelected(
                        draft.find((p) => p.id !== pose.id)?.id ?? '',
                      );
                    }
                  }}
                >
                  Eliminar postura
                </Button>
              </>
            )}
            <small>
              {draft.length}/16 posturas. Nombres únicos, ángulos enteros entre
              −20° y +20° y dentro de los límites calibrados.
            </small>
          </div>
          <div>
            <GorillaVisual
              values={values}
              preview
              selectedLeg={leg}
              onSelectLeg={setLeg}
            />
            <label>
              Duración de prueba (segundos)
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.1}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              />
            </label>
            <div className="scene-toolbar">
              <Button
                type="button"
                disabled={
                  !pose ||
                  !valid ||
                  !Number.isFinite(seconds) ||
                  seconds < 0.2 ||
                  seconds > 10
                }
                onClick={() => {
                  setPreview({
                    angles: Array(8).fill(0),
                    job: gorillaMove(
                      Array(8).fill(0),
                      pose!.angles,
                      seconds * 1000,
                      255,
                    ),
                    playing: true,
                  });
                }}
              >
                Ver desde referencia
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!job || job.elapsed >= job.duration}
                onClick={() =>
                  setPreview((current) => ({
                    ...current,
                    playing: !current.playing,
                  }))
                }
              >
                {playing ? 'Pausar vista previa' : 'Continuar vista previa'}
              </Button>
            </div>
            {job && (
              <p aria-live="polite">
                {Math.round((job.elapsed / job.duration) * 100)}% · duración
                efectiva {(job.duration / 1000).toFixed(2)} s
              </p>
            )}
            <p>
              Los ocho motores comparten el tiempo; se alarga si hace falta para
              respetar 30°/s. En la placa, la primera posición física no se
              conoce: sostené el robot y revisá el montaje.
            </p>
          </div>
        </div>
        {!valid && (
          <p role="alert">
            No se puede guardar: revisá nombres únicos, ocho ángulos enteros y
            límites de calibración. No recortamos ángulos automáticamente.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancelar posturas
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => onSave(structuredClone(draft))}
          >
            Guardar posturas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
