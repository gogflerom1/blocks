import { memo } from 'react';
import { mix } from '../../lib/anim';
import { Fuel, PARTS } from '../../content/engine';

/*
  Разрез одного цилиндра. θ — угол цикла 0…720° (0 = ВМТ начала впуска).
  Кинематика честная: положение поршня из длины шатуна и радиуса кривошипа.
  Фазы клапанов с перекрытием: впуск 710°→220°, выпуск 500°→10°.
*/

export const CX = 400, CY = 470, R = 62, L = 165;
const STROKE = 2 * R;
const BORE = 156;
const pinY = (a: number) => CY - (R * Math.cos(a) + Math.sqrt(L * L - R * R * Math.sin(a) ** 2));
export const crownY = (deg: number) => pinY((deg * Math.PI) / 180) - 40;
const CROWN_TDC = CY - (R + L) - 40;
export const deckY = (fuel: Fuel) => CROWN_TDC - STROKE / ((fuel === 'diesel' ? 17 : 10.5) - 1);

const win = (th: number, open: number, dur: number) => {
  const x = (((th - open) % 720) + 720) % 720;
  return x < dur ? Math.sin((Math.PI * x) / dur) : 0;
};
export const liftIn = (th: number) => win(th, 710, 230);
export const liftEx = (th: number) => win(th, 500, 230);

/** Доля хода поршня от ВМТ (0…1) */
const sFrac = (th: number) => (crownY(th) - CROWN_TDC) / STROKE;

/** Давление в цилиндре, бар (упрощённая модель: политропа + сгорание по Вибе) */
export function pressure(th: number, fuel: Fuel) {
  const cr = fuel === 'diesel' ? 17 : 10.5, vc = 1 / (cr - 1);
  const V = (t: number) => vc + sFrac(t);
  const ivc = V(220);
  const t = ((th % 720) + 720) % 720;
  if (t < 220 || t > 700) return 0.9;
  const motored = 0.95 * Math.pow(ivc / V(t), 1.32);
  const s0 = fuel === 'diesel' ? 352 : 345, dur = fuel === 'diesel' ? 60 : 55, q = fuel === 'diesel' ? 1.9 : 2.7;
  const xb = t < s0 ? 0 : 1 - Math.exp(-5 * Math.pow(Math.min(1, (t - s0) / dur), 3));
  const p = motored * (1 + q * xb);
  if (t < 500) return p;
  const pe = 0.95 * Math.pow(ivc / V(500), 1.32) * (1 + q);
  if (t < 570) return 1.1 + (pe - 1.1) * Math.exp(-(t - 500) / 14);
  return 1.1;
}

/** Цвет газа в цилиндре на данном угле */
export function gasColor(th: number, fuel: Fuel): { c: string; o: number } {
  const t = ((th % 720) + 720) % 720;
  const fresh = fuel === 'diesel' ? '#8fd8ff' : '#b9ef6b';
  if (t < 180) return { c: mix('#7d7068', fresh, t / 140), o: 0.35 + 0.25 * (t / 180) };
  if (t < 345) return { c: fuel === 'diesel' ? mix(fresh, '#ffb27a', (t - 180) / 260) : fresh, o: 0.55 + 0.35 * ((t - 180) / 165) };
  if (t < 420) return { c: mix('#fff3c4', '#ff6a3c', (t - 345) / 75), o: 0.95 };
  if (t < 540) return { c: mix('#ff6a3c', '#8a4a3a', (t - 420) / 120), o: 0.85 - 0.25 * ((t - 420) / 120) };
  return { c: mix('#8a5a4a', '#7d7068', (t - 540) / 180), o: 0.55 - 0.2 * ((t - 540) / 180) };
}

function camPath(cx: number, cy: number, noseAng: number) {
  let d = '';
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 12 + 11 * Math.pow(Math.max(0, Math.cos(a - noseAng)), 4);
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}

// псевдослучайные частицы газа
const DOTS = Array.from({ length: 34 }, (_, i) => [((i * 73) % 97) / 97, ((i * 41) % 89) / 89, i]);
const portIn: [number, number][] = [[160, 128], [250, 128], [318, 136], [348, 160], [362, 186]];
const portEx: [number, number][] = [[438, 186], [452, 160], [482, 136], [550, 128], [640, 128]];
const along = (pts: [number, number][], s: number): [number, number] => {
  const n = pts.length - 1, f = Math.min(n - 1e-6, Math.max(0, s * n)), i = Math.floor(f), k = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
};
const pathD = (pts: [number, number][]) => 'M' + pts.map((p) => p.join(',')).join('L');

