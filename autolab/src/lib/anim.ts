import { useEffect, useRef, useState } from 'react';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const deg = Math.PI / 180;
export const mix = (c1: string, c2: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))).toString(16).padStart(2, '0')).join('');
};

/** rAF-цикл: колбэк получает dt (сек). Работает только пока active. */
export function useTicker(cb: (dt: number, t: number) => void, active = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0, last = performance.now(), t0 = last;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt, (now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** Значение, которое обновляется каждый кадр (для перерисовки SVG) */
export function useFrame(active = true) {
  const [, set] = useState(0);
  useTicker(() => set((n) => (n + 1) % 1e6), active);
}

export function useMedia(q: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** Точка на окружности (SVG: y вниз) */
export const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;

/** Зубчатое колесо как path. inner=true — внутренние зубья (коронная шестерня) */
export function gearPath(cx: number, cy: number, r: number, teeth: number, h: number, phase = 0, inner = false) {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * step;
    const seq = [[-0.5, 0], [-0.28, 1], [0.28, 1], [0.5, 0]] as const;
    for (const [f, up] of seq) {
      const rr = inner ? r - up * h : r + up * h;
      const ang = a + f * step;
      pts.push(`${(cx + rr * Math.cos(ang)).toFixed(2)},${(cy + rr * Math.sin(ang)).toFixed(2)}`);
    }
  }
  return 'M' + pts.join('L') + 'Z';
}

export const store = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem('autolab:' + k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem('autolab:' + k, JSON.stringify(v)); } catch { /* приватный режим */ }
  },
};
