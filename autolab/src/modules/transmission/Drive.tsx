import { useRef, useState } from 'react';
import { clamp, useTicker } from '../../lib/anim';
import { Particles, Pt } from '../../lib/path';
import { DRIVE } from '../../content/transmission';
import { Callout, Chain, HoldButton, Range, Seg, Stage } from '../../ui/kit';

type Layout = 'fwd' | 'rwd' | 'awd';
const WF = 150, WRr = 490, XL = 92, XR = 308;
const PATHS: Record<Layout, Pt[][]> = {
  fwd: [[[200, 128], [140, 140]], [[140, 140], [140, 168]], [[140, 168], [XL + 8, WF], [XL, WF]], [[150, 168], [XR - 8, WF], [XR, WF]]],
  rwd: [[[200, 110], [200, 210]], [[200, 210], [200, 270]], [[200, 270], [200, 470]], [[200, 490], [XL + 6, WRr]], [[200, 490], [XR - 6, WRr]]],
  awd: [[[200, 128], [140, 140]], [[140, 140], [150, 172]], [[150, 172], [200, 182], [200, 440]], [[200, 440], [200, 486]], [[140, 168], [XL, WF]], [[150, 168], [XR, WF]], [[200, 490], [XL, WRr]], [[200, 490], [XR, WRr]]],
};
const STEP_OF: Record<Layout, number[]> = { fwd: [0, 2, 3, 4], rwd: [0, 2, 3, 5, 5], awd: [0, 1, 3, 4, 6, 6, 6, 6] };
const DRIVEN: Record<Layout, ('fl' | 'fr' | 'rl' | 'rr')[]> = { fwd: ['fl', 'fr'], rwd: ['rl', 'rr'], awd: ['fl', 'fr', 'rl', 'rr'] };

