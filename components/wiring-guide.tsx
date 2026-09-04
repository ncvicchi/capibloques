'use client';

import { useMemo, useState } from 'react';
import { Cable, Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  sceneComponentCatalog,
  validateScene,
  wemosD1R32Pins,
  type SceneDefinition,
  type SceneDevice,
} from '@/lib/scene-model';
import type { CapiDiagnostic } from '@/lib/capiblocks';

interface WiringGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: SceneDefinition;
  rawPins: number[];
  diagnostics: CapiDiagnostic[];
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
}

const deviceAdvice: Record<SceneDevice['kind'], string> = {
  trafficLight: 'Una resistencia de 220–330 Ω en serie con cada LED.',
  robot: 'DRV8833, fuente para motores y GND compartido con la Wemos.',
  motor: 'DRV8833 y fuente para el motor; nunca lo conectes directo al GPIO.',
  led: 'Una resistencia de 220–330 Ω en serie con el LED.',
  servo: 'Fuente de 5 V adecuada y GND compartido; el GPIO sólo lleva señal.',
  activeBuzzer:
    'Revisá la corriente del módulo; usa transistor si supera lo admitido por el GPIO.',
  passiveBuzzer:
    'Revisá la corriente del módulo; usa transistor si supera lo admitido por el GPIO.',
  button: 'Conectalo a GND cuando uses la resistencia pull-up interna.',
  lightSensor: 'La señal analógica debe permanecer entre 0 y 3,3 V.',
  potentiometer: 'Extremos a 3,3 V y GND; cursor central al GPIO analógico.',
  wifiNode: 'No necesita cables: Wi-Fi está integrado en el ESP32.',
};

function sceneSignature(scene: SceneDefinition, rawPins: number[]) {
  return JSON.stringify([
    scene.devices.map((device) => [device.id, device.kind, device.pins]),
    rawPins,
  ]);
}

export default function WiringGuide({
  open,
  onOpenChange,
  scene,
  rawPins,
  diagnostics,
  acknowledged,
  onAcknowledgedChange,
}: WiringGuideProps) {
  const signature = sceneSignature(scene, rawPins);
  const needsLedSafety = scene.devices.some((device) =>
    ['led', 'trafficLight'].includes(device.kind),
  );
  const needsExternalPower = scene.devices.some((device) =>
    ['motor', 'robot', 'servo'].includes(device.kind),
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

  const validation = validateScene(scene);
  const rawDiagnostics = diagnostics.filter((item) =>
    item.code.startsWith('raw-pin-'),
  );
  const hardwareReady =
    validation.hardwareReady &&
    !rawDiagnostics.some((item) => item.severity === 'error');
  const connectionRows = scene.devices.flatMap((device) => {
    const catalog = sceneComponentCatalog.find(
      (entry) => entry.kind === device.kind,
    );
    return (catalog?.pinRequirements ?? []).map((requirement) => {
      const pin = (device.pins as Record<string, number | null>)[
        requirement.key
      ];
      const boardPin = wemosD1R32Pins.find((item) => item.gpio === pin);
      return {
        id: `${device.id}-${requirement.key}`,
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
      deviceName: 'Salida avanzada (bloque)',
      signal: 'Salida digital',
      pin,
      boardLabel: wemosD1R32Pins.find((item) => item.gpio === pin)?.label,
    })),
  );
  const allChecked = checklist.every((item) => checks[item.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wiring-dialog">
        <DialogHeader>
          <DialogTitle>Conectar la Wemos sin adivinar</DialogTitle>
          <DialogDescription>
            Esta hoja reúne los GPIO de la escena y de los bloques avanzados. La
            simulación no puede comprobar cables, tensión ni corriente reales.
          </DialogDescription>
        </DialogHeader>

        <div className="wiring-layout">
          <section className="wiring-board" aria-label="Placa de destino">
            <span className="wiring-usb">USB</span>
            <div>
              <Cable size={28} />
              <strong>WEMOS D1 R32</strong>
              <small>ESP32 · lógica de 3,3 V</small>
            </div>
            <span className="wiring-ground">GND común</span>
          </section>

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
                      <th>Componente</th>
                      <th>Señal</th>
                      <th>Wemos</th>
                      <th>GPIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectionRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.deviceName}</td>
                        <td>{row.signal}</td>
                        <td>{row.boardLabel ?? 'Sin asignar'}</td>
                        <td>{row.pin ?? '—'}</td>
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
                  <strong>{device.name}</strong>
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
  );
}
