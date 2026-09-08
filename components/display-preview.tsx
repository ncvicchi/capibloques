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
  const width = profile.columns * 8;
  const height = profile.rows * 12;
  return (
    <svg
      className={`display-preview ${profile.graphic ? 'graphic' : 'character'}`}
      viewBox={`-4 -4 ${width + 8} ${height + 8}`}
      aria-label={`${device.name}: ${displayTargets(device.config)
        .map(
          (area) =>
            `${area.name}: ${texts[area.id]?.join(' ').trim() || 'sin texto'}`,
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
            x={area.column * 8}
            y={area.row * 12}
            width={Math.max(0, area.columns) * 8}
            height={Math.max(0, area.rows) * 12}
            fill="none"
            stroke="#73ab99"
            strokeWidth={0.5}
            strokeDasharray={profile.graphic ? '2 2' : undefined}
          />
          {(texts[area.id] ?? [profile.graphic ? area.name : ''])
            .slice(0, Math.max(0, area.rows))
            .map((line, row) => (
              <text
                key={row}
                x={area.column * 8}
                y={(area.row + row) * 12 + 10}
                fontFamily="monospace"
                fontSize={12}
                fill={profile.graphic ? '#fff' : '#baffb8'}
                xmlSpace="preserve"
                textLength={
                  Math.min(line.length, Math.max(0, area.columns)) * 8
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
