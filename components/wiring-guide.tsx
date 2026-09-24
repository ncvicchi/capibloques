'use client';

import { useMemo, useState } from 'react';
import { Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import WemosBoard from '@/components/wemos-board';
import S3Board from '@/components/s3-board';
import WaveshareBoard from '@/components/waveshare-board';
import ComponentHelpDialog from '@/components/component-help';
import { physicalWemosLabel } from '@/lib/wemos-board';
import { physicalS3Label } from '@/lib/s3-board';
import { boardProfile, type BoardProfileId } from '@/lib/board-profiles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getPinRequirements,
  validateScene,
  type SceneDefinition,
  type SceneDevice,
} from '@/lib/scene-model';
import type { CapiDiagnostic } from '@/lib/capiblocks';
import { displayProfiles } from '@/lib/display-model';
import { educationalModuleSpecs } from '@/lib/educational-modules';

interface WiringGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: SceneDefinition;
  boardProfile: BoardProfileId;
  rawPins: number[];
  diagnostics: CapiDiagnostic[];
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
}

const deviceAdvice: Record<SceneDevice['kind'], string> = {
  display: 'GPIO sólo a 3,3 V. LCD con backpack de 5 V: revisar pull-ups y usar adaptador de nivel I2C si corresponde. TFT: alimentación y retroiluminación según el módulo, nunca desde un GPIO. No se usa MISO ni el touch.',
  ledMatrix: 'MAX7219 suele alimentarse a 5 V y puede consumir bastante corriente: fuente externa adecuada, masa común y desacoplo. Nunca alimentes la matriz desde un GPIO; si 3,3 V no se reconoce de forma confiable, usá adaptación de nivel en DIN, CLK y CS.',
  trafficLight: 'Una resistencia de 220–330 Ω en serie con cada LED.',
  robot: 'DRV8833, fuente para motores y GND compartido con la Wemos.',
  otto: 'Usa cuatro señales PWM para piernas/pies y, según el perfil, dos más para brazos. Alimentá los servos con una fuente externa de 5 V y GND común. En sensores ultrasónicos HC-SR04 de 5 V, reducí ECHO a 3,3 V antes del ESP32.',
  motor: 'DRV8833 y fuente para el motor; nunca lo conectes directo al GPIO.',
  led: 'Una resistencia de 220–330 Ω en serie con el LED.',
  smartLights: 'DIN recibe una sola señal. Usá fuente externa dimensionada para la cantidad y brillo, uní GND y conectá por DIN, nunca DOUT. La corriente mostrada es una estimación, no una medición.',
  servo: 'Fuente de 5 V adecuada y GND compartido; el GPIO sólo lleva señal.',
  activeBuzzer:
    'Revisá la corriente del módulo; usa transistor si supera lo admitido por el GPIO.',
  passiveBuzzer:
    'Revisá la corriente del módulo; usa transistor si supera lo admitido por el GPIO.',
  button: 'Conectalo a GND cuando uses la resistencia pull-up interna.',
  infraredBarrier: 'Conectá la salida digital del detector al GPIO elegido y compartí GND. Configurá en la escena si interrumpida corresponde a nivel alto o bajo.',
  lightSensor: 'La señal analógica debe permanecer entre 0 y 3,3 V.',
  potentiometer: 'Extremos a 3,3 V y GND; cursor central al GPIO analógico.',
  wifiNode: 'No necesita cables: Wi-Fi está integrado en el ESP32.',
  messages: 'Cruza las señales: Enviar va a Recibir del otro equipo y Recibir va a Enviar. Uní también las masas (GND). Solo 3,3 V.',
  ...Object.fromEntries(Object.entries(educationalModuleSpecs).map(([kind, spec]) => [kind, `${spec.needs.join(', ')}. ${spec.cautions.join(' ')}`])),
} as Record<SceneDevice['kind'], string>;

function sceneSignature(scene: SceneDefinition, rawPins: number[], profileId: BoardProfileId) {
  return JSON.stringify([
    profileId,
    scene.devices.map((device) => [device.id, device.kind, device.pins, ['display', 'ledMatrix', 'infraredBarrier', 'otto'].includes(device.kind) ? device.config : null]),
    rawPins,
  ]);
}