function CarTop({ layout, prog, spin }: { layout: Layout; prog: number; spin: number }) {
  const driven = DRIVEN[layout];
  const on = (k: number) => prog > STEP_OF[layout][k];
  const wheel = (id: 'fl' | 'fr' | 'rl' | 'rr', x: number, y: number) => {
    const d = driven.includes(id);
    const lit = d && prog >= Math.max(...STEP_OF[layout]) + 0.5;
    const off = ((spin * (d ? 1 : 0.95)) % 12 + 12) % 12;
    return (
      <g key={id}>
        <rect x={x - 14} y={y - 36} width={28} height={72} rx={8} fill="#1b2230" stroke={lit ? '#3de2ff' : d ? '#5a6d90' : '#2c3b58'} strokeWidth={lit ? 2.5 : 1.5} style={lit ? { filter: 'drop-shadow(0 0 8px #3de2ff)' } : undefined} />
        <clipPath id={`tw${id}`}><rect x={x - 14} y={y - 36} width={28} height={72} rx={8} /></clipPath>
        <g clipPath={`url(#tw${id})`}>{Array.from({ length: 8 }, (_, i) => <line key={i} x1={x - 14} x2={x + 14} y1={y - 42 + i * 12 + off} y2={y - 42 + i * 12 + off} stroke="#5a6d90" strokeWidth={2.5} />)}</g>
        {d && <text x={x} y={y + 52} textAnchor="middle" className="svg-label" style={{ fill: lit ? '#3de2ff' : undefined, fontSize: 10 }}>ведущее</text>}
      </g>
    );
  };
  const body = (
    <path d="M200,22 C270,22 318,40 322,96 L330,520 C330,590 300,618 200,618 C100,618 70,590 70,520 L78,96 C82,40 130,22 200,22 Z" fill="rgba(61,226,255,.04)" stroke="#3de2ff" strokeOpacity=".35" strokeWidth={2} />
  );
  return (
    <svg viewBox="40 10 320 630" className="fig" style={{ maxHeight: 620 }}>
      {body}
      <path d="M110,230 Q200,205 290,230 L282,300 Q200,288 118,300 Z" fill="rgba(61,226,255,.06)" stroke="#3de2ff" strokeOpacity=".25" />
      <text x={200} y={44} textAnchor="middle" className="svg-label">ПЕРЕД ↑</text>
      {wheel('fl', XL, WF)}{wheel('fr', XR, WF)}{wheel('rl', XL, WRr)}{wheel('rr', XR, WRr)}
      {layout === 'rwd' ? (
        <>
          <rect x={168} y={70} width={64} height={136} rx={10} fill="#2a1a14" stroke="#ff8a4c" strokeOpacity={on(0) ? 1 : 0.5} />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={200} cy={88 + i * 30} r={10} fill="none" stroke="#ff8a4c" strokeOpacity=".5" />)}
          <rect x={178} y={208} width={44} height={64} rx={8} fill="#13283f" stroke="#5aa8ff" strokeOpacity={on(1) ? 1 : 0.5} />
          <text x={232} y={244} className="svg-label">коробка</text>
          <line x1={200} x2={200} y1={272} y2={474} stroke={on(2) ? '#3de2ff' : '#5a6d90'} strokeWidth={8} />
          <text x={210} y={380} className="svg-label">кардан</text>
          <circle cx={200} cy={490} r={20} fill="#13283f" stroke={on(3) ? '#3de2ff' : '#5aa8ff'} strokeWidth={2} />
          <line x1={XL + 14} x2={180} y1={WRr} y2={WRr} stroke={on(3) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
          <line x1={220} x2={XR - 14} y1={WRr} y2={WRr} stroke={on(4) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
          <line x1={XL + 14} x2={XR - 14} y1={WF} y2={WF} stroke="#2c3b58" strokeWidth={3} strokeDasharray="4 6" />
        </>
      ) : (
        <>
          <rect x={150} y={96} width={120} height={64} rx={10} fill="#2a1a14" stroke="#ff8a4c" strokeOpacity={on(0) ? 1 : 0.5} />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={170 + i * 27} cy={128} r={10} fill="none" stroke="#ff8a4c" strokeOpacity=".5" />)}
          <rect x={112} y={110} width={40} height={66} rx={8} fill="#13283f" stroke="#5aa8ff" strokeOpacity={on(1) ? 1 : 0.5} />
          <text x={132} y={196} textAnchor="middle" className="svg-label" style={{ fontSize: 10 }}>коробка</text>
          <line x1={XL + 14} x2={130} y1={WF} y2={WF} stroke={on(2) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
          <line x1={150} x2={XR - 14} y1={WF + 18} y2={WF + 18} stroke={on(layout === 'awd' ? 5 : 3) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
          <line x1={XR - 14} x2={XR - 30} y1={WF} y2={WF + 18} stroke={on(layout === 'awd' ? 5 : 3) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
          {layout === 'awd' ? (
            <>
              <rect x={150} y={168} width={34} height={26} rx={6} fill="#13283f" stroke={on(1) ? '#3de2ff' : '#5aa8ff'} />
              <line x1={200} x2={200} y1={190} y2={440} stroke={on(2) ? '#3de2ff' : '#5a6d90'} strokeWidth={7} />
              <rect x={184} y={440} width={32} height={26} rx={6} fill="#13283f" stroke={on(3) ? '#ffb547' : '#5aa8ff'} />
              <text x={224} y={458} className="svg-label">муфта</text>
              <circle cx={200} cy={490} r={18} fill="#13283f" stroke={on(4) ? '#3de2ff' : '#5aa8ff'} strokeWidth={2} />
              <line x1={XL + 14} x2={182} y1={WRr} y2={WRr} stroke={on(6) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
              <line x1={218} x2={XR - 14} y1={WRr} y2={WRr} stroke={on(7) ? '#3de2ff' : '#5a6d90'} strokeWidth={6} />
              <text x={210} y={320} className="svg-label">кардан</text>
            </>
          ) : (
            <line x1={XL + 14} x2={XR - 14} y1={WRr} y2={WRr} stroke="#2c3b58" strokeWidth={3} strokeDasharray="4 6" />
          )}
        </>
      )}
      {PATHS[layout].map((p, k) => prog > STEP_OF[layout][k] && <Particles key={k} pts={p} phase={spin * 0.02 + k * 0.1} n={4} color="#3de2ff" r={3.4} />)}
    </svg>
  );
}

export function Drive() {
  const [layout, setLayout] = useState<Layout>('fwd');
  const [gas, setGas] = useState(false);
  const s = useRef({ prog: 0, spin: 0 });
  const [, force] = useState(0);
  const d = DRIVE[layout];
  useTicker((dt) => {
    const st = s.current;
    st.prog = gas ? Math.min(d.chain.length + 0.5, st.prog + dt * 2.2) : Math.max(0, st.prog - dt * 6);
    if (gas && st.prog > d.chain.length - 0.5) st.spin += dt * 80;
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  return (
    <div className="split">
      <Stage label={<>FIG. 14 — <b>{d.title}</b> · вид сверху</>}>
        <CarTop layout={layout} prog={st.prog} spin={st.spin} />
        <div className="stage-ctl">
          <Seg value={layout} onChange={(v) => { setLayout(v); s.current.prog = 0; }} options={[{ v: 'fwd', l: 'FWD' }, { v: 'rwd', l: 'RWD' }, { v: 'awd', l: 'AWD' }]} mono />
          <HoldButton className="btn primary" onHold={setGas}>Газ (держать)</HoldButton>
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <span className="eyebrow">Путь мощности</span>
          <Chain items={d.chain} active={Math.floor(st.prog) - 1} />
        </div>
        <Callout kind="info">{d.text}</Callout>
        <p className="muted" style={{ fontSize: 13 }}>Полный привод бывает и с продольным мотором и раздаточной коробкой — у рамных внедорожников и многих премиальных седанов.</p>
      </div>
    </div>
  );
}

/* ── Дифференциал ─────────────────────── */
export function Differential() {
  const [radius, setRadius] = useState(12);
  const [ice, setIce] = useState(false);
  const s = useRef({ l: 0, r: 0, c: 0, sp: 0 });
  const [, force] = useState(0);
  const track = 1.5;
  const straight = radius >= 60;
  const R = straight ? 1e9 : radius;
  const base = 1;
  let wl = base * (R + track / 2) / R, wr = base * (R - track / 2) / R; // поворот направо: левое — внешнее
  if (ice) { wl = 2 * base; wr = 0; }
  const wc = (wl + wr) / 2;
  useTicker((dt) => {
    const st = s.current;
    st.l += wl * dt * 3; st.r += wr * dt * 3; st.c += wc * dt * 3; st.sp += (wl - wr) * dt * 3 * 1.6;
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const stripe = (x: number, y: number, w: number, h: number, t: number, horiz = false) => {
    const off = (((t * 20) % 10) + 10) % 10;
    return (
      <g>
        <clipPath id={`d${x}${y}`}><rect x={x} y={y} width={w} height={h} /></clipPath>
        <g clipPath={`url(#d${x}${y})`}>{Array.from({ length: Math.ceil((horiz ? w : h) / 10) + 2 }, (_, i) => horiz
          ? <line key={i} x1={x + i * 10 - off} x2={x + i * 10 - off} y1={y} y2={y + h} stroke="#0a1222" strokeWidth={2} />
          : <line key={i} x1={x} x2={x + w} y1={y + i * 10 - off} y2={y + i * 10 - off} stroke="#0a1222" strokeWidth={2} />)}</g>
      </g>
    );
  };
  return (
    <div className="stack">
      <div className="split">
        <Stage label={<>FIG. 15 — <b>Дифференциал</b> · поворот направо</>}>
          <svg viewBox="0 0 600 380" className="fig">
            {/* вид сверху: траектории колёс */}
            <g transform="translate(150 330)">
              {(() => {
                const Rpx = straight ? 1e6 : radius * 60;
                const arc = (x0: number, c: string) => {
                  const r = Rpx - x0, th = Math.min(Math.PI / 2, 290 / r);
                  const ex = Rpx - r * Math.cos(th), ey = -r * Math.sin(th);
                  return straight
                    ? <line x1={x0} x2={x0} y1={0} y2={-290} stroke={c} strokeWidth={3} strokeDasharray="6 5" />
                    : <path d={`M${x0},0 A${r},${r} 0 0 1 ${ex.toFixed(1)},${ey.toFixed(1)}`} fill="none" stroke={c} strokeWidth={3} strokeDasharray="6 5" />;
                };
                return <>{arc(-48, '#ff8a4c')}{arc(48, '#36e0a0')}</>;
              })()}
              <rect x={-60} y={-20} width={120} height={40} rx={10} fill="#13203a" stroke="#3de2ff" strokeOpacity=".5" />
              <rect x={-58} y={-14} width={20} height={28} rx={4} fill="#1b2230" stroke="#ff8a4c" />
              <rect x={38} y={-14} width={20} height={28} rx={4} fill={ice ? '#9fd8ff' : '#1b2230'} stroke="#36e0a0" />
              <text x={-48} y={36} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>внешнее</text>
              <text x={48} y={36} textAnchor="middle" className="svg-label" style={{ fill: '#36e0a0' }}>{ice ? 'на льду' : 'внутреннее'}</text>
            </g>
            {/* схема дифференциала */}
            <g transform="translate(300 40)">
              <rect x={0} y={0} width={290} height={210} rx={14} fill="#0b1426" stroke="#2c3b58" />
              <rect x={6} y={95} width={70} height={20} fill="#ff8a4c" opacity=".85" />
              {stripe(6, 95, 70, 20, st.l, true)}
              <rect x={214} y={95} width={70} height={20} fill="#36e0a0" opacity=".85" />
              {stripe(214, 95, 70, 20, st.r, true)}
              <rect x={80} y={20} width={130} height={170} rx={10} fill="none" stroke="#5aa8ff" strokeWidth={3} />
              <rect x={190} y={20} width={22} height={170} rx={4} fill="#13283f" stroke="#5aa8ff" />
              {stripe(190, 20, 22, 170, st.c)}
              <text x={201} y={14} textAnchor="middle" className="svg-label" style={{ fill: '#5aa8ff' }}>ведомая шестерня</text>
              <rect x={76} y={60} width={16} height={90} rx={3} fill="#ff8a4c" />
              <rect x={178} y={60} width={16} height={90} rx={3} fill="#36e0a0" />
              <line x1={135} x2={135} y1={40} y2={170} stroke="#8fa3c6" strokeWidth={6} />
              {[52, 158].map((cy, k) => (
                <g key={cy}>
                  <circle cx={135} cy={cy} r={22} fill="#1e2c47" stroke="#c7d4e8" strokeWidth={2} />
                  <line x1={135} y1={cy} x2={135 + 18 * Math.cos(st.sp * (k ? -1 : 1))} y2={cy + 18 * Math.sin(st.sp * (k ? -1 : 1))} stroke="#ffb547" strokeWidth={3} />
                </g>
              ))}
              <text x={135} y={204} textAnchor="middle" className="svg-label">сателлиты {Math.abs(wl - wr) > 0.01 ? 'вращаются' : 'стоят'}</text>
            </g>
          </svg>
          <div className="stage-ctl">
            <button className={`btn${ice ? ' on' : ''}`} onClick={() => setIce(!ice)}>Колесо на льду</button>
          </div>
        </Stage>
        <div className="stack">
          <div className="panel">
            <Range id="diff-r" label="Радиус поворота" value={radius} min={5} max={60} onChange={(v) => { setRadius(v); setIce(false); }} fmt={(v) => (v >= 60 ? 'прямо' : `${v} м`)} />
            <div className="stack" style={{ marginTop: 12, gap: 8 }}>
              {[{ l: 'Внешнее колесо', v: wl, c: '#ff8a4c' }, { l: 'Корпус дифференциала', v: wc, c: '#5aa8ff' }, { l: ice ? 'Колесо на льду' : 'Внутреннее колесо', v: wr, c: '#36e0a0' }].map((x) => (
                <div className="meter" key={x.l}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span>{x.l}</span><b className="mono">{Math.round(x.v * 100)}%</b></div>
                  <div className="bar"><i style={{ width: `${clamp(x.v / 2) * 100}%`, background: x.c }} /></div>
                </div>
              ))}
            </div>
          </div>
          {ice ? (
            <Callout kind="warn">Обычный (свободный) дифференциал делит момент поровну. Колесу на льду хватает чуть-чуть — значит и второе получает чуть-чуть. Одно колесо крутится вдвое быстрее, машина стоит. Спасают блокировки и электроника, подтормаживающая буксующее колесо.</Callout>
          ) : (
            <Callout kind="info">В повороте внешнее колесо проходит длинную дугу, внутреннее — короткую. Сателлиты проворачиваются на своей оси и позволяют колёсам вращаться с разной скоростью. Средняя скорость колёс всегда равна скорости корпуса.</Callout>
          )}
        </div>
      </div>
    </div>
  );
}