type Props = { theta: number; fuel: Fuel; time: number; labels?: boolean; sel?: string | null; onPart?: (id: string) => void; throttle?: number; idPrefix?: string };

export const Cylinder = memo(function Cylinder({ theta, fuel, time, labels = true, sel, onPart, throttle = 0.6, idPrefix = 'c' }: Props) {
  const th = ((theta % 720) + 720) % 720;
  const a = (th * Math.PI) / 180;
  const pY = pinY(a);
  const crown = pY - 40;
  const deck = deckY(fuel);
  const pin = [CX + R * Math.sin(a), CY - R * Math.cos(a)];
  const li = liftIn(th), le = liftEx(th);
  const gas = gasColor(th, fuel);
  const vIn = 362, vEx = 438, camY = 60;
  const camAng = (th / 2) * (Math.PI / 180);
  const noseIn = Math.PI / 2 + camAng - (825 / 2) * (Math.PI / 180);
  const noseEx = Math.PI / 2 + camAng - (615 / 2) * (Math.PI / 180);
  const spark = fuel === 'petrol' && th > 340 && th < 352;
  const flameR = fuel === 'petrol' && th >= 346 && th < 420 ? Math.min(90, (th - 346) * 3.2) : 0;
  const inj = fuel === 'diesel' ? th > 346 && th < 378 : li > 0.15 && th < 160;
  const diesFlame = fuel === 'diesel' && th >= 354 && th < 430 ? Math.min(1, (th - 354) / 20) : 0;
  const hit = (id: string) => ({ className: `hit${sel === id ? ' sel' : ''}`, onClick: () => onPart?.(id), role: 'button' as const, 'aria-label': PARTS[id]?.title });
  const gid = (s: string) => `${idPrefix}-${s}`;

  // противовес — сектор напротив шатунной шейки
  const cwA = a + Math.PI;
  const cw = (r: number, span: number) => {
    const p0 = [CX + r * Math.sin(cwA - span), CY - r * Math.cos(cwA - span)];
    const p1 = [CX + r * Math.sin(cwA + span), CY - r * Math.cos(cwA + span)];
    return `M${CX},${CY} L${p0[0]},${p0[1]} A${r},${r} 0 0 1 ${p1[0]},${p1[1]} Z`;
  };
  const rodPoly = () => {
    const dx = CX - pin[0], dy = pY - pin[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const w1 = 16, w2 = 9;
    return `M${pin[0] + nx * w1},${pin[1] + ny * w1} L${CX + nx * w2},${pY + ny * w2} L${CX - nx * w2},${pY - ny * w2} L${pin[0] - nx * w1},${pin[1] - ny * w1} Z`;
  };

  return (
    <svg viewBox="150 14 500 600" className="fig" role="img" aria-label="Разрез цилиндра двигателя">
      <defs>
        <linearGradient id={gid('steel')} x1="0" x2="1"><stop offset="0" stopColor="#2b3a55" /><stop offset=".5" stopColor="#4a5d80" /><stop offset="1" stopColor="#25324a" /></linearGradient>
        <linearGradient id={gid('piston')} x1="0" x2="1"><stop offset="0" stopColor="#7d8ca8" /><stop offset=".45" stopColor="#d6e0ef" /><stop offset="1" stopColor="#6f7e99" /></linearGradient>
        <radialGradient id={gid('flame')}><stop offset="0" stopColor="#fffbe0" /><stop offset=".35" stopColor="#ffd36a" /><stop offset=".8" stopColor="#ff6a3c" stopOpacity=".85" /><stop offset="1" stopColor="#ff3d1f" stopOpacity="0" /></radialGradient>
        <clipPath id={gid('bore')}><rect x={CX - BORE / 2} y={deck} width={BORE} height={Math.max(0, crown - deck)} /></clipPath>
        <filter id={gid('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* картер и поддон */}
      <g {...hit('oil')}>
        <path className="hl" d={`M${CX - 100},430 C${CX - 150},470 ${CX - 150},520 ${CX - 130},548 L${CX + 130},548 C${CX + 150},520 ${CX + 150},470 ${CX + 100},430 Z`} fill="#0c1424" stroke="#2c3b58" strokeWidth="2" />
        <path d={`M${CX - 135},548 L${CX - 125},600 L${CX + 125},600 L${CX + 135},548 Z`} fill="#101a2e" stroke="#2c3b58" strokeWidth="2" />
        <path d={`M${CX - 130},${572 + Math.sin(time * 2) * 1.5} Q${CX},${566 + Math.sin(time * 2.6) * 3} ${CX + 130},${572 - Math.sin(time * 2) * 1.5} L${CX + 125},598 L${CX - 125},598 Z`} fill="#f0a531" opacity=".75" />
      </g>

      {/* блок со стенками цилиндра и рубашкой охлаждения */}
      <g {...hit('block')}>
        <rect className="hl" x={CX - BORE / 2 - 34} y={deck} width={34} height={430 - deck} fill={`url(#${gid('steel')})`} stroke="#3a4b6c" />
        <rect className="hl" x={CX + BORE / 2} y={deck} width={34} height={430 - deck} fill={`url(#${gid('steel')})`} stroke="#3a4b6c" />
      </g>
      <g {...hit('jacket')}>
        <rect x={CX - BORE / 2 - 24} y={deck + 8} width={12} height={170} rx={5} fill="#0e3a52" stroke="#3fb4ff" strokeOpacity=".6" />
        <rect x={CX + BORE / 2 + 12} y={deck + 8} width={12} height={170} rx={5} fill="#0e3a52" stroke="#3fb4ff" strokeOpacity=".6" />
        <path d={`M${CX - BORE / 2 - 18},${deck + 12} v160 M${CX + BORE / 2 + 18},${deck + 172} v-160`} stroke="#3fb4ff" strokeWidth="3" strokeDasharray="4 10" className="flow" style={{ ['--dur' as string]: '1.4s' }} />
      </g>

      {/* газ в цилиндре */}
      <g {...hit('chamber')}>
        <rect x={CX - BORE / 2} y={deck} width={BORE} height={Math.max(0, crown - deck)} fill="#050912" />
        <rect x={CX - BORE / 2} y={deck} width={BORE} height={Math.max(0, crown - deck)} fill={gas.c} opacity={gas.o * 0.55} />
        <g clipPath={`url(#${gid('bore')})`}>
          {DOTS.map(([fx, fy, i]) => {
            const x = CX - BORE / 2 + 6 + fx * (BORE - 12) + Math.sin(time * 3 + i) * 3;
            const y = deck + 4 + ((fy + (th < 180 ? -th / 400 : 0)) % 1 + 1) % 1 * Math.max(1, crown - deck - 8);
            return <circle key={i} cx={x} cy={y} r={2.2} fill={gas.c} opacity={0.9} />;
          })}
          {flameR > 0 && <circle cx={CX} cy={deck + 4} r={flameR * 1.4} fill={`url(#${gid('flame')})`} opacity={th < 400 ? 1 : 1 - (th - 400) / 20} />}
          {diesFlame > 0 && [-0.9, -0.35, 0.35, 0.9].map((k) => (
            <ellipse key={k} cx={CX + k * 52} cy={deck + 20 + Math.abs(k) * 10} rx={18 + diesFlame * 26} ry={12 + diesFlame * 14} fill={`url(#${gid('flame')})`} opacity={th < 410 ? diesFlame : Math.max(0, 1 - (th - 410) / 20)} />
          ))}
          {fuel === 'diesel' && th > 346 && th < 378 && [-0.9, -0.35, 0.35, 0.9].map((k) => (
            <path key={k} d={`M${CX},${deck + 2} L${CX + k * 60},${deck + 26 + Math.abs(k) * 8}`} stroke="#ffd54a" strokeWidth={4} strokeLinecap="round" opacity={0.9} strokeDasharray="3 4" />
          ))}
        </g>
      </g>

      {/* коленвал: противовес, щека, шатунная шейка */}
      <g {...hit('counter')}>
        <path className="hl" d={cw(58, 1.0)} fill="#3a4a69" stroke="#5d7298" strokeWidth="1.5" />
      </g>
      <g {...hit('crank')}>
        <circle className="hl" cx={CX} cy={CY} r={26} fill="#5a6d90" stroke="#8fa3c6" strokeWidth="1.5" />
        <path d={`M${CX},${CY} L${pin[0]},${pin[1]}`} stroke="#6d80a3" strokeWidth={34} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={9} fill="#1a2438" />
      </g>

      {/* шатун */}
      <g {...hit('rod')}>
        <path className="hl" d={rodPoly()} fill="#8da0bf" stroke="#c4d2e8" strokeWidth="1.2" />
        <circle cx={pin[0]} cy={pin[1]} r={20} fill="#9fb1cd" stroke="#dce6f5" strokeWidth="1.2" />
        <circle cx={pin[0]} cy={pin[1]} r={9} fill="#2a3650" />
        <circle cx={CX} cy={pY} r={12} fill="#9fb1cd" stroke="#dce6f5" />
      </g>

      {/* поршень */}
      <g {...hit('piston')}>
        <path className="hl" d={`M${CX - BORE / 2 + 2},${crown} h${BORE - 4} v86 q-6,10 -16,10 h${-(BORE - 36)} q-10,0 -16,-10 Z`} fill={`url(#${gid('piston')})`} stroke="#e6eefb" strokeWidth="1.2" />
        <circle cx={CX} cy={pY} r={9} fill="#3a4a69" stroke="#e6eefb" />
      </g>
      <g {...hit('rings')}>
        {[8, 18, 30].map((dy, i) => <rect key={i} className={i === 0 ? 'hl' : ''} x={CX - BORE / 2 + 2} y={crown + dy} width={BORE - 4} height={i === 2 ? 5 : 3.5} fill={i === 2 ? '#f0a531' : '#2b3550'} opacity={0.9} />)}
      </g>

      {/* головка блока */}
      <g {...hit('head')}>
        <path className="hl" d={`M200,100 H600 V${deck} H${CX + BORE / 2 + 34} V${deck - 4} H${CX - BORE / 2 - 34} V${deck} H200 Z`} fill={`url(#${gid('steel')})`} stroke="#3a4b6c" />
      </g>
      {/* впуск */}
      <g {...hit('intake')}>
        <path className="hl" d={pathD(portIn)} stroke="#0a1222" strokeWidth={34} fill="none" strokeLinejoin="round" />
        <path d={pathD(portIn)} stroke={fuel === 'diesel' ? '#8fd8ff' : '#8fd8ff'} strokeOpacity=".08" strokeWidth={30} fill="none" strokeLinejoin="round" />
        {Array.from({ length: 16 }, (_, i) => {
          const s = (i / 16 + time * 0.35 * (li + 0.02)) % 1;
          const [x, y] = along(portIn, s);
          const c = fuel === 'petrol' && x > 312 ? '#b9ef6b' : '#8fd8ff';
          return <circle key={i} cx={x} cy={y + Math.sin(i * 2.1) * 7} r={2.6} fill={c} opacity={li > 0.02 || th > 600 ? 0.95 : 0.4} />;
        })}
      </g>
      <g {...hit('exhaust')}>
        <path className="hl" d={pathD(portEx)} stroke="#0a1222" strokeWidth={34} fill="none" strokeLinejoin="round" />
        {Array.from({ length: 16 }, (_, i) => {
          const s = (i / 16 + time * 0.45 * (le + 0.02)) % 1;
          const [x, y] = along(portEx, s);
          return <circle key={i} cx={x} cy={y + Math.sin(i * 1.7) * 7} r={2.8} fill={mix('#ff7a45', '#8a7d74', s)} opacity={le > 0.02 ? 0.95 : 0.35} />;
        })}
      </g>
      {/* дроссель (только бензин) */}
      {fuel === 'petrol' && (
        <g {...hit('throttle')}>
          <circle cx={226} cy={128} r={17} fill="none" stroke="#3a4b6c" strokeWidth="2" />
          <line className="hl" x1={226 - 15 * Math.cos(1.4 - throttle * 1.2)} y1={128 - 15 * Math.sin(1.4 - throttle * 1.2)} x2={226 + 15 * Math.cos(1.4 - throttle * 1.2)} y2={128 + 15 * Math.sin(1.4 - throttle * 1.2)} stroke="#c7d4e8" strokeWidth="4" strokeLinecap="round" />
          <circle cx={226} cy={128} r={3} fill="#c7d4e8" />
        </g>
      )}

      {/* клапанная крышка (фон) */}
      <path d="M210,100 V34 Q210,22 222,22 H578 Q590,22 590,34 V100 Z" fill="#0d1628" stroke="#2c3b58" />
      {/* клапаны, пружины, распредвалы */}
      {([['valveIn', vIn, li, 'camIn', noseIn], ['valveEx', vEx, le, 'camEx', noseEx]] as const).map(([vid, x, lift, cid, nose]) => {
        const off = lift * 20;
        return (
          <g key={vid}>
            <g {...hit('spring')}>
              <path d={Array.from({ length: 9 }, (_, i) => `${i ? 'L' : 'M'}${x + (i % 2 ? 9 : -9)},${80 + off + i * ((20 - off) / 8)}`).join('')} stroke="#8ef06a" strokeWidth="2" fill="none" />
            </g>
            <g {...hit(vid)}>
              <rect x={x - 2.5} y={78 + off} width={5} height={102} fill="#c7d4e8" />
              <path className="hl" d={`M${x - 3},${180 + off} L${x - 17},${deck - 1 + off} L${x + 17},${deck - 1 + off} L${x + 3},${180 + off} Z`} fill={lift > 0.02 ? '#e9f0fb' : '#aab8cf'} stroke="#e6eefb" strokeWidth="1" />
              <rect x={x - 10} y={74 + off} width={20} height={6} rx={2} fill="#9fb1cd" />
            </g>
            <g {...hit(cid)}>
              <path className="hl" d={camPath(x, camY - 2, nose)} fill={vid === 'valveIn' ? '#3d6a9a' : '#9a5a3d'} stroke="#e6eefb" strokeWidth="1" />
              <circle cx={x} cy={camY - 2} r={4} fill="#0a1222" />
            </g>
          </g>
        );
      })}

      {/* свеча / форсунки */}
      {fuel === 'petrol' ? (
        <>
          <g {...hit('plug')}>
            <rect className="hl" x={CX - 7} y={40} width={14} height={deck - 52} rx={3} fill="#dfe7f3" stroke="#fff" strokeWidth=".8" />
            <rect x={CX - 9} y={40} width={18} height={30} rx={3} fill="#5a6d90" />
            <rect x={CX - 3} y={deck - 12} width={6} height={10} fill="#8fa3c6" />
            {spark && <g filter={`url(#${gid('glow')})`}><path d={`M${CX},${deck - 2} l-6,8 l7,2 l-5,9`} stroke="#fff" strokeWidth="2.5" fill="none" /><circle cx={CX} cy={deck + 5} r={9} fill="#bfeaff" opacity=".7" /></g>}
          </g>
          <g {...hit('injP')}>
            <path className="hl" d="M286,78 L310,118 L316,114 L292,74 Z" fill="#c7d4e8" stroke="#fff" strokeWidth=".8" />
            <rect x={276} y={60} width={18} height={20} rx={3} transform="rotate(-30 285 70)" fill="#ffd54a" />
            {inj && <path d="M313,118 l14,26 M313,118 l22,18 M313,118 l6,28" stroke="#ffd54a" strokeWidth="2.5" strokeDasharray="2 3" strokeLinecap="round" />}
          </g>
        </>
      ) : (
        <>
          <g {...hit('injD')}>
            <rect className="hl" x={CX - 7} y={36} width={14} height={deck - 40} rx={3} fill="#c7d4e8" stroke="#fff" strokeWidth=".8" />
            <rect x={CX - 10} y={34} width={20} height={26} rx={3} fill="#ffd54a" />
            {inj && <circle cx={CX} cy={deck} r={5} fill="#ffd54a" filter={`url(#${gid('glow')})`} />}
          </g>
          <g {...hit('glow')}>
            <path className="hl" d={`M418,92 L${CX + 12},${deck - 4} L${CX + 18},${deck - 6} L424,90 Z`} fill="#c7d4e8" stroke="#fff" strokeWidth=".8" />
            <circle cx={CX + 15} cy={deck - 4} r={3.5} fill={th < 60 ? '#ff6a3c' : '#5a6d90'} />
          </g>
        </>
      )}


      {labels && (
        <g className="svg-label" pointerEvents="none">
          <text x={168} y={112}>{fuel === 'petrol' ? 'ВПУСК · смесь' : 'ВПУСК · воздух'}</text>
          <text x={632} y={112} textAnchor="end">ВЫПУСК</text>
          <text x={168} y={300} fill="#8fd8ff">цилиндр</text>
          <text x={632} y={300} textAnchor="end" fill="#3fb4ff">антифриз</text>
          <text x={632} y={470} textAnchor="end">коленвал</text>
          <text x={632} y={590} textAnchor="end" fill="#f0a531">масло</text>

        </g>
      )}
    </svg>
  );
});
