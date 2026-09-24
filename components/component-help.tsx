'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { boardProfile, type BoardProfileId } from '@/lib/board-profiles';
import { componentHelp } from '@/lib/component-help';
import { displayProfiles } from '@/lib/display-model';
import { getPinRequirements, pinLabel, type SceneDevice, type SceneDeviceKind } from '@/lib/scene-model';

type ComponentHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SceneDeviceKind;
  device?: SceneDevice;
  boardProfileId: BoardProfileId;
  initialSection?: 'summary' | 'connect' | 'try' | 'problems';
};

export default function ComponentHelpDialog({ open, onOpenChange, kind, device, boardProfileId, initialSection = 'summary' }: ComponentHelpDialogProps) {
  const help = componentHelp(kind, device);
  const board = boardProfile(boardProfileId);
  const requirements = device ? getPinRequirements(device) : [];
  const pins = device?.pins as Record<string, number | null> | undefined;
  const variants = kind === 'display'
    ? Object.values(displayProfiles).map(profile => profile.name)
    : kind === 'otto'
      ? ['Bípedo de 4 servos', 'Bípedo + sonido', 'Explorador', 'Expresivo', 'Humanoide de 6 servos']
      : [];
  useEffect(() => {
    if (!open || initialSection === 'summary') return;
    const frame = requestAnimationFrame(() => document.querySelector(`.component-help-dialog #help-${initialSection}`)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [initialSection, open]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="component-help-dialog" data-help-id={help.helpId}>
      <DialogHeader>
        <DialogTitle>{help.illustration.symbol} Ayuda: {device?.name ?? help.friendlyName}</DialogTitle>
        <DialogDescription>{help.summary}</DialogDescription>
      </DialogHeader>

      <nav className="component-help-nav" aria-label="Secciones de ayuda">
        <a href="#help-summary">En pocas palabras</a><a href="#help-connect">Conectalo</a><a href="#help-try">Probalo</a><a href="#help-problems">Si algo falla</a><a href="#help-more">Quiero saber más</a>
      </nav>

      <div className="component-help-scroll" data-initial-section={initialSection}>
        <section id="help-summary" tabIndex={-1}>
          <div className="component-help-hero" role="img" aria-label={help.illustration.alt}>
            <span aria-hidden="true">{help.illustration.symbol}</span>
            <div><strong>Ilustración orientativa</strong><small>No es una foto del modelo exacto ni certifica sus pines.</small></div>
          </div>
          <p>{help.detail}</p>
          <dl className="component-help-facts"><div><dt>Nombre técnico</dt><dd>{help.technicalName}</dd></div><div><dt>Ficha</dt><dd>{help.helpId} · versión {help.helpVersion}</dd></div></dl>
          <h3>¿Para qué puede servir?</h3><ul>{help.uses.map(item => <li key={item}>{item}</li>)}</ul>
          <h3>¿Cómo funciona?</h3><p>{help.behavior}</p><p>{help.capiblocks}</p>
          {variants.length > 0 && <><h3>Perfiles disponibles</h3><ul>{variants.map(item => <li key={item}>{item}</li>)}</ul></>}
        </section>

        <section id="help-connect" tabIndex={-1}>
          <h2>Conectalo a {board.shortName}</h2>
          <p>{device ? `Estas son las conexiones actuales de ${device.name}. Si cambiás sus pines en la escena, esta tabla cambia también.` : 'Agregalo a la escena para elegir pines compatibles y ver aquí la conexión exacta.'}</p>
          {requirements.length > 0 ? <div className="component-help-table-wrap"><table><thead><tr><th>Señal</th><th>Conexión actual</th></tr></thead><tbody>{requirements.map(requirement => {
            const value = pins?.[requirement.key] ?? null;
            return <tr key={requirement.key}><td>{requirement.label}</td><td>{value === null ? 'Sin asignar' : pinLabel(value, boardProfileId)}</td></tr>;
          })}</tbody></table></div> : <p className="component-help-note">{kind === 'wifiNode' ? 'Usa la radio integrada: no necesita GPIO.' : 'Todavía no hay una instancia configurada para mostrar pines.'}</p>}
          <h3>Qué necesitás</h3><ul>{help.needs.map(item => <li key={item}>{item}</li>)}</ul>
          <h3>Cuidados</h3><ul>{help.care.map(item => <li key={item}>{item}</li>)}</ul>
        </section>

        <section id="help-try" tabIndex={-1}>
          <h2>Probalo primero</h2><p>{help.simulator}</p>
          <h3>Tu primer programa</h3><ol>{help.firstProgram.map(item => <li key={item}>{item}</li>)}</ol>
          <p className="component-help-note">Esta receta no reemplaza tu proyecto. Podés armarla en uno nuevo o guardarla como procedimiento.</p>
        </section>

        <section id="help-problems" tabIndex={-1}>
          <h2>Si algo falla</h2>
          <div className="component-help-troubleshooting">{help.troubleshooting.map(item => <article key={item.symptom}><strong>{item.symptom}</strong><p>{item.check}</p></article>)}</div>
          <p><strong>Límites y compatibilidad:</strong> {help.limits}</p>
        </section>

        <details id="help-more" className="component-help-teacher">
          <summary>Quiero saber más · ayuda para docentes</summary><p>{help.teacher}</p>
          <p><strong>Vocabulario útil:</strong> pin es un contacto de la placa; señal es la información que viaja; GND o masa es la referencia común; entrada recibe datos y salida produce una acción. PWM regula potencia usando pulsos. I2C y SPI son formas de comunicación entre módulos.</p>
          <p>Esta ficha distingue simulación, generación de código y aceptación física. Que algo se vea en el simulador no certifica el circuito real.</p>
        </details>
      </div>

      <div className="component-help-footer">
        <span>La impresión no incluye datos del alumno.</span>
        <Button type="button" variant="outline" onClick={() => window.print()}>🖨 Imprimir ficha</Button>
        <Button type="button" onClick={() => onOpenChange(false)}>Entendido</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
