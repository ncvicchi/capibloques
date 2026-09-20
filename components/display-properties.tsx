'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  displayConfig,
  displayArtworks,
  displayPins,
  displayProfiles,
  nextDisplayArtworkId,
  nextTextAreaId,
  retiredDisplayArtworkIds,
  validDisplayConfig,
  type DisplayProfile,
  type TextArea,
} from '@/lib/display-model';
import {
  BUILTIN_DISPLAY_ARTWORKS,
  DISPLAY_ART_HEIGHT,
  DISPLAY_ART_WIDTH,
  displayArtworkPixel,
  MAX_DISPLAY_ARTWORKS,
  type DisplayArtwork,
} from '@/lib/display-graphics';
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
  const artworks = displayArtworks(config);
  const retiredArtworkIds = retiredDisplayArtworkIds(config);
  const animationSpeed = config.animationSpeed ?? 'normal';
  const [selectedArtworkId, setSelectedArtworkId] = useState(
    artworks[0]?.id ?? '',
  );
  const selectedArtwork =
    artworks.find((item) => item.id === selectedArtworkId) ?? artworks[0];
  const completeGraphicConfig = (
    patch: Partial<Pick<typeof config, 'animationSpeed' | 'artworks' | 'retiredArtworkIds'>>,
  ) => ({
    ...config,
    animationSpeed,
    artworks,
    retiredArtworkIds,
    ...patch,
  });
  const updateArtworks = (next: DisplayArtwork[]) =>
    onChange({
      ...device,
      config: completeGraphicConfig({ artworks: next }),
    });
  const updateArtwork = (change: (item: DisplayArtwork) => DisplayArtwork) => {
    if (!selectedArtwork) return;
    updateArtworks(
      artworks.map((item) =>
        item.id === selectedArtwork.id ? change(item) : item,
      ),
    );
  };
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
    if (displayProfiles[next].graphic && profile.graphic) {
      nextConfig.artworks = artworks;
      nextConfig.retiredArtworkIds = retiredArtworkIds;
      nextConfig.animationSpeed = animationSpeed;
    } else if (!displayProfiles[next].graphic && profile.graphic) {
      nextConfig.artworks = [];
      nextConfig.retiredArtworkIds = [
        ...retiredArtworkIds,
        ...artworks.map((item) => item.id),
      ];
      nextConfig.animationSpeed = animationSpeed;
    }
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
      {profile.keypad && (
        <p>
          Incluye los botones Izquierda, Arriba, Abajo, Derecha y Elegir. En
          los bloques aparecen como condiciones; la escena configura una sola
          entrada para todos ellos.
        </p>
      )}
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
      <label>
        Velocidad de animaciones
        <select
          aria-label="Velocidad de animaciones"
          value={animationSpeed}
          onChange={(event) =>
            onChange({
              ...device,
              config: completeGraphicConfig({
                animationSpeed: event.target.value as typeof animationSpeed,
              }),
            })
          }
        >
          <option value="slow">Tranquila</option>
          <option value="normal">Normal</option>
          <option value="fast">Rápida</option>
        </select>
      </label>
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
          <fieldset className="display-artwork-section">
            <legend>Dibujos propios</legend>
            <p>
              Dibujá con puntos en una cuadrícula simple. También podés usar
              {` ${BUILTIN_DISPLAY_ARTWORKS.length} dibujos y avatares incluidos`}.
            </p>
            <div className="display-artwork-actions">
              <select
                aria-label="Dibujo de pantalla a editar"
                value={selectedArtwork?.id ?? ''}
                onChange={(event) => setSelectedArtworkId(event.target.value)}
              >
                {artworks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={artworks.length >= MAX_DISPLAY_ARTWORKS}
                onClick={() => {
                  const id = nextDisplayArtworkId(config);
                  if (!id) return;
                  const next = {
                    id,
                    name: `Mi dibujo ${id.slice('mi-dibujo-'.length)}`,
                    rows: Array.from({ length: DISPLAY_ART_HEIGHT }, () => 0),
                  };
                  updateArtworks([...artworks, next]);
                  setSelectedArtworkId(id);
                }}
              >
                Nuevo
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={artworks.length <= 1 || retiredArtworkIds.length >= 4096}
                onClick={() => {
                  if (!selectedArtwork) return;
                  const next = artworks.filter(
                    (item) => item.id !== selectedArtwork.id,
                  );
                  onChange({
                    ...device,
                    config: completeGraphicConfig({
                      artworks: next,
                      retiredArtworkIds: [
                        ...retiredArtworkIds,
                        selectedArtwork.id,
                      ],
                    }),
                  });
                  setSelectedArtworkId(next[0]?.id ?? '');
                }}
              >
                Quitar
              </Button>
            </div>
            {selectedArtwork && (
              <>
                <label>
                  Nombre del dibujo
                  <input
                    aria-label="Nombre del dibujo de pantalla"
                    maxLength={30}
                    value={selectedArtwork.name}
                    onChange={(event) =>
                      updateArtwork((item) => ({
                        ...item,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <div
                  className="display-artwork-editor"
                  aria-label={`Editar ${selectedArtwork.name}`}
                >
                  {Array.from({ length: DISPLAY_ART_HEIGHT }, (_, y) =>
                    Array.from({ length: DISPLAY_ART_WIDTH }, (_, x) => {
                      const bit = 2 ** (DISPLAY_ART_WIDTH - 1 - x);
                      const on = (selectedArtwork.rows[y] ?? 0) % (bit * 2) >= bit;
                      return (
                        <button
                          type="button"
                          key={`${x}-${y}`}
                          aria-label={`Columna ${x + 1}, fila ${y + 1}`}
                          aria-pressed={on}
                          className={on ? 'on' : ''}
                          onClick={() =>
                            updateArtwork((item) => ({
                              ...item,
                              rows: displayArtworkPixel(item.rows, x, y, !on),
                            }))
                          }
                        />
                      );
                    }),
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateArtwork((item) => ({
                      ...item,
                      rows: Array.from(
                        { length: DISPLAY_ART_HEIGHT },
                        () => 0,
                      ),
                    }))
                  }
                >
                  Borrar dibujo
                </Button>
              </>
            )}
          </fieldset>
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