export default function WiringGuide({
  open,
  onOpenChange,
  scene,
  boardProfile: profileId,
  rawPins,
  diagnostics,
  acknowledged,
  onAcknowledgedChange,
}: WiringGuideProps) {
  const signature = sceneSignature(scene, rawPins, profileId);
  const [selection, setSelection] = useState<{ signature: string; pin: number } | null>(null);
  const [deviceSelection, setDeviceSelection] = useState<{ signature: string; id: string } | null>(null);
  const [helpDevice, setHelpDevice] = useState<SceneDevice | null>(null);
  const selectedPin = selection?.signature === signature ? selection.pin : undefined;
  const selectedDevice = selectedPin === undefined && deviceSelection?.signature === signature ? deviceSelection.id : undefined;
  const needsLedSafety = scene.devices.some((device) =>
    ['led', 'trafficLight'].includes(device.kind),
  );
  const needsExternalPower = scene.devices.some((device) =>
    ['motor', 'robot', 'otto', 'servo'].includes(device.kind),
  );
  const checklist = useMemo(
    () => [
      {
        id: 'unplugged',
        label: 'La placa está desconectada mientras armo o cambio cables.',
      },
      {
        id: 'voltage',
        label: 'Ninguna señal que llega a un GPIO supera 3,3 V.',
      },
      ...(needsLedSafety
        ? [
            {
              id: 'resistors',
              label: 'Cada LED tiene su resistencia de 220–330 Ω.',
            },
          ]
        : []),
      ...(needsExternalPower
        ? [
            {
              id: 'power',
              label:
                'Motores/servos usan la fuente indicada y todas las masas GND están unidas.',
            },
          ]
        : []),
      ...(rawPins.length
        ? [
            {
              id: 'advanced-outputs',
              label:
                'Cada salida avanzada usa la resistencia, transistor o driver que requiere su carga.',
            },
          ]
        : []),
      {
        id: 'adult',
        label: 'Una persona adulta revisó polaridad, alimentación y cables.',
      },
    ],
    [needsExternalPower, needsLedSafety, rawPins.length],
  );
  const [review, setReview] = useState<{
    signature: string;
    checks: Record<string, boolean>;
  }>({ signature, checks: {} });
  const checks = review.signature === signature ? review.checks : {};

  const profile = boardProfile(profileId);
  const validation = validateScene(scene, profileId);
  const rawDiagnostics = diagnostics.filter((item) =>
    item.code.startsWith('raw-pin-'),
  );
  const hardwareReady =
    validation.hardwareReady &&
    !rawDiagnostics.some((item) => item.severity === 'error');
  const connectionRows = scene.devices.flatMap((device) => {
    return getPinRequirements(device).map((requirement) => {
      const pin = (device.pins as Record<string, number | null>)[
        requirement.key
      ];
      const boardPin = profile.pins.find((item) => item.gpio === pin);
      return {
        id: `${device.id}-${requirement.key}`,
        deviceId: device.id,
        deviceName: device.name,
        signal: requirement.label,
        pin,
        boardLabel: boardPin?.label,
      };
    });
  });
  connectionRows.push(
    ...rawPins.map((pin) => ({
      id: `raw-output-${pin}`,
      deviceId: 'raw-outputs',
      deviceName: 'Salida avanzada (bloque)',
      signal: 'Salida digital',
      pin,
      boardLabel: profile.pins.find((item) => item.gpio === pin)?.label,
    })),
  );
  const allChecked = checklist.every((item) => checks[item.id]);

  return (<>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wiring-dialog">
        <DialogHeader>
          <DialogTitle>Conectar {profile.shortName} sin adivinar</DialogTitle>
          <DialogDescription>
            Esta hoja reúne los GPIO de la escena y de los bloques avanzados. La
            simulación no puede comprobar cables, tensión ni corriente reales.
          </DialogDescription>
        </DialogHeader>

        <div className="wiring-layout">
          <label className="wiring-highlight">Resaltar conexiones de
            <select aria-label="Resaltar conexiones de" value={selectedDevice ?? ''} onChange={event => { setSelection(null); setDeviceSelection({ signature, id: event.target.value }); }}>
              <option value="">Todos los componentes</option>
              {scene.devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
              {rawPins.length > 0 && <option value="raw-outputs">Salidas avanzadas</option>}
            </select>
          </label>
          {profileId === 'wemos-d1-r32'
            ? <WemosBoard connections={connectionRows} selectedPin={selectedPin} selectedDevice={selectedDevice} onSelect={pin => setSelection({ signature, pin })} />
            : profileId === 'waveshare-esp32-s3-touch-lcd-5-28117'
              ? <WaveshareBoard />
              : <S3Board connections={connectionRows} selectedPin={selectedPin} selectedDevice={selectedDevice} onSelect={pin => setSelection({ signature, pin })} />}

          <section className="wiring-status">
            {hardwareReady ? (
              <ShieldCheck aria-hidden="true" />
            ) : (
              <ShieldAlert aria-hidden="true" />
            )}
            <div>
              <strong>
                {hardwareReady
                  ? 'GPIO asignados sin conflictos'
                  : 'Hay GPIO que necesitan atención'}
              </strong>
              <span>
                Esto confirma la asignación lógica, no certifica el circuito
                físico.
              </span>
            </div>
          </section>

          <section className="wiring-table-section">
            <h3>Conexiones de esta escena</h3>
            {connectionRows.length ? (
              <div className="wiring-table-wrap">
                <table className="wiring-table">
                  <thead>
                    <tr>
                      <th>N.º</th>
                      <th>Componente</th>
                      <th>Señal</th>
                      <th>Serigrafía / alias</th>
                      <th>GPIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectionRows.map((row, index) => (
                      <tr key={row.id} data-selected={(row.pin != null && row.pin === selectedPin) || row.deviceId === selectedDevice}>
                        <td>{index + 1}</td>
                        <td>{row.deviceName}</td>
                        <td>{row.signal}</td>
                        <td>{(profileId === 'wemos-d1-r32' ? physicalWemosLabel(row.pin) : profileId === 'waveshare-esp32-s3-touch-lcd-5-28117' ? undefined : physicalS3Label(row.pin)) ?? (row.pin == null ? 'Integrado / sin cable' : 'No localizado')}{row.boardLabel ? ` / ${row.boardLabel}` : ''}</td>
                        <td>{row.pin == null ? '—' : <button type="button" className="wiring-pin-button" aria-label={`Localizar conexión ${index + 1}: ${row.deviceName}, ${row.signal}, GPIO ${row.pin}`} aria-pressed={row.pin === selectedPin} onClick={() => setSelection({ signature, pin: row.pin! })}>GPIO {row.pin}</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="wiring-empty">
                Agregá un componente con cables para ver sus conexiones aquí.
              </p>
            )}
          </section>

          {(scene.devices.length > 0 || rawPins.length > 0) && (
            <section className="device-advice-grid">
              {scene.devices.map((device) => (
                <article key={device.id}>
                  <div className="device-advice-title"><strong>{device.name}</strong><button type="button" onClick={() => setHelpDevice(device)} aria-label={`Abrir ayuda de ${device.name}`}>? Ayuda</button></div>
                  {device.kind === 'display' && <span>{displayProfiles[device.config.profile].name}{displayProfiles[device.config.profile].bus === 'i2c' ? ` · dirección 0x${device.config.address.toString(16).toUpperCase()}` : ' · orientación horizontal'}</span>}
                  {device.kind === 'ledMatrix' && <span>4 × MAX7219 · {device.config.order === 'left-to-right' ? 'DIN junto al módulo izquierdo' : 'DIN junto al módulo derecho'} · brillo {device.config.brightness}/15</span>}
                  <span>{deviceAdvice[device.kind]}</span>
                </article>
              ))}
              {rawPins.length > 0 && (
                <article>
                  <strong>Salidas avanzadas</strong>
                  <span>
                    Definí la carga de cada GPIO: LED con resistencia; motor,
                    relé o carga de mayor corriente mediante transistor o
                    driver. Nunca alimentes una carga desde el GPIO.
                  </span>
                </article>
              )}
            </section>
          )}

          {validation.issues.length > 0 && (
            <section className="wiring-issues">
              <h3>Antes de conectar</h3>
              <ul>
                {validation.issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${issue.itemId ?? issue.deviceId ?? index}`}
                  >
                    <span aria-hidden="true">
                      {issue.severity === 'error' ? '⛔' : '⚠️'}
                    </span>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rawDiagnostics.length > 0 && (
            <section className="wiring-issues">
              <h3>Salidas de bloques avanzados</h3>
              <ul>
                {rawDiagnostics.map((issue, index) => (
                  <li key={`${issue.code}-${issue.pin ?? index}`}>
                    <span aria-hidden="true">
                      {issue.severity === 'error' ? '⛔' : '⚠️'}
                    </span>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <fieldset className="safety-checklist">
            <legend>Chequeo con una persona adulta</legend>
            {checklist.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={Boolean(checks[item.id]) || acknowledged}
                  disabled={acknowledged}
                  onChange={(event) =>
                    setReview((current) => ({
                      signature,
                      checks: {
                        ...(current.signature === signature
                          ? current.checks
                          : {}),
                        [item.id]: event.target.checked,
                      },
                    }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="wiring-footer">
            <span>
              {acknowledged
                ? 'Revisión registrada para esta configuración.'
                : 'El botón se habilita cuando completes el chequeo.'}
            </span>
            <button
              type="button"
              className="wiring-confirm"
              disabled={!allChecked && !acknowledged}
              onClick={() => {
                onAcknowledgedChange(true);
                onOpenChange(false);
              }}
            >
              <Check size={17} />
              {acknowledged ? 'Revisión completa' : 'Conexiones revisadas'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {helpDevice && <ComponentHelpDialog open onOpenChange={next => !next && setHelpDevice(null)} kind={helpDevice.kind} device={helpDevice} boardProfileId={profileId} initialSection="connect" />}
    </>
  );
}
