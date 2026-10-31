import { ReactNode } from 'react';

/*
  Моторный отсек сверху: перед машины — внизу, лобовое стекло — вверху.
  Стоим перед машиной: левая сторона авто (водительская в LHD) — справа на экране.
*/
export type Marker = { id: string; x: number; y: number; color: string; label?: string; n?: number };

export function CapIcon({ kind, size = 22 }: { kind: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'oil': return <svg {...p}><path d="M3 10h4l2-2h5l6 3-7 6H5l-2-4z" /><path d="M20 11l1.5-1.5M21 15.5c0 .8-.6 1.5-1.2 1.5s-1.3-.7-1.3-1.5.8-2 1.3-2.5c.4.5 1.2 1.7 1.2 2.5z" /></svg>;
    case 'coolant': return <svg {...p}><path d="M12 3v10" /><circle cx="12" cy="15.5" r="2.5" /><path d="M14.5 6H17M14.5 9H17M3 20c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" /></svg>;
    case 'brake': return <svg {...p}><circle cx="12" cy="12" r="5.5" /><path d="M4.5 6.5a9 9 0 0 0 0 11M19.5 6.5a9 9 0 0 1 0 11" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
    case 'washer': return <svg {...p}><path d="M3 18c3-5 15-5 18 0" /><path d="M12 15V6M12 6l-4-2M12 6l4-2M12 6V2" /></svg>;
    case 'ps': return <svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /><path d="M3.8 10.5h6.2M14 10.5h6.2M12 14v6.5" /></svg>;
    case 'atf': return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>;
    default: return null;
  }
}

type Props = {
  open: boolean; sel?: string | null; onSelect?: (id: string) => void; markers?: Marker[]; ps?: boolean; children?: ReactNode; dim?: boolean;
};

