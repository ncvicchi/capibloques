'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cable, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WemosBoard, { type WiringConnection } from '@/components/wemos-board';
import S3Board from '@/components/s3-board';
import WiringComponent, { type TrafficWiringMode } from '@/components/wiring-component';
import { boardProfile, type BoardProfileId } from '@/lib/board-profiles';
import { physicalWemosLabel } from '@/lib/wemos-board';
import { physicalS3Label } from '@/lib/s3-board';
import type { SceneDevice } from '@/lib/scene-model';
import { trafficOrientation } from '@/lib/traffic-wiring';

type Step = { kind: 'prepare' | 'ground'; device: SceneDevice } | { kind: 'signal'; row: WiringConnection };

export default function WiringWalkthrough({ connections, devices, profileId, advice, onExit, onHelp }: {
  connections: WiringConnection[];
  devices: SceneDevice[];
  profileId: BoardProfileId;
  advice: Record<SceneDevice['kind'], string>;
  onExit: () => void;
  onHelp: (device: SceneDevice) => void;
}) {
  const [index, setIndex] = useState(0);
  const [trafficModes, setTrafficModes] = useState<Record<string, TrafficWiringMode>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const circuit = useRef<HTMLDivElement>(null);
  const wireId = useId();
  const [wire, setWire] = useState<{ path: string; width: number; height: number } | null>(null);
  // Keep shared bus wires as separate connections: each module needs its cable.
  const steps: Step[] = devices.flatMap(device => {
    const rows = connections.filter(row => row.deviceId === device.id && row.signalKey !== 'common');
    return [
      { kind: 'prepare', device } as Step,
      ...(rows.length ? [{ kind: 'ground', device } as Step] : []),
      ...rows.map(row => ({ kind: 'signal', row }) as Step),
    ];
  });
  steps.push(...connections.filter(row => row.deviceId === 'raw-outputs').map(row => ({ kind: 'signal', row }) as Step));
  const step = steps[index];
  const row = step?.kind === 'signal' ? step.row : undefined;
  const device = row ? devices.find(item => item.id === row.deviceId) : step && step.kind !== 'signal' ? step.device : undefined;
  const trafficMode = device ? trafficModes[device.id] ?? 'module' : 'module';
  const direct = device?.kind === 'trafficLight' && device.pins.common != null && trafficMode === 'module';
  const common = direct ? device.pins.common! : undefined;
  const profile = boardProfile(profileId);
  const physical = row ? (profileId === 'wemos-d1-r32' ? physicalWemosLabel(row.pin) : physicalS3Label(row.pin)) : undefined;
  const located = row?.pin != null && Boolean(physical) && profile.pins.some(pin => pin.gpio === row.pin);
  const boardProps = {
    connections: connections.map(connection => ({ ...connection, simulated: undefined })),
    selectedPin: step?.kind === 'ground' && direct ? common : located ? row?.pin ?? undefined : undefined,
    selectedContact: step?.kind === 'ground' && !direct ? 'GND' as const : undefined,
    onSelect: (pin: number) => {
      const target = steps.findIndex(candidate => candidate.kind === 'signal' && candidate.row.pin === pin && candidate.row.deviceId === device?.id);
      if (target >= 0) setIndex(target);
    },
  };
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index]);
  useEffect(() => {
    const container = circuit.current;
    if (!container || !device || (!located && step?.kind !== 'ground')) { setWire(null); return; }
    const update = () => {
      const from = container.querySelector('.wiring-component-terminal')?.getBoundingClientRect();
      const to = container.querySelector('.wiring-step-board .board-contact.selected > circle')?.getBoundingClientRect();
      if (!from || !to) { setWire(null); return; }
      const bounds = container.getBoundingClientRect();
      const x1 = from.x + from.width / 2 - bounds.x, y1 = from.y + from.height / 2 - bounds.y;
      const x2 = to.x + to.width / 2 - bounds.x, y2 = to.y + to.height / 2 - bounds.y;
      const middle = (x1 + x2) / 2;
      const boardBounds = container.querySelector('.wiring-step-board')!.getBoundingClientRect();
      const cardBounds = container.querySelector('.wiring-step-card')!.getBoundingClientRect();
      const path = boardBounds.top >= cardBounds.bottom
        ? `M${x1} ${y1}H${bounds.width - 4}V${y2}H${x2}`
        : `M${x1} ${y1} C${middle} ${y1},${middle} ${y2},${x2} ${y2}`;
      setWire(current => current?.path === path && current.width === bounds.width && current.height === bounds.height ? current : { path, width: bounds.width, height: bounds.height });
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    container.querySelectorAll('svg').forEach(svg => observer.observe(svg));
    const frame = requestAnimationFrame(update);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [index, device, located, step?.kind, trafficMode]);

  return <section className="wiring-walkthrough" aria-label="Conexiones paso a paso">
    <div className="wiring-step-toolbar">
      <Button variant="outline" onClick={onExit}><ArrowLeft /> Volver a la vista completa</Button>
      <span aria-live="polite">{step ? `Paso ${index + 1} de ${steps.length}` : 'Recorrido terminado'}</span>
    </div>
    <progress aria-label="Progreso de conexiones" max={steps.length || 1} value={Math.min(index + 1, steps.length)} />
    {step ? <div className="wiring-step-content" data-has-board="true" ref={circuit}>
      <div className="wiring-step-card" data-kind={step.kind}>
        <span className="wiring-step-component">{device?.name ?? row?.deviceName}</span>
        <h3 ref={heading} tabIndex={-1}>{step.kind === 'prepare' ? 'Primero, alimentación y materiales' : step.kind === 'ground' ? 'Uní las masas: GND' : row?.signal}</h3>
        {step.kind === 'prepare' && device?.kind === 'trafficLight' && <fieldset className="wiring-traffic-mode">
          <legend>¿Cómo armás este semáforo?</legend>
          <label><input type="radio" name={`traffic-mode-${device.id}`} checked={trafficMode === 'module'} onChange={() => setTrafficModes(current => ({ ...current, [device.id]: 'module' }))} /> Módulo</label>
          <label><input type="radio" name={`traffic-mode-${device.id}`} checked={trafficMode === 'leds'} onChange={() => setTrafficModes(current => ({ ...current, [device.id]: 'leds' }))} /> LED y resistencia en serie</label>
        </fieldset>}
        {device && <WiringComponent device={device} signal={row?.signal} ground={step.kind === 'ground'} connected={located || step.kind === 'ground'} trafficMode={trafficMode} inverted={device.kind === 'trafficLight' && trafficOrientation(device.pins, profileId) === 'inverted'} />}
        {step.kind === 'prepare' && <>
          <p>{step.device.kind === 'trafficLight' ? trafficMode === 'module' ? 'Identificá en el módulo los cuatro pines: GND, R, Y y G. Los vamos a conectar uno por uno.' : 'Prepará tres LED (rojo, amarillo y verde) y una resistencia de 220–330 Ω para cada uno. Cada resistencia va en serie con su LED.' : advice[step.device.kind]}</p>
          {step.device.kind === 'trafficLight' && trafficMode === 'module' && <p>{direct ? `Montaje directo en cuatro contactos consecutivos: GND → GPIO ${common}, R → ${step.device.pins.red}, Y → ${step.device.pins.yellow}, G → ${step.device.pins.green}. La orientación del dibujo coincide con la elegida en Armar escena; allí podés invertirla.` : 'Montaje con cables: R, Y y G van a sus GPIO; GND va a GND real. Se agrupan las señales en el conector cuando es posible.'}</p>}
          <p>{connections.some(connection => connection.deviceId === step.device.id) ? 'Prepará este componente con la placa desconectada. A continuación veremos GND y cada señal, de a una.' : 'Este componente no tiene señales GPIO configurables. No agregues cables a partir de este recorrido.'}</p>
          {step.device.kind !== 'trafficLight' && <p>La alimentación depende del módulo: revisá su ficha. Esta guía no asigna un pin de alimentación automáticamente.</p>}
        </>}
        {step.kind === 'ground' && <>
          <div className="wiring-step-route"><div><small>{step.device.name}</small><strong>GND / negativo común</strong></div><ArrowRight aria-hidden="true" /><div><small>{profile.shortName}</small><strong>{direct ? `GPIO ${common}` : 'GND'}</strong>{direct && <span>Retorno mantenido en LOW</span>}</div></div>
          <p>{direct ? `El GND del módulo coincide con GPIO ${common}. El firmware lo mantiene en LOW como retorno de estas tres luces; no lo uses como masa para otros componentes.` : 'Buscá los contactos GND resaltados. Usá uno para unir la masa del componente o de su driver con la placa. Si usa una fuente externa, su negativo también comparte GND.'}</p>
          {step.device.kind === 'led' && <p>En los LED, el cátodo (−) va a GND y cada luz lleva su propia resistencia de 220–330 Ω en serie.</p>}
          {step.device.kind === 'trafficLight' && <p>{trafficMode === 'module' ? 'En el módulo, usá el pin GND: es el primero de arriba. G es verde; no es GND.' : 'Conectá el cátodo (−) de cada LED a GND. Es la pata corta y está del lado plano del LED. El ánodo (+) es la pata larga.'}</p>}
        </>}
        {row && <>
          <div className="wiring-step-route"><div><small>{row.deviceName}</small><strong>{row.signal}</strong></div><Cable aria-hidden="true" /><div><small>{profile.shortName}</small><strong>{located ? physical : 'Revisar asignación'}</strong>{located && <span>GPIO {row.pin}{row.boardLabel && row.boardLabel !== physical ? ` · ${row.boardLabel}` : ''}</span>}</div></div>
          <p>{located ? `Localizá ${physical} en la placa, marcado con un aro y una flecha. Conectá la señal indicada a GPIO ${row.pin}.` : row.pin == null ? 'Esta señal está sin asignar. Elegí su pin en Armar escena antes de conectar; no hay un cable de destino indicado.' : `GPIO ${row.pin} no está habilitado o no se pudo localizar en esta placa. Revisá su asignación en Armar escena antes de conectar.`}</p>
          {device?.kind === 'led' && <p>GPIO → resistencia de 220–330 Ω → ánodo (+) del LED. El cátodo (−) va a GND.</p>}
          {device?.kind === 'trafficLight' && /LED/.test(row.signal) && <p>{trafficMode === 'module' ? <>Conectá el GPIO al pin {({ 'LED rojo': 'R (rojo)', 'LED amarillo': 'Y (amarillo)', 'LED verde': 'G (verde)' } as Record<string, string>)[row.signal]} resaltado en el módulo.</> : <>GPIO → resistencia de 220–330 Ω → ánodo (+, pata larga) del {row.signal.toLowerCase()}. Cátodo (−, pata corta/lado plano) → GND. Usá una resistencia distinta para cada LED.</>}</p>}
          {device?.kind === 'messages' && <p>Enviar se conecta a Recibir del otro equipo; Recibir se conecta a Enviar. No unas dos salidas Enviar.</p>}
          {!device && <p>Usá el circuito de tu carga (resistencia, transistor o driver). Este bloque sólo define una salida GPIO.</p>}
        </>}
        {device && <Button variant="outline" onClick={() => onHelp(device)}>Ver ayuda de {device.name}</Button>}
      </div>
      <div className="wiring-step-board">{profileId === 'wemos-d1-r32' ? <WemosBoard {...boardProps} /> : <S3Board {...boardProps} />}</div>
      {wire && <svg className="wiring-live-wire" viewBox={`0 0 ${wire.width} ${wire.height}`} aria-hidden="true" data-wire-connected="true">
        <defs><marker id={wireId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#a74300" /></marker></defs>
        <path d={wire.path} fill="none" stroke="white" strokeWidth="8" />
        <path d={wire.path} fill="none" stroke="#a74300" strokeWidth="4" markerEnd={`url(#${wireId})`} />
      </svg>}
    </div> : <div className="wiring-step-card">
      <Check aria-hidden="true" /><h3 ref={heading} tabIndex={-1}>Recorrido terminado</h3>
      <p>Ya viste todos los componentes y sus señales. Si había pines sin asignar, corregilos en Armar escena. Volvé a la vista completa para revisar el listado y completar el chequeo con una persona adulta.</p>
      <Button onClick={onExit}>Volver al listado y al chequeo</Button>
    </div>}
    <nav className="wiring-step-navigation" aria-label="Cambiar paso de conexión">
      <Button variant="outline" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><ArrowLeft /> Atrás</Button>
      {step && <Button onClick={() => setIndex(value => value + 1)}>{index === steps.length - 1 ? 'Terminar recorrido' : 'Siguiente'} <ArrowRight /></Button>}
    </nav>
  </section>;
}
