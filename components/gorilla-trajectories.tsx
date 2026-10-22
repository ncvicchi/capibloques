'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import { gorillaLegNames, type GorillaSettings } from '@/lib/gorilla-model';
import {
  defaultGorillaKinematics,
  validGorillaKinematics,
  validGorillaTrajectories,
  gorillaPathPreset,
  gorillaForward,
  gorillaInverse,
  planGorillaPath,
  advanceGorillaPath,
  type GorillaKinematics,
  type GorillaTrajectory,
  type GorillaCartesianMove,
} from '@/lib/gorilla-kinematics';
function pathFrame(points: { forward: number; up: number }[]) {
  let xmin = -16,
    xmax = 16,
    ymin = -4,
    ymax = 12;
  for (const p of points) {
    if (Number.isFinite(p.forward)) {
      xmin = Math.min(xmin, p.forward);
      xmax = Math.max(xmax, p.forward);
    }
    if (Number.isFinite(p.up)) {
      ymin = Math.min(ymin, p.up);
      ymax = Math.max(ymax, p.up);
    }
  }
  xmin -= 2;
  xmax += 2;
  ymin -= 2;
  ymax += 2;
  return {
    xmin,
    ymin,
    scale: Math.min(430 / (xmax - xmin), 260 / (ymax - ymin)),
  };
}
type Draft = {
  kinematics: GorillaKinematics;
  trajectories: GorillaTrajectory[];
};
export default function GorillaTrajectories({
  settings,
  kinematics,
  trajectories,
  onSave,
  onCancel,
}: {
  settings: GorillaSettings;
  kinematics?: GorillaKinematics;
  trajectories?: GorillaTrajectory[];
  onSave: (k: GorillaKinematics, t: GorillaTrajectory[]) => void;
  onCancel: () => void;
}) {
  const initial: Draft = {
    kinematics: kinematics ?? defaultGorillaKinematics(),
    trajectories: trajectories ?? [],
  };
  const [history, setHistory] = useState<Draft[]>([structuredClone(initial)]),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState(trajectories?.[0]?.id ?? ''),
    [kind, setKind] = useState<'lift' | 'rectangle' | 'arc'>('lift'),
    [live, setLive] = useState<Draft | null>(null),
    [drag, setDrag] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    job: GorillaCartesianMove | null;
    playing: boolean;
    foot: { forward: number; up: number } | null;
  }>({ job: null, playing: false, foot: null });
  const draft = live ?? history[index],
    k = draft.kinematics,
    path = draft.trajectories.find((p) => p.id === selected),
    valid = useMemo(
      () =>
        validGorillaKinematics(k) &&
        validGorillaTrajectories(draft.trajectories, k, settings),
      [draft, k, settings],
    ),
    dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const stop = () => setPreview({ job: null, playing: false, foot: null });
  const commit = (next: Draft) => {
    stop();
    const branch = history.slice(0, index + 1);
    setHistory([...branch, next].slice(-60));
    setIndex(Math.min(59, branch.length));
  };
  const changePath = (next: GorillaTrajectory) =>
    commit({
      ...draft,
      trajectories: draft.trajectories.map((p) =>
        p.id === next.id ? next : p,
      ),
    });
  const changeK = (next: GorillaKinematics) =>
    commit({ ...draft, kinematics: { ...next, verified: false } });
  const plan = useMemo(
    () =>
      path
        ? planGorillaPath(k, settings, path.leg, path.points, Array(8).fill(0))
        : undefined,
    [path, k, settings],
  );
  const close = () => {
    if (
      !dirty ||
      window.confirm('¿Cerrar sin guardar geometría y trayectorias?')
    )
      onCancel();
  };
  const playing = preview.playing;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = now - last;
      last = now;
      setPreview((current) => {
        if (!current.job) return current;
        const next = advanceGorillaPath(current.job, delta),
          home = gorillaForward(current.job.k, current.job.leg, 0, 0)!.foot;
        return {
          job: next.move,
          playing: next.moving,
          foot: { forward: next.foot.x - home.x, up: home.y - next.foot.y },
        };
      });
    }, 30);
    return () => clearInterval(timer);
  }, [playing]);
  const home = gorillaForward(k, path?.leg ?? 0, 0, 0);
  const reachable = useMemo(() => {
    const h = gorillaForward(k, path?.leg ?? 0, 0, 0);
    if (!h) return [];
    return Array.from({ length: 21 }, (_, i) => i * 2 - 20).flatMap((x) =>
      Array.from({ length: 12 }, (_, i) => i * 2 - 4)
        .filter((up) =>
          gorillaInverse(k, settings, path?.leg ?? 0, {
            x: h.foot.x + x,
            y: h.foot.y - up,
          }),
        )
        .map((up) => ({ forward: x, up })),
    );
  }, [k, path?.leg, settings]);
  const points = path?.points ?? [],
    { xmin, ymin, scale } = pathFrame([...points, ...reachable]);
  const xy = (p: { forward: number; up: number }) => ({
    x: 15 + (p.forward - xmin) * scale,
    y: 280 - (p.up - ymin) * scale,
  });
  const zero = xy({ forward: 0, up: 0 });
  const add = () => {
    let n = 1;
    while (draft.trajectories.some((p) => p.name === 'Recorrido ' + n)) n++;
    const p = {
      id: crypto.randomUUID(),
      name: 'Recorrido ' + n,
      leg: 0,
      points: gorillaPathPreset(kind),
    };
    commit({ ...draft, trajectories: [...draft.trajectories, p] });
    setSelected(p.id);
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent
        className="gorilla-postures-dialog"
        overlayClassName="bg-black/35"
      >
        <DialogHeader>
          <DialogTitle>Trayectorias de una pata</DialogTitle>
          <DialogDescription>
            GorillaBot MG90S v3 · 50/100/46 mm entre ejes. Adelante y arriba
            respecto del pie en referencia. Plano del eje del pie, no punto de
            contacto con el suelo. Sin marcha, equilibrio ni garantía de
            colisiones mecánicas.
          </DialogDescription>
        </DialogHeader>
        <div
          className="scene-toolbar"
          role="toolbar"
          aria-label="Editar trayectorias"
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
            Deshacer recorrido
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={index + 1 >= history.length}
            onClick={() => {
              stop();
              setIndex(index + 1);
            }}
          >
            Rehacer recorrido
          </Button>
          <select
            aria-label="Tipo de recorrido inicial"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="lift">Levantar y apoyar</option>
            <option value="rectangle">Paso rectangular</option>
            <option value="arc">Arco por puntos</option>
          </select>
          <Button
            type="button"
            disabled={draft.trajectories.length >= 8}
            onClick={add}
          >
            Nueva trayectoria
          </Button>
        </div>
        <div className="gorilla-postures-layout">
          <div>
            <details>
              <summary>Montaje y calibración geométrica</summary>
              <p>
                A es el motor delantero conectado a CALF EXT; B es el trasero,
                CALF INT. Cero geométrico: muslo hacia adelante = 0°, hacia
                abajo = 90°. Aumentar un ángulo lógico gira hacia atrás desde
                abajo. Usá inversión del servo para los montajes espejados. No
                cambiamos automáticamente canales ni pulsos anteriores.
              </p>
              <label>
                Pulso para 0° (µs)
                <input
                  type="number"
                  min={500}
                  max={1200}
                  value={k.pulseMinUs}
                  onChange={(e) =>
                    changeK({ ...k, pulseMinUs: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Pulso para 180° (µs)
                <input
                  type="number"
                  min={1800}
                  max={2500}
                  value={k.pulseMaxUs}
                  onChange={(e) =>
                    changeK({ ...k, pulseMaxUs: Number(e.target.value) })
                  }
                />
              </label>
              <p>
                1000–2000 conserva la escala anterior; el código original usa
                544–2400. No copies su escala sin comprobar tu servo. Cambiar
                pulsos afecta todos los movimientos.
              </p>
              {gorillaLegNames.map((name, l) => (
                <fieldset key={name}>
                  <legend>{name} · orientación al ángulo lógico 0</legend>
                  {[0, 1].map((j) => (
                    <label key={j}>
                      Motor {j ? 'B' : 'A'}
                      <input
                        aria-label={`Orientación ${name} ${j ? 'B' : 'A'}`}
                        type="number"
                        min={45}
                        max={135}
                        value={k.zeroAngles[2 * l + j]}
                        onChange={(e) => {
                          const a = [...k.zeroAngles];
                          a[2 * l + j] = Number(e.target.value);
                          changeK({ ...k, zeroAngles: a });
                        }}
                      />
                      °
                    </label>
                  ))}
                </fieldset>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={k.verified}
                  disabled={!valid}
                  onChange={(e) =>
                    commit({
                      ...draft,
                      kinematics: { ...k, verified: e.target.checked },
                    })
                  }
                />
                Una persona adulta verificó referencia, sentidos, canales y
                escala de pulsos en este montaje sostenido
              </label>
            </details>
            <label>
              Trayectoria a editar
              <select
                value={path?.id ?? ''}
                onChange={(e) => {
                  stop();
                  setSelected(e.target.value);
                }}
              >
                {!path && <option value="">Elegí o creá un recorrido</option>}
                {draft.trajectories.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '(Sin nombre)'}
                  </option>
                ))}
              </select>
            </label>
            {path && (
              <>
                <label>
                  Nombre del recorrido
                  <input
                    maxLength={40}
                    value={path.name}
                    onChange={(e) =>
                      changePath({ ...path, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Pata del recorrido
                  <select
                    value={path.leg}
                    onChange={(e) =>
                      changePath({ ...path, leg: Number(e.target.value) })
                    }
                  >
                    {gorillaLegNames.map((n, i) => (
                      <option key={n} value={i}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  El tiempo de cada fila corresponde al tramo que llega a ese
                  punto. La entrada también se comprueba al ejecutar. Arrastrá
                  los puntos en el plano o editá sus números.
                </p>
                {points.map((p, i) => (
                  <fieldset key={i}>
                    <legend>Punto {i + 1}</legend>
                    {(['forward', 'up', 'ms'] as const).map((key) => (
                      <label key={key}>
                        {key === 'forward'
                          ? 'Adelante (mm)'
                          : key === 'up'
                            ? 'Arriba (mm)'
                            : 'Tiempo (ms)'}
                        <input
                          aria-label={`Punto ${i + 1} ${key}`}
                          type="number"
                          step={key === 'ms' ? 100 : 0.1}
                          min={key === 'ms' ? 200 : key === 'up' ? -30 : -50}
                          max={key === 'ms' ? 10000 : key === 'up' ? 30 : 50}
                          value={Number.isNaN(p[key]) ? '' : p[key]}
                          onChange={(e) =>
                            changePath({
                              ...path,
                              points: points.map((v, n) =>
                                n === i
                                  ? {
                                      ...v,
                                      [key]:
                                        e.target.value === ''
                                          ? NaN
                                          : Number(e.target.value),
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    <div className="scene-toolbar">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={i === 0}
                        onClick={() => {
                          const a = [...points];
                          [a[i - 1], a[i]] = [a[i], a[i - 1]];
                          changePath({ ...path, points: a });
                        }}
                      >
                        Subir punto {i + 1}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={i === points.length - 1}
                        onClick={() => {
                          const a = [...points];
                          [a[i + 1], a[i]] = [a[i], a[i + 1]];
                          changePath({ ...path, points: a });
                        }}
                      >
                        Bajar punto {i + 1}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={points.length === 1}
                        onClick={() =>
                          changePath({
                            ...path,
                            points: points.filter((_, n) => n !== i),
                          })
                        }
                      >
                        Eliminar punto {i + 1}
                      </Button>
                    </div>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  disabled={points.length >= 16}
                  onClick={() =>
                    changePath({
                      ...path,
                      points: [
                        ...points,
                        {
                          ...(points.at(-1) ?? { forward: 0, up: 0, ms: 1000 }),
                        },
                      ],
                    })
                  }
                >
                  Agregar punto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Eliminar trayectoria? Los bloques que la usan necesitarán elegir otra.',
                      )
                    ) {
                      commit({
                        ...draft,
                        trajectories: draft.trajectories.filter(
                          (p) => p.id !== path.id,
                        ),
                      });
                      setSelected('');
                    }
                  }}
                >
                  Eliminar trayectoria
                </Button>
              </>
            )}
          </div>
          <div>
            <svg
              viewBox="0 0 460 300"
              className="gorilla-path-plane"
              aria-label="Plano del recorrido: adelante horizontal, arriba vertical"
              style={{ width: '100%', touchAction: 'none' }}
              onPointerMove={(e) => {
                if (drag === null || !path) return;
                const r = e.currentTarget.getBoundingClientRect(),
                  x = ((e.clientX - r.left) * 460) / r.width,
                  y = ((e.clientY - r.top) * 300) / r.height;
                const forward = Math.round(((x - 15) / scale + xmin) * 10) / 10,
                  up = Math.round(((280 - y) / scale + ymin) * 10) / 10;
                setLive({
                  ...draft,
                  trajectories: draft.trajectories.map((t) =>
                    t.id === path.id
                      ? {
                          ...t,
                          points: t.points.map((p, i) =>
                            i === drag ? { ...p, forward, up } : p,
                          ),
                        }
                      : t,
                  ),
                });
              }}
              onPointerUp={(e) => {
                if (drag !== null) {
                  if (live) commit(live);
                  setLive(null);
                  setDrag(null);
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              onPointerCancel={() => {
                setLive(null);
                setDrag(null);
              }}
              onLostPointerCapture={() => {
                setLive(null);
                setDrag(null);
              }}
            >
              <rect width="460" height="300" rx="10" fill="#f0f9f6" />
              <path d={`M0 ${zero.y}H460 M${zero.x} 0V300`} stroke="#668c94" />
              {reachable.map((p, i) => (
                <circle
                  key={i}
                  {...{ cx: xy(p).x, cy: xy(p).y }}
                  r="2"
                  fill="#77bb9d"
                />
              ))}
              <polyline
                points={points
                  .filter(
                    (p) => Number.isFinite(p.forward) && Number.isFinite(p.up),
                  )
                  .map((p) => `${xy(p).x},${xy(p).y}`)
                  .join(' ')}
                fill="none"
                stroke={plan?.error ? '#c6364e' : '#684add'}
                strokeWidth="3"
              />
              {points.map(
                (p, i) =>
                  Number.isFinite(p.forward) &&
                  Number.isFinite(p.up) && (
                    <g
                      key={i}
                      onPointerDown={(e) => {
                        stop();
                        setDrag(i);
                        setLive(structuredClone(draft));
                        e.currentTarget.ownerSVGElement?.setPointerCapture(
                          e.pointerId,
                        );
                      }}
                      style={{ cursor: 'grab' }}
                    >
                      <circle cx={xy(p).x} cy={xy(p).y} r="9" fill="#684add" />
                      <text
                        x={xy(p).x}
                        y={xy(p).y + 4}
                        fontSize="11"
                        textAnchor="middle"
                        fill="white"
                      >
                        {i + 1}
                      </text>
                    </g>
                  ),
              )}
              {preview.foot && (
                <circle
                  cx={xy(preview.foot).x}
                  cy={xy(preview.foot).y}
                  r="6"
                  fill="#eb963e"
                  stroke="#54300d"
                />
              )}
              <text x="290" y="294" fontSize="12">
                Adelante → (mm)
              </text>
              <text x="8" y="16" fontSize="12">
                Arriba ↑ (mm)
              </text>
            </svg>
            <p>
              Verde: muestras alcanzables desde referencia, no toda la zona
              continua. Naranja: pie en vista previa. La validación revisa
              además los tramos y sus límites.
            </p>
            {plan?.error && <p role="alert">{plan.error}</p>}
            {!home && (
              <p role="alert">La referencia geométrica elegida no es válida.</p>
            )}
            <div className="scene-toolbar">
              <Button
                type="button"
                disabled={!plan?.move}
                onClick={() => {
                  if (plan?.move)
                    setPreview({
                      job: plan.move,
                      playing: true,
                      foot: { forward: 0, up: 0 },
                    });
                }}
              >
                Probar recorrido
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !preview.job || preview.job.elapsed >= preview.job.duration
                }
                onClick={() =>
                  setPreview((p) => ({ ...p, playing: !p.playing }))
                }
              >
                {playing ? 'Pausar recorrido' : 'Continuar recorrido'}
              </Button>
            </div>
            {preview.job && (
              <p aria-live="polite">
                {Math.round((preview.job.elapsed / preview.job.duration) * 100)}
                % · {(preview.job.duration / 1000).toFixed(2)} s efectivos
              </p>
            )}
            <p>
              Vista previa sin USB. Los arcos son polilíneas editables; los
              tramos son rectos en coordenadas del pie. El tiempo se amplía para
              respetar 30°/s. La salida física está cuantizada por el PCA9685:
              no es una medición del pie.
            </p>
          </div>
        </div>
        {!valid && (
          <p role="alert">
            No se puede guardar: revisá geometría, nombres únicos, puntos y
            tramos. No recortamos un objetivo imposible.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancelar trayectorias
          </Button>
          <Button
            type="button"
            disabled={!valid || drag !== null}
            onClick={() => onSave(k, draft.trajectories)}
          >
            Guardar trayectorias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
