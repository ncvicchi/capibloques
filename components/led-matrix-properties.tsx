'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { MAX_MATRIX_PATTERNS, MATRIX_HEIGHT, MATRIX_WIDTH, matrixPixel, type MatrixPattern } from '@/lib/led-matrix';
import type { LedMatrixDevice } from '@/lib/scene-model';

export function LedMatrixProperties({ device, onChange }: { device: LedMatrixDevice; onChange: (device: LedMatrixDevice) => void }) {
  const orderId = `${device.id}-matrix-order`;
  const orientationId = `${device.id}-matrix-orientation`;
  const nameId = `${device.id}-matrix-pattern-name`;
  const [selectedId, setSelectedId] = useState(device.config.patterns[0]?.id ?? '');
  const selected = device.config.patterns.find(pattern => pattern.id === selectedId) ?? device.config.patterns[0];
  const updatePatterns = (patterns: MatrixPattern[]) => onChange({ ...device, config: { ...device.config, patterns } });
  const updatePattern = (change: (pattern: MatrixPattern) => MatrixPattern) => {
    if (!selected) return;
    updatePatterns(device.config.patterns.map(pattern => pattern.id === selected.id ? change(pattern) : pattern));
  };
  const addPattern = () => {
    for (let index = 1; index <= MAX_MATRIX_PATTERNS; index += 1) {
      const id = `dibujo-${index}`;
      if (device.config.patterns.some(pattern => pattern.id === id)) continue;
      updatePatterns([...device.config.patterns, { id, name: `Dibujo ${index}`, rows: Array.from({ length: MATRIX_HEIGHT }, () => 0) }]);
      setSelectedId(id);
      return;
    }
  };
  return (
    <div className="matrix-properties">
      <label>Brillo
        <input type="range" min="0" max="15" value={device.config.brightness} onChange={event => onChange({ ...device, config: { ...device.config, brightness: Number(event.target.value) } })} />
        <small>{device.config.brightness} de 15</small>
      </label>
      <label htmlFor={orderId}>Orden físico de los módulos</label>
        <NativeSelect id={orderId} value={device.config.order} onChange={event => onChange({ ...device, config: { ...device.config, order: event.target.value as LedMatrixDevice['config']['order'] } })}>
          <NativeSelectOption value="left-to-right">Entrada a la izquierda</NativeSelectOption>
          <NativeSelectOption value="right-to-left">Entrada a la derecha</NativeSelectOption>
        </NativeSelect>
      <label htmlFor={orientationId}>Orientación</label>
        <NativeSelect id={orientationId} value={device.config.orientation} onChange={event => onChange({ ...device, config: { ...device.config, orientation: event.target.value as LedMatrixDevice['config']['orientation'] } })}>
          <NativeSelectOption value="normal">Normal</NativeSelectOption>
          <NativeSelectOption value="rotated">Girada 180°</NativeSelectOption>
        </NativeSelect>
      <fieldset>
        <legend>Dibujos guardados</legend>
        <div className="matrix-pattern-actions">
          <NativeSelect aria-label="Dibujo a editar" value={selected?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>
            {device.config.patterns.map(pattern => <NativeSelectOption key={pattern.id} value={pattern.id}>{pattern.name}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="button" variant="outline" disabled={device.config.patterns.length >= MAX_MATRIX_PATTERNS} onClick={addPattern}>Nuevo</Button>
          <Button type="button" variant="ghost" disabled={device.config.patterns.length <= 1} onClick={() => {
            if (!selected) return;
            const next = device.config.patterns.filter(pattern => pattern.id !== selected.id);
            updatePatterns(next); setSelectedId(next[0].id);
          }}>Quitar</Button>
        </div>
        {selected && <>
          <label htmlFor={nameId}>Nombre del dibujo</label><Input id={nameId} maxLength={30} value={selected.name} onChange={event => updatePattern(pattern => ({ ...pattern, name: event.target.value }))} />
          <div className="matrix-pattern-editor" aria-label={`Editar ${selected.name}`}>
            {Array.from({ length: MATRIX_HEIGHT }, (_, y) => Array.from({ length: MATRIX_WIDTH }, (_, x) => {
              const bit = 2 ** (MATRIX_WIDTH - 1 - x);
              const on = (selected.rows[y] ?? 0) % (bit * 2) >= bit;
              return <button type="button" aria-label={`Columna ${x + 1}, fila ${y + 1}`} aria-pressed={on} key={`${x}-${y}`} className={on ? 'on' : ''} onClick={() => updatePattern(pattern => ({ ...pattern, rows: matrixPixel(pattern.rows, x, y, !on) }))} />;
            }))}
          </div>
          <Button type="button" variant="outline" onClick={() => updatePattern(pattern => ({ ...pattern, rows: Array.from({ length: MATRIX_HEIGHT }, () => 0) }))}>Borrar dibujo</Button>
        </>}
      </fieldset>
      <p className="display-portable-note">DIN entra al primer MAX7219. Orden y giro corrigen cómo está armada la placa sin cambiar el dibujo lógico.</p>
    </div>
  );
}
