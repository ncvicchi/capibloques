'use client';

import { MATRIX_HEIGHT, MATRIX_WIDTH } from '@/lib/led-matrix';
import type { LedMatrixDevice } from '@/lib/scene-model';

export function LedMatrixPreview({ device, rows, brightness }: { device: LedMatrixDevice; rows?: readonly number[]; brightness?: number }) {
  const frame = rows ?? device.config.patterns[0]?.rows ?? Array.from({ length: MATRIX_HEIGHT }, () => 0);
  const level = brightness ?? Math.round(device.config.brightness * 100 / 15);
  return (
    <figure className="led-matrix-preview" style={{ '--matrix-brightness': Math.max(.08, level / 100) } as React.CSSProperties} aria-label={`${device.name}: matriz LED de 32 por 8, brillo ${level}%`}>
      {Array.from({ length: MATRIX_HEIGHT }, (_, y) =>
        Array.from({ length: MATRIX_WIDTH }, (_, x) => {
          const bit = 2 ** (MATRIX_WIDTH - 1 - x);
          return <i key={`${x}-${y}`} className={(frame[y] ?? 0) % (bit * 2) >= bit ? 'on' : ''} />;
        }),
      )}
    </figure>
  );
}
