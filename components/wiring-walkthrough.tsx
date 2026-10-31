'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cable, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WemosBoard, { type WiringConnection } from '@/components/wemos-board';
import S3Board from '@/components/s3-board';
import { boardProfile, type BoardProfileId } from '@/lib/board-profiles';
import { physicalWemosLabel } from '@/lib/wemos-board';
import { physicalS3Label } from '@/lib/s3-board';
import type { SceneDevice } from '@/lib/scene-model';

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
  const heading = useRef<HTMLHeadingElement>(null);
  // Keep shared bus wires as separate connections: each module needs its cable.
  const steps: Step[] = devices.flatMap(device => {
    const rows = connections.filter(row => row.deviceId === device.id);
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
  const profile = boardProfile(profileId);
  const physical = row ? (profileId === 'wemos-d1-r32' ? physicalWemosLabel(row.pin) : physicalS3Label(row.pin)) : undefined;
  const located = row?.pin != null && Boolean(physical) && profile.pins.some(pin => pin.gpio === row.pin);
  const boardProps = {
    connections: connections.map(connection => ({ ...connection, simulated: undefined })),
    selectedPin: located ? row?.pin ?? undefined : undefined,
    selectedContact: step?.kind === 'ground' ? 'GND' as const : undefined,
    onSelect: (pin: number) => {
      const target = steps.findIndex(candidate => candidate.kind === 'signal' && candidate.row.pin === pin && candidate.row.deviceId === device?.id);
      if (target >= 0) setIndex(target);
    },
  };
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index]);

  return <section className="wiring-walkthrough" aria-label="Conexiones paso a paso">
    <div className="wiring-step-toolbar">
      <Button variant="outline" onClick={onExit}><ArrowLeft /> Volver a la vista completa</Button>
      <span aria-live="polite">{step ? `Paso ${index + 1} de ${steps.length}` : 'Recorrido terminado'}</span>
    </div>
    <progress aria-label="Progreso de conexiones" max={steps.length || 1} value={Math.min(index + 1, steps.length)} />
    {step ? <div className="wiring-step-content" data-has-board={step.kind !== 'prepare'}>
      <div className="wiring-step-card" data-kind={step.kind}>
        <span className="wiring-step-component">{device?.name ?? row?.deviceName}</span>
        <h3 ref={heading} tabIndex={-1}>{step.kind === 'prepare' ? 'Primero, alimentación y materiales' : step.kind === 'ground' ? 'Uní las masas: GND' : row?.signal}</h3>
        {step.kind === 'prepare' && <>
          <p>{advice[step.device.kind]}</p>
          <p>{connections.some(connection => connection.deviceId === step.device.id) ? 'Prepará este componente con la placa desconectada. A continuación veremos GND y cada señal, de a una.' : 'Este componente no tiene señales GPIO configurables. No agregues cables a partir de este recorrido.'}</p>
          <p>La alimentación depende del módulo: revisá su ficha. Esta guía no asigna un pin de alimentación automáticamente.</p>
        </>}
        {step.kind === 'ground' && <>
          <div className="wiring-step-route"><div><small>{step.device.name}</small><strong>GND / negativo común</strong></div><ArrowRight aria-hidden="true" /><div><small>{profile.shortName}</small><strong>GND</strong></div></div>
          <p>Buscá los contactos GND resaltados. Usá uno para unir la masa del componente o de su driver con la placa. Si usa una fuente externa, su negativo también comparte GND.</p>
          {['led', 'trafficLight'].includes(step.device.kind) && <p>En los LED, el cátodo (−) va a GND y cada luz lleva su propia resistencia de 220–330 Ω en serie.</p>}
        </>}
        {row && <>
          <div className="wiring-step-route"><div><small>{row.deviceName}</small><strong>{row.signal}</strong></div><Cable aria-hidden="true" /><div><small>{profile.shortName}</small><strong>{located ? physical : 'Revisar asignación'}</strong>{located && <span>GPIO {row.pin}{row.boardLabel && row.boardLabel !== physical ? ` · ${row.boardLabel}` : ''}</span>}</div></div>
          <p>{located ? `Localizá ${physical} en la placa, marcado con un aro y una flecha. Conectá la señal indicada a GPIO ${row.pin}.` : row.pin == null ? 'Esta señal está sin asignar. Elegí su pin en Armar escena antes de conectar; no hay un cable de destino indicado.' : `GPIO ${row.pin} no está habilitado o no se pudo localizar en esta placa. Revisá su asignación en Armar escena antes de conectar.`}</p>
          {device && ['led', 'trafficLight'].includes(device.kind) && /LED/.test(row.signal) && <p>GPIO → resistencia de 220–330 Ω → ánodo (+) del LED. El cátodo (−) va a GND.</p>}
          {device?.kind === 'messages' && <p>Enviar se conecta a Recibir del otro equipo; Recibir se conecta a Enviar. No unas dos salidas Enviar.</p>}
          {!device && <p>Usá el circuito de tu carga (resistencia, transistor o driver). Este bloque sólo define una salida GPIO.</p>}
        </>}
        {device && <Button variant="outline" onClick={() => onHelp(device)}>Ver ayuda de {device.name}</Button>}
      </div>
      {step.kind !== 'prepare' && <div className="wiring-step-board">{profileId === 'wemos-d1-r32' ? <WemosBoard {...boardProps} /> : <S3Board {...boardProps} />}</div>}
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
