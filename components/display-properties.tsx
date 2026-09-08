'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  displayConfig,
  displayPins,
  displayProfiles,
  nextTextAreaId,
  validDisplayConfig,
  type DisplayProfile,
  type TextArea,
} from '@/lib/display-model';
import type { DisplayDevice } from '@/lib/scene-model';

export function DisplayProperties({
  device,
  onChange,
}: {
  device: DisplayDevice;
  onChange: (device: DisplayDevice) => void;
}) {
  const [pendingProfile, setPendingProfile] = useState<DisplayProfile | null>(
    null,
  );
  const config = device.config;
  const profile = displayProfiles[config.profile];
  const updateArea = (id: string, patch: Partial<TextArea>) =>
    onChange({
      ...device,
      config: {
        ...config,
        areas: config.areas.map((area) =>
          area.id === id ? { ...area, ...patch } : area,
        ),
      },
    });
  const changeProfile = (next: DisplayProfile) => {
    const nextConfig = displayConfig(next);
    nextConfig.retiredAreaIds = [
      ...config.retiredAreaIds,
      ...config.areas.map((area) => area.id),
    ];
    if (nextConfig.areas[0])
      nextConfig.areas[0].id = nextTextAreaId({ ...nextConfig, areas: [] });
    onChange({ ...device, pins: displayPins(), config: nextConfig });
    setPendingProfile(null);
  };
  let freeArea: TextArea | undefined;
  if (config.areas.length < 8) {
    const columns = Math.min(16, profile.columns);
    for (let row = 0; row < profile.rows && !freeArea; row++)
      for (
        let column = 0;
        column <= profile.columns - columns && !freeArea;
        column++
      ) {
        const id = nextTextAreaId(config);
        const area = {
          id,
          name: `Texto ${id.slice(5)}`,
          column,
          row,
          columns,
          rows: 1,
        };
        if (validDisplayConfig({ ...config, areas: [...config.areas, area] }))
          freeArea = area;
      }
  }
  return (
    <section
      className="display-properties"
      aria-label="Configuración de pantalla"
    >
      <label>
        Modelo de pantalla
        <select
          aria-label="Modelo de pantalla"
          value={config.profile}
          onChange={(event) => {
            const next = event.target.value as DisplayProfile;
            if (next !== config.profile) setPendingProfile(next);
          }}
        >
          {Object.entries(displayProfiles).map(([id, model]) => (
            <option key={id} value={id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>
      {pendingProfile && (
        <fieldset aria-label="Confirmar cambio de pantalla">
          <p>
            Cambiar el modelo reinicia las conexiones y retira las zonas
            actuales. Los bloques anteriores pedirán un destino nuevo. Podés
            cancelar los cambios del objeto.
          </p>
          <Button type="button" onClick={() => changeProfile(pendingProfile)}>
            Cambiar modelo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPendingProfile(null)}
          >
            Conservar modelo
          </Button>
        </fieldset>
      )}
      <p>
        {profile.columns} columnas × {profile.rows} filas de texto.{' '}
        {profile.graphic
          ? 'Cada zona tiene su propio mensaje; las zonas no pueden superponerse.'
          : 'Los mensajes van directamente a toda la pantalla.'}
      </p>
      {profile.bus === 'i2c' && (
        <label>
          Dirección I2C
          <select
            aria-label="Dirección I2C"
            value={config.address}
            onChange={(event) =>
              onChange({
                ...device,
                config: { ...config, address: Number(event.target.value) },
              })
            }
          >
            {(config.profile === 'ssd1306'
              ? [0x3c, 0x3d]
              : Array.from({ length: 16 }, (_, i) =>
                  i < 8 ? 0x20 + i : 0x30 + i,
                )
            ).map((address) => (
              <option key={address} value={address}>
                0x{address.toString(16).toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      )}
      {profile.graphic && (
        <>
          <h4>Zonas de texto</h4>
          {config.areas.map((area) => (
            <fieldset key={area.id}>
              <legend>{area.name || 'Zona sin nombre'}</legend>
              <label>
                Nombre de zona
                <input
                  aria-label={`Nombre de ${area.id}`}
                  maxLength={40}
                  value={area.name}
                  onChange={(event) =>
                    updateArea(area.id, { name: event.target.value })
                  }
                />
              </label>
              <div className="display-area-grid">
                {(
                  [
                    ['column', 'Columna inicial', 0, profile.columns - 1],
                    ['row', 'Fila inicial', 0, profile.rows - 1],
                    ['columns', 'Ancho (columnas)', 1, profile.columns],
                    ['rows', 'Alto (filas)', 1, profile.rows],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      aria-label={`${label} de ${area.id}`}
                      min={min}
                      max={max}
                      step={1}
                      value={area[key]}
                      onChange={(event) =>
                        updateArea(area.id, {
                          [key]: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={config.retiredAreaIds.length >= 4096}
                onClick={() =>
                  onChange({
                    ...device,
                    config: {
                      ...config,
                      areas: config.areas.filter((item) => item.id !== area.id),
                      retiredAreaIds: [...config.retiredAreaIds, area.id],
                    },
                  })
                }
              >
                Quitar zona {area.name}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={!freeArea}
            onClick={() => {
              if (freeArea)
                onChange({
                  ...device,
                  config: { ...config, areas: [...config.areas, freeArea] },
                });
            }}
          >
            ＋ Agregar zona de texto
          </Button>
          {!freeArea && (
            <small>
              No queda una fila libre de 16 columnas, o ya hay 8 zonas. Ajustá
              las zonas existentes para liberar espacio.
            </small>
          )}
          <small>
            Quitar zonas queda pendiente hasta Guardar cambios; Cancelar las
            recupera.
          </small>
        </>
      )}
      {!validDisplayConfig(config) && (
        <p role="alert">
          Revisá nombres, posición y tamaño: las zonas deben caber y no
          superponerse.
        </p>
      )}
      <p className="display-portable-note">
        Texto portable: sin tildes; símbolos no compatibles → ?. La simulación y
        la placa muestran lo mismo. Un mensaje largo se ajusta por filas y se
        recorta al final.
      </p>
    </section>
  );
}
