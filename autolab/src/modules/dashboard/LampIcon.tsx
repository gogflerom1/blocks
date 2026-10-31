// Значки контрольных ламп, 48×48, рисуются цветом currentColor
export function LampIcon({ id, size = 40 }: { id: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'check': return <svg {...p}><path d="M12 18h5l3-4h9v4h3l3-3h4v16h-4l-3-3h-3v5H19l-4-4h-3z" /><path d="M7 20v8M7 24h5M20 14v-3h8v3" /></svg>;
    case 'oil': return <svg {...p}><path d="M6 21h9l4-4h11l12 5-11 9H11l-5-5z" /><path d="M15 17v-4h-4M42 22l2-2" /><path d="M44 29c0 1.5-1 2.5-2 2.5s-2-1-2-2.5 1.2-3 2-4c.8 1 2 2.5 2 4z" fill="currentColor" /></svg>;
    case 'battery': return <svg {...p}><rect x="6" y="15" width="36" height="22" rx="2" /><path d="M12 15v-4h6v4M30 15v-4h6v4M12 26h6M30 26h6M33 23v6" /></svg>;
    case 'abs': return <svg {...p}><circle cx="24" cy="24" r="12" /><path d="M8 13a19 19 0 0 0 0 22M40 13a19 19 0 0 1 0 22" /><text x="24" y="28.5" textAnchor="middle" fill="currentColor" stroke="none" style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--f-body)' }}>ABS</text></svg>;
    case 'esp': return <svg {...p}><path d="M14 27l3-8a2 2 0 0 1 2-1.5h10a2 2 0 0 1 2 1.5l3 8v5H14z" /><path d="M14 32v3M34 32v3M18 27h12" /><path d="M10 40c2-2 4 2 6 0s4-2 6 0M26 40c2-2 4 2 6 0s4-2 6 0" /></svg>;
    case 'temp': return <svg {...p}><path d="M24 8v18" /><circle cx="24" cy="30" r="4" /><path d="M28 12h5M28 17h5M28 22h5" /><path d="M8 38c3-2 5 2 8 0s5-2 8 0 5 2 8 0 5-2 8 0" /></svg>;
    case 'cold': return <svg {...p}><path d="M24 8v18" /><circle cx="24" cy="30" r="4" /><path d="M28 12h5M28 17h5M28 22h5" /><path d="M8 38c3-2 5 2 8 0s5-2 8 0 5 2 8 0 5-2 8 0" /></svg>;
    case 'brake': return <svg {...p}><circle cx="24" cy="24" r="12" /><path d="M8 13a19 19 0 0 0 0 22M40 13a19 19 0 0 1 0 22M24 17v9" /><circle cx="24" cy="31" r="1.2" fill="currentColor" /></svg>;
    case 'tpms': return <svg {...p}><path d="M14 36c-4-3-6-8-6-13 0-6 3-10 4-12h24c1 2 4 6 4 12 0 5-2 10-6 13" /><path d="M12 40h24M24 17v10" /><circle cx="24" cy="32" r="1.2" fill="currentColor" /></svg>;
    case 'airbag': return <svg {...p}><circle cx="16" cy="11" r="3.5" /><path d="M14 18l-2 10 8 2 4 10M12 28l-4 8" /><circle cx="32" cy="24" r="8" /></svg>;
    case 'seatbelt': return <svg {...p}><circle cx="24" cy="10" r="4" /><path d="M18 40V22a6 6 0 0 1 12 0v18M17 18l15 18" /></svg>;
    case 'fuel': return <svg {...p}><rect x="10" y="10" width="18" height="30" rx="2" /><path d="M14 16h10v7H14zM28 18h4l4 4v12a3 3 0 0 0 6 0V18l-4-4M8 40h22" /></svg>;
    case 'glow': return <svg {...p}><path d="M8 30c0-6 6-10 6-4s6 2 6-4 6-6 6 0 6 4 6-2 6-6 6 0" /><path d="M8 30v6M40 24v12" /></svg>;
    case 'eps': return <svg {...p}><circle cx="22" cy="24" r="12" /><circle cx="22" cy="24" r="3" /><path d="M10 22h9M25 22h9M22 27v9" /><path d="M40 14v10" /><circle cx="40" cy="30" r="1.2" fill="currentColor" /></svg>;
    case 'service': return <svg {...p}><path d="M30 8a8 8 0 0 0-8 10L9 31a3 3 0 0 0 4 4l13-13a8 8 0 0 0 10-8l-5 3-4-1-1-4z" /></svg>;
    case 'low': return <svg {...p}><path d="M26 12c8 0 14 5 14 12s-6 12-14 12c-3 0-4-6-4-12s1-12 4-12z" /><path d="M16 15l-9 4M16 22l-9 4M16 29l-9 4" /></svg>;
    case 'high': return <svg {...p}><path d="M26 12c8 0 14 5 14 12s-6 12-14 12c-3 0-4-6-4-12s1-12 4-12z" /><path d="M17 15H7M17 21H7M17 27H7M17 33H7" /></svg>;
    default: return null;
  }
}
