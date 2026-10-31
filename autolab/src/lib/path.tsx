import { memo } from 'react';

// Ломаные для схем: длина, точка по доле длины, частицы-потоки
export type Pt = [number, number];
export const pd = (pts: Pt[]) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');

export function polyLen(pts: Pt[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

export function polyAt(pts: Pt[], s: number): Pt {
  const total = polyLen(pts);
  let target = (((s % 1) + 1) % 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg) {
      const k = seg ? target / seg : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

/** Частицы вдоль пути. phase — пройденная доля (растёт со временем) */
export const Particles = memo(function Particles({ pts, n = 14, phase, color, r = 3, opacity = 1, colorAt }: {
  pts: Pt[]; n?: number; phase: number; color: string; r?: number; opacity?: number; colorAt?: (s: number) => string;
}) {
  return (
    <g pointerEvents="none" opacity={opacity}>
      {Array.from({ length: n }, (_, i) => {
        const s = (((i / n + phase) % 1) + 1) % 1;
        const [x, y] = polyAt(pts, s);
        return <circle key={i} cx={x} cy={y} r={r} fill={colorAt ? colorAt(s) : color} />;
      })}
    </g>
  );
});

/** Труба: тёмная подложка + полупрозрачный цвет среды */
export function Pipe({ pts, color, w = 14, on = true }: { pts: Pt[]; color: string; w?: number; on?: boolean }) {
  const d = pd(pts);
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="#1c2a44" strokeWidth={w + 4} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#060b16" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeOpacity={on ? 0.22 : 0.06} strokeWidth={w - 2} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}