export function EngineBay({ open, sel, onSelect, markers = [], ps = true, children, dim }: Props) {
  const g = (id: string, node: ReactNode) => (
    <g className={`hit${sel === id ? ' sel' : ''}`} onClick={() => onSelect?.(id)} opacity={dim && sel && sel !== id ? 0.45 : 1} style={{ transition: 'opacity .3s' }}>{node}</g>
  );
  return (
    <svg viewBox="0 0 800 600" className="fig bay" role="img" aria-label="Моторный отсек, вид сверху">
      <defs>
        <linearGradient id="bay-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a1122" /><stop offset="1" stopColor="#050912" /></linearGradient>
        <linearGradient id="bay-body" x1="0" x2="1"><stop offset="0" stopColor="#1a2b4a" /><stop offset=".5" stopColor="#2b4470" /><stop offset="1" stopColor="#1a2b4a" /></linearGradient>
        <linearGradient id="bay-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#30507f" /><stop offset=".55" stopColor="#1e355c" /><stop offset="1" stopColor="#152742" /></linearGradient>
        <linearGradient id="bay-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2a44" /><stop offset="1" stopColor="#163b5c" /></linearGradient>
        <linearGradient id="bay-cover" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a2f3a" /><stop offset="1" stopColor="#14171e" /></linearGradient>
        <linearGradient id="cool-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6fb5" stopOpacity=".55" /><stop offset="1" stopColor="#ff6fb5" stopOpacity=".85" /></linearGradient>
        <pattern id="fins" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,0 V6" stroke="#4dd6c4" strokeOpacity=".35" /></pattern>
      </defs>
      {/* кузов вокруг отсека */}
      <rect x="0" y="0" width="800" height="600" fill="url(#bay-floor)" />
      <path d="M0,0 H800 V60 H0 Z" fill="url(#bay-glass)" />
      <path d="M60,46 Q400,20 740,46" stroke="#3de2ff" strokeOpacity=".25" fill="none" />
      <path d="M210,52 L360,30 M430,52 L580,30" stroke="#0a1222" strokeWidth="5" strokeLinecap="round" />
      <rect x="0" y="58" width="800" height="10" fill="#0e1830" />
      <path d="M0,60 H78 Q90,300 70,560 H0 Z" fill="url(#bay-body)" />
      <path d="M800,60 H722 Q710,300 730,560 H800 Z" fill="url(#bay-body)" />
      <path d="M0,560 H800 V600 H0 Z" fill="url(#bay-body)" />
      {[[110, 98], [690, 98]].map(([x, y]) => (
        <g key={x}><circle cx={x} cy={y} r={30} fill="#1a2740" stroke="#2c3b58" /><circle cx={x} cy={y} r={11} fill="#0e1628" />{[0, 120, 240].map((a) => <circle key={a} cx={x + 20 * Math.cos((a * Math.PI) / 180)} cy={y + 20 * Math.sin((a * Math.PI) / 180)} r={3} fill="#5a6d90" />)}</g>
      ))}
      {/* фары */}
      <path d="M78,520 L190,540 L180,575 L72,560 Z" fill="#cfe8ff" opacity=".18" stroke="#9fd8ff" strokeOpacity=".4" />
      <path d="M722,520 L610,540 L620,575 L728,560 Z" fill="#cfe8ff" opacity=".18" stroke="#9fd8ff" strokeOpacity=".4" />

      {/* коробка (под АКБ) */}
      <rect x="548" y="300" width="110" height="110" rx="26" fill="#2a3346" stroke="#3a4b6c" />
      {/* радиатор */}
      {g('radiator', <>
        <rect className="hl" x="150" y="492" width="500" height="40" rx="6" fill="url(#fins)" stroke="#4dd6c4" strokeOpacity=".6" />
        <circle cx="400" cy="470" r="34" fill="#0e1628" stroke="#2c3b58" />
        {[0, 72, 144, 216, 288].map((a) => <path key={a} d="M400,470 c10,-6 22,-10 28,-4 c-6,4 -16,6 -28,4" fill="#5a6d90" transform={`rotate(${a} 400 470)`} />)}
      </>)}
      {/* шланги охлаждения */}
      <path d="M300,392 C270,440 220,450 210,492" stroke="#1c2a44" strokeWidth="12" fill="none" />
      <path d="M520,392 C560,440 590,460 600,492" stroke="#1c2a44" strokeWidth="12" fill="none" />
      <path d="M170,150 C230,150 250,190 280,200" stroke="#1c2a44" strokeWidth="6" fill="none" />

      {/* впуск: дроссель, коллектор */}
      <rect x="280" y="138" width="250" height="48" rx="14" fill="#1b2433" stroke="#2c3b58" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={300 + i * 56} y={176} width={34} height={28} rx={6} fill="#1b2433" stroke="#2c3b58" />)}
      <path d="M246,262 C270,240 262,190 282,168" stroke="#1b2433" strokeWidth="26" fill="none" strokeLinecap="round" />
      <circle cx="270" cy="170" r="18" fill="#232d3f" stroke="#5a6d90" />
      {/* двигатель */}
      <rect x="268" y="196" width="282" height="206" rx="26" fill="url(#bay-cover)" stroke="#3a4458" strokeWidth="2" />
      <path d="M300,330 H520" stroke="#3a4458" strokeWidth="2" />
      <text x="470" y="370" className="mono" style={{ fontSize: 18, fill: '#4a5468', fontWeight: 700, letterSpacing: '.2em' }}>16V</text>
      {/* ремень навесного */}
      <path d="M232,384 C222,410 236,446 264,452 C292,456 300,430 290,410 C282,392 252,372 232,384 Z" fill="none" stroke="#0a0f18" strokeWidth="7" />
      {g('alt', <>
        <circle className="hl" cx="250" cy="395" r="22" fill="#3a4458" stroke="#8fa3c6" />
        {Array.from({ length: 8 }, (_, i) => <line key={i} x1={250} y1={395} x2={250 + 16 * Math.cos(i * 0.785)} y2={395 + 16 * Math.sin(i * 0.785)} stroke="#1b2230" strokeWidth="2.5" />)}
      </>)}
      <circle cx="282" cy="430" r="16" fill="#2a3346" stroke="#5a6d90" />
      {/* щуп масла */}
      {g('dipstick', <><circle className="hl" cx="472" cy="412" r="11" fill="none" stroke="#ffd54a" strokeWidth="5" /><path d="M472,402 V388" stroke="#ffd54a" strokeWidth="3" /></>)}
      {/* маслозаливная крышка */}
      {g('oil', <><circle className="hl" cx="340" cy="262" r="22" fill="#11151d" stroke="#f0a531" strokeWidth="2.5" /><g transform="translate(328 250)" color="#f0a531"><CapIcon kind="oil" size={24} /></g></>)}
      {/* стартер — снизу, показан пунктиром */}
      {g('starter', <><rect className="hl" x="512" y="378" width="66" height="34" rx="12" fill="none" stroke="#ffe45c" strokeDasharray="5 4" strokeOpacity=".7" /><text x="545" y="430" textAnchor="middle" className="svg-label" style={{ fontSize: 9.5 }}>внизу</text></>)}
      {/* щуп АКПП */}
      {g('atf', <><circle className="hl" cx="566" cy="330" r="10" fill="none" stroke="#ff4b5c" strokeWidth="5" /><path d="M566,340 V356" stroke="#ff4b5c" strokeWidth="3" /></>)}
      {/* воздушный фильтр */}
      {g('air', <><rect className="hl" x="146" y="226" width="102" height="112" rx="16" fill="#1b2433" stroke="#5a6d90" />{[0, 1, 2, 3].map((i) => <line key={i} x1={160} x2={234} y1={250 + i * 18} y2={250 + i * 18} stroke="#2c3b58" />)}<rect x="140" y="270" width="10" height="22" rx="3" fill="#5a6d90" /><rect x="244" y="270" width="10" height="22" rx="3" fill="#5a6d90" /></>)}
      {/* бачок антифриза */}
      {g('coolant', <>
        <rect className="hl" x="100" y="120" width="72" height="84" rx="12" fill="rgba(230,240,255,.12)" stroke="#c7d4e8" strokeOpacity=".6" />
        <rect x="104" y="150" width="64" height="50" rx="9" fill="url(#cool-fill)" />
        <line x1="104" x2="122" y1="140" y2="140" stroke="#e8eefa" /><line x1="104" x2="122" y1="178" y2="178" stroke="#e8eefa" />
        <text x="126" y="143" className="mono" style={{ fontSize: 8, fill: '#e8eefa' }}>MAX</text><text x="126" y="181" className="mono" style={{ fontSize: 8, fill: '#e8eefa' }}>MIN</text>
        <circle cx="160" cy="130" r="11" fill="#2a3346" stroke="#ff6fb5" strokeWidth="2" />
      </>)}
      {/* вакуумный усилитель, ГТЦ, бачок тормозной */}
      <circle cx="600" cy="100" r="46" fill="#232d3f" stroke="#3a4b6c" />
      <rect x="586" y="110" width="28" height="70" rx="6" fill="#3a4458" />
      {g('brake', <>
        <rect className="hl" x="562" y="138" width="70" height="42" rx="8" fill="rgba(230,240,255,.14)" stroke="#c7d4e8" strokeOpacity=".6" />
        <rect x="566" y="152" width="62" height="24" rx="5" fill="#d9c27a" opacity=".55" />
        <circle cx="597" cy="140" r="12" fill="#ffd54a" stroke="#c79bff" strokeWidth="2" />
      </>)}
      {/* ЭБУ */}
      {g('ecu', <><rect className="hl" x="640" y="150" width="58" height="40" rx="6" fill="#262f40" stroke="#5a6d90" />{[0, 1, 2].map((i) => <line key={i} x1={648} x2={690} y1={162 + i * 9} y2={162 + i * 9} stroke="#3a4b6c" />)}</>)}
      {/* предохранители */}
      {g('fuses', <><rect className="hl" x="616" y="234" width="80" height="62" rx="8" fill="#141922" stroke="#5a6d90" /><text x="656" y="270" textAnchor="middle" className="mono" style={{ fontSize: 10, fill: '#5a6d90' }}>FUSE</text></>)}
      {/* АКБ */}
      {g('battery', <>
        <rect className="hl" x="600" y="378" width="104" height="94" rx="8" fill="#1d2129" stroke="#5a6d90" strokeWidth="2" />
        <rect x="612" y="388" width="22" height="16" rx="3" fill="#ff4b5c" /><text x="623" y="400" textAnchor="middle" style={{ fontSize: 13, fill: '#fff', fontWeight: 700 }}>+</text>
        <rect x="670" y="388" width="22" height="16" rx="3" fill="#2a2f3a" stroke="#8fa3c6" /><text x="681" y="401" textAnchor="middle" style={{ fontSize: 14, fill: '#e8eefa', fontWeight: 700 }}>−</text>
        <text x="652" y="448" textAnchor="middle" className="mono" style={{ fontSize: 13, fill: '#ffe45c', fontWeight: 700 }}>12V</text>
        <path d="M623,388 C600,360 560,370 548,384" stroke="#ff4b5c" strokeWidth="4" fill="none" />
        <path d="M681,388 C690,350 712,340 722,330" stroke="#0a0f18" strokeWidth="4" fill="none" />
      </>)}
      {/* омыватель */}
      {g('washer', <>
        <path className="hl" d="M96,418 H176 V488 Q176,500 164,500 H108 Q96,500 96,488 Z" fill="rgba(63,180,255,.18)" stroke="#3fb4ff" strokeOpacity=".7" />
        <circle cx="136" cy="432" r="13" fill="#1a4f9a" stroke="#3fb4ff" strokeWidth="2" />
        <g transform="translate(127 423) scale(.75)" color="#cfe8ff"><CapIcon kind="washer" /></g>
      </>)}
      {/* бачок ГУР */}
      {ps && g('ps', <><rect className="hl" x="200" y="424" width="44" height="46" rx="10" fill="rgba(230,240,255,.12)" stroke="#ff8a4c" strokeOpacity=".7" /><circle cx="222" cy="430" r="10" fill="#2a3346" stroke="#ff8a4c" strokeWidth="2" /></>)}

      {/* метки */}
      {open && markers.map((m, i) => {
        const on = sel === m.id;
        return (
          <g key={m.id} className="hit bay-marker" onClick={() => onSelect?.(m.id)} style={{ animationDelay: `${0.4 + i * 0.07}s` }} role="button" aria-label={m.label}>
            <circle cx={m.x} cy={m.y} r={34} fill="transparent" />
            {!on && <circle cx={m.x} cy={m.y} r={16} fill="none" stroke={m.color} strokeWidth="2" className="pulse" />}
            <circle cx={m.x} cy={m.y} r={on ? 17 : 14} fill={on ? m.color : 'rgba(4,8,16,.85)'} stroke={m.color} strokeWidth="2.5" />
            {m.n !== undefined ? <text x={m.x} y={m.y + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: on ? '#04121a' : m.color, fontFamily: 'var(--f-display)' }}>{m.n}</text> : <circle cx={m.x} cy={m.y} r={4} fill={on ? '#04121a' : m.color} />}
          </g>
        );
      })}
      {children}
      {/* капот */}
      <g className="hood" style={{ transformOrigin: '400px 60px', transformBox: 'view-box', transform: open ? 'scaleY(0.035)' : 'none', opacity: open ? 0.6 : 1 }} pointerEvents={open ? 'none' : 'auto'}>
        <path d="M74,60 H726 Q732,320 716,556 Q400,590 84,556 Q68,320 74,60 Z" fill="url(#bay-hood)" stroke="#3de2ff" strokeOpacity=".35" strokeWidth="2" />
        <path d="M250,80 Q400,70 550,80 L560,520 Q400,540 240,520 Z" fill="#fff" opacity=".03" />
        <path d="M400,70 V550" stroke="#3de2ff" strokeOpacity=".12" />
      </g>
    </svg>
  );
}
