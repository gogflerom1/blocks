import { CSSProperties, ReactNode, useRef } from 'react';
import { Ico } from './icons';

export type Safety = 'diy' | 'care' | 'pro';
const SAFETY: Record<Safety, { cls: string; label: string }> = {
  diy: { cls: 'g', label: 'Можно самому' },
  care: { cls: 'y', label: 'Требует осторожности' },
  pro: { cls: 'r', label: 'Лучше в сервис' },
};
export const SafetyTag = ({ level }: { level: Safety }) => (
  <span className={`tag ${SAFETY[level].cls}`}><i className="dot" />{SAFETY[level].label}</span>
);

export function Seg<T extends string | number>({ value, options, onChange, mono, label }: {
  value: T; options: readonly (T | { v: T; l: ReactNode })[]; onChange: (v: T) => void; mono?: boolean; label?: string;
}) {
  return (
    <div className={`seg${mono ? ' mono' : ''}`} role="group" aria-label={label}>
      {options.map((o) => {
        const v = (typeof o === 'object' ? o.v : o) as T;
        const l = typeof o === 'object' ? o.l : String(o);
        return <button key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" className="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function ModHead({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mod-head">
      <div className="stack" style={{ gap: 6 }}>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {children}
    </header>
  );
}

export function Stage({ label, hint, children, style, ctl }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; style?: CSSProperties; ctl?: ReactNode }) {
  return (
    <div className="stage" style={style}>
      {label && <div className="stage-label">{label}</div>}
      {hint && <div className="stage-hint">{hint}</div>}
      {children}
      {ctl && <div className="stage-ctl">{ctl}</div>}
    </div>
  );
}

export function Range({ label, value, min, max, step = 1, onChange, fmt, id }: {
  label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => ReactNode; id: string;
}) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="range">
      <label htmlFor={id}><span>{label}</span><b>{fmt ? fmt(value) : value}</b></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ ['--p' as string]: p + '%' }}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export function Callout({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'stop'; children: ReactNode }) {
  const I = kind === 'stop' ? Ico.stop : kind === 'warn' ? Ico.warn : Ico.info;
  return <div className={`callout ${kind}`}><I width={18} height={18} /><div>{children}</div></div>;
}

/** Цепочка «педаль → … → колёса» с подсветкой активного звена */
export function Chain({ items, active }: { items: string[]; active: number }) {
  return (
    <div className="chain" aria-live="polite">
      {items.map((s, i) => (
        <span key={s} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep">→</span>}
          <span className={`lnk${i <= active ? ' on' : ''}`}>{s}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Педаль: вертикальная, тянем вниз = нажимаем. Работает мышью и пальцем.
 * value 0 — отпущена, 1 — в пол.
 */
export function Pedal({ value, onChange, label, color = 'var(--cyan)', height = 170, wide }: {
  value: number; onChange: (v: number) => void; label: string; color?: string; height?: number; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (y: number) => {
    const r = ref.current!.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, (y - r.top - 26) / (r.height - 52))));
  };
  const travel = height - 52;
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 6, userSelect: 'none' }}>
      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') onChange(Math.min(1, value + 0.05));
          if (e.key === 'ArrowUp') onChange(Math.max(0, value - 0.05));
        }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); set(e.clientY); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') { if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) set(e.clientY); } }}
        style={{ position: 'relative', width: wide ? 84 : 64, height, borderRadius: 16, border: '1px solid var(--line-2)', background: 'rgba(4,8,16,.7)', touchAction: 'none', cursor: 'ns-resize' }}
      >
        <div style={{ position: 'absolute', left: '50%', top: 12, bottom: 12, width: 4, marginLeft: -2, borderRadius: 4, background: 'rgba(130,175,255,.15)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 12, height: value * travel + 14, width: 4, marginLeft: -2, borderRadius: 4, background: color, boxShadow: `0 0 12px ${color}` }} />
        <div style={{
          position: 'absolute', left: 6, right: 6, top: 8 + value * travel, height: 36, borderRadius: 10,
          background: `linear-gradient(180deg, #2a3a5a, #172440)`, border: `1px solid ${color}`,
          boxShadow: `0 6px 14px rgba(0,0,0,.5), 0 0 ${8 + value * 18}px -4px ${color}`,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,.07) 5px 7px)',
        }} />
      </div>
      <span className="eyebrow" style={{ color: 'var(--ink-2)' }}>{label}</span>
      <span className="mono tnum" style={{ fontSize: 12, color }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

/** Кнопка «удержание» — пока держишь, active = true (газ, тормоз) */
export function HoldButton({ children, onHold, className = 'btn', style }: { children: ReactNode; onHold: (on: boolean) => void; className?: string; style?: CSSProperties }) {
  return (
    <button className={className} style={{ touchAction: 'none', ...style }}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); onHold(true); }}
      onPointerUp={() => onHold(false)} onPointerCancel={() => onHold(false)} onLostPointerCapture={() => onHold(false)}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onHold(true); } }}
      onKeyUp={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

/** Подпись-выноска на SVG */
export function Leader({ x, y, tx, ty, text, color = 'var(--ink-2)', anchor = 'start' }: { x: number; y: number; tx: number; ty: number; text: string; color?: string; anchor?: 'start' | 'end' | 'middle' }) {
  return (
    <g pointerEvents="none">
      <path d={`M${x},${y} L${tx},${ty}`} stroke={color} strokeOpacity={0.5} strokeWidth={1} fill="none" />
      <circle cx={x} cy={y} r={2.2} fill={color} />
      <text x={tx + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0)} y={ty + 4} textAnchor={anchor} className="svg-label" style={{ fill: color }}>{text}</text>
    </g>
  );
}
