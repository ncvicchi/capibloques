import { displayProfiles, displayTargets } from '@/lib/display-model';
import { DISPLAY_ART_HEIGHT, DISPLAY_ART_WIDTH } from '@/lib/display-graphics';
import type { DisplayDevice } from '@/lib/scene-model';

export function DisplayPreview({
  device,
  texts = {},
  artworkRows = [],
  pressedButton = null,
}: {
  device: DisplayDevice;
  texts?: Record<string, string[]>;
  artworkRows?: readonly number[];
  pressedButton?: 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' | null;
}) {
  const profile = displayProfiles[device.config.profile];
  const linesFor = (id: string) =>
    Object.hasOwn(texts, id) ? texts[id] : undefined;
  const cellWidth = profile.bus === 'integrated-rgb' ? 16 : profile.bus === 'spi' ? 12 : 8;
  const cellHeight = profile.bus === 'integrated-rgb' || profile.bus === 'spi' ? 16 : profile.graphic ? 8 : 12;
  const width = profile.graphic ? profile.width : profile.columns * cellWidth;
  const screenHeight = profile.graphic ? profile.height : profile.rows * cellHeight;
  const height = screenHeight + (profile.keypad ? 18 : 0);
  return (
    <svg
      className={`display-preview ${profile.graphic ? 'graphic' : 'character'}`}
      viewBox={`-4 -4 ${width + 8} ${height + 8}`}
      aria-label={`${device.name}: ${displayTargets(device.config)
        .map(
          (area) =>
            `${area.name}: ${linesFor(area.id)?.join(' ').trim() || 'sin texto'}`,
        )
        .join('; ')}${artworkRows.some((row) => row !== 0) ? '; dibujo visible' : ''}`}
    >
      <title>{device.name}</title>
      <rect
        x={-4}
        y={-4}
        width={width + 8}
        height={height + 8}
        rx={3}
        fill={profile.graphic ? '#101c24' : '#193b2a'}
      />
      {profile.graphic &&
        Array.from({ length: DISPLAY_ART_HEIGHT }, (_, artY) =>
          Array.from({ length: DISPLAY_ART_WIDTH }, (_, artX) => {
            const bit = 2 ** (DISPLAY_ART_WIDTH - 1 - artX);
            const on = (artworkRows[artY] ?? 0) % (bit * 2) >= bit;
            if (!on) return null;
            const scale = Math.max(
              1,
              Math.floor(
                Math.min(width / DISPLAY_ART_WIDTH, height / DISPLAY_ART_HEIGHT),
              ),
            );
            const offsetX = (width - DISPLAY_ART_WIDTH * scale) / 2;
            const offsetY = (height - DISPLAY_ART_HEIGHT * scale) / 2;
            return (
              <rect
                key={`art-${artX}-${artY}`}
                x={offsetX + artX * scale}
                y={offsetY + artY * scale}
                width={scale}
                height={scale}
                fill="#9fffd5"
              />
            );
          }),
        )}
      {displayTargets(device.config).map((area) => (
        <g key={area.id}>
          <rect
            x={area.column * cellWidth}
            y={area.row * cellHeight}
            width={Math.max(0, area.columns) * cellWidth}
            height={Math.max(0, area.rows) * cellHeight}
            fill="none"
            stroke="#73ab99"
            strokeWidth={0.5}
            strokeDasharray={profile.graphic ? '2 2' : undefined}
          />
          {(linesFor(area.id) ?? [profile.graphic ? area.name : ''])
            .slice(0, Math.max(0, area.rows))
            .map((line, row) => (
              <text
                key={row}
                x={area.column * cellWidth}
                y={(area.row + row) * cellHeight + cellHeight * 0.85}
                fontFamily="monospace"
                fontSize={cellHeight}
                fill={profile.graphic ? '#fff' : '#baffb8'}
                xmlSpace="preserve"
                textLength={
                  Math.min(line.length, Math.max(0, area.columns)) * cellWidth
                }
                lengthAdjust="spacingAndGlyphs"
              >
                {line.slice(0, Math.max(0, area.columns))}
              </text>
            ))}
        </g>
      ))}
      {profile.keypad && (
        <g aria-label={`Teclado: ${pressedButton ?? 'ningún botón'}`}>
          {([['LEFT', '←'], ['UP', '↑'], ['DOWN', '↓'], ['RIGHT', '→'], ['SELECT', 'OK']] as const).map(([value, label], index) => (
            <g key={value} transform={`translate(${index * 27 + 4} ${screenHeight + 4})`}>
              <rect width="23" height="11" rx="3" fill={pressedButton === value ? '#ffcf5a' : '#d9e4dc'} stroke="#2b4237" />
              <text x="11.5" y="8" textAnchor="middle" fontSize="7" fill="#18251f">{label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
