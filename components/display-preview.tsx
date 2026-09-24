import { displayProfiles, displayTargets } from '@/lib/display-model';
import { DISPLAY_ART_HEIGHT, DISPLAY_ART_WIDTH } from '@/lib/display-graphics';
import type { DisplayDevice, SceneDevice } from '@/lib/scene-model';

export function DisplayPreview({
  device,
  texts = {},
  artworkRows = [],
  pressedButton = null,
  dashboardDevices = [],
  dashboardRuntime = {},
  dashboardModes = {},
  onDashboardAction,
}: {
  device: DisplayDevice;
  texts?: Record<string, string[]>;
  artworkRows?: readonly number[];
  pressedButton?: 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' | null;
  dashboardDevices?: readonly SceneDevice[];
  dashboardRuntime?: Record<string, Record<string, unknown> | undefined>;
  dashboardModes?: Record<string, 'program' | 'manual'>;
  onDashboardAction?: (deviceId: string, action: 'cycle' | 'program') => void;
}) {
  const profile = displayProfiles[device.config.profile];
  const linesFor = (id: string) =>
    Object.hasOwn(texts, id) ? texts[id] : undefined;
  const cellWidth = profile.bus === 'integrated-rgb' ? 16 : profile.bus === 'spi' ? 12 : 8;
  const cellHeight = profile.bus === 'integrated-rgb' || profile.bus === 'spi' ? 16 : profile.graphic ? 8 : 12;
  const width = profile.graphic ? profile.width : profile.columns * cellWidth;
  const screenHeight = profile.graphic ? profile.height : profile.rows * cellHeight;
  const height = screenHeight + (profile.keypad ? 18 : 0);
  const dashboardIds = device.config.dashboard?.enabled ? device.config.dashboard.deviceIds : [];
  const dashboard = dashboardIds.map(id => dashboardDevices.find(item => item.id === id)).filter((item): item is SceneDevice => !!item);
  const dashboardValue = (item: SceneDevice) => {
    const runtime = dashboardRuntime[item.id] ?? {};
    if (item.kind === 'trafficLight') return typeof runtime.color === 'string' ? runtime.color : 'OFF';
    if (item.kind === 'robot') {
      const left = Number(runtime.left ?? 0), right = Number(runtime.right ?? 0);
      return left === 0 && right === 0 ? 'DETENIDO' : left > 0 && right > 0 ? 'AVANZA' : left < 0 && right < 0 ? 'RETROCEDE' : left < right ? 'IZQUIERDA' : 'DERECHA';
    }
    if (item.kind === 'servo') return `${Math.round(Number(runtime.angle ?? item.config.angle))}°`;
    if (item.kind === 'led') return `${Math.round(Number(runtime.brightness ?? item.config.brightness))}%`;
    if (item.kind === 'motor') return `${Math.round(Number(runtime.power ?? 0))}%`;
    return '-';
  };
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
      {dashboard.length > 0 && (
        <g aria-label="Tablero táctil local">
          <text x="20" y="28" fontSize="18" fontWeight="bold" fill="#9fffd5">TABLERO LOCAL · ESTADOS LÓGICOS</text>
          <text x="20" y="48" fontSize="12" fill="#ffcf5a">Sin salidas físicas conectadas</text>
          {dashboard.map((item, index) => {
            const y = 64 + index * 66;
            const ready = Object.hasOwn(dashboardModes, item.id);
            const manual = dashboardModes[item.id] === 'manual';
            return (
              <g key={item.id}>
                <rect x="16" y={y} width="768" height="56" rx="8" fill={manual ? '#3b2f17' : '#16352b'} stroke={manual ? '#ffcf5a' : '#73ab99'} />
                <text x="30" y={y + 21} fontSize="16" fill="white">{item.name.slice(0, 24)}</text>
                <text x="30" y={y + 43} fontSize="14" fill={manual ? '#ffcf5a' : '#9fffd5'}>{ready ? (manual ? 'MANUAL' : 'PROGRAMA') : 'PREPARANDO'} · {dashboardValue(item)}</text>
                <foreignObject x="430" y={y + 9} width="150" height="38">
                  <button type="button" aria-label={`Cambiar ${item.name}`} disabled={!onDashboardAction || !ready} onClick={() => onDashboardAction?.(item.id, 'cycle')} style={{ width: '100%', height: '100%', border: 0, borderRadius: 7, color: 'white', background: '#256b57', fontSize: 14 }}>Cambiar</button>
                </foreignObject>
                <foreignObject x="592" y={y + 9} width="176" height="38">
                  <button type="button" aria-label={`Volver al programa para ${item.name}`} disabled={!onDashboardAction || !ready} onClick={() => onDashboardAction?.(item.id, 'program')} style={{ width: '100%', height: '100%', border: 0, borderRadius: 7, color: 'white', background: '#315264', fontSize: 13 }}>Volver al programa</button>
                </foreignObject>
              </g>
            );
          })}
        </g>
      )}
      {dashboard.length === 0 && profile.graphic &&
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
      {dashboard.length === 0 && displayTargets(device.config).map((area) => (
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
