import { displayProfiles, displayTargets } from '@/lib/display-model';
import type { DisplayDevice } from '@/lib/scene-model';

export function DisplayPreview({
  device,
  texts = {},
}: {
  device: DisplayDevice;
  texts?: Record<string, string[]>;
}) {
  const profile = displayProfiles[device.config.profile];
  const linesFor = (id: string) =>
    Object.hasOwn(texts, id) ? texts[id] : undefined;
  const cellWidth = profile.bus === 'spi' ? 12 : 8;
  const cellHeight = profile.bus === 'spi' ? 16 : profile.graphic ? 8 : 12;
  const width = profile.graphic ? profile.width : profile.columns * cellWidth;
  const height = profile.graphic ? profile.height : profile.rows * cellHeight;
  return (
    <svg
      className={`display-preview ${profile.graphic ? 'graphic' : 'character'}`}
      viewBox={`-4 -4 ${width + 8} ${height + 8}`}
      aria-label={`${device.name}: ${displayTargets(device.config)
        .map(
          (area) =>
            `${area.name}: ${linesFor(area.id)?.join(' ').trim() || 'sin texto'}`,
        )
        .join('; ')}`}
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
    </svg>
  );
}
