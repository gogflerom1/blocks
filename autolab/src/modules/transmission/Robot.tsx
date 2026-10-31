import { useRef, useState } from 'react';
import { clamp, useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { Callout, Seg, Stage } from '../../ui/kit';

/** Лента «тяга на колёсах во времени» — видно провалы при переключении */
export function TorqueTrace({ data, color = '#3de2ff', label = 'тяга на колёсах' }: { data: number[]; color?: string; label?: string }) {
  const W = 360, H = 90;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - 10 - clamp(v) * (H - 24)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="График тяги">
      <line x1={0} x2={W} y1={H - 10} y2={H - 10} stroke="rgba(130,175,255,.2)" />
      <polyline points={`0,${H - 10} ${pts} ${W},${H - 10}`} fill={color} fillOpacity=".12" stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />
      <text x={4} y={12} className="svg-label" style={{ fontSize: 10 }}>{label} · последние 6 с</text>
    </svg>
  );
}
function useTrace() {
  const buf = useRef<number[]>(Array(180).fill(0.6));
  const acc = useRef(0);
  return {
    data: buf.current,
    push(v: number, dt: number) { acc.current += dt; while (acc.current > 1 / 30) { acc.current -= 1 / 30; buf.current.push(v); buf.current.shift(); } },
  };
}

/* ── DCT ─────────────────────────────── */
const DR = { 1: 3.76, 2: 2.27, 3: 1.53, 4: 1.12, 5: 0.89, 6: 0.74, 7: 0.62 } as Record<number, number>;
const C = 140, YI = 170, YO = 320;
const DX: Record<number, number> = { 2: 190, 4: 260, 6: 330, 1: 470, 3: 540, 5: 610, 7: 680 };
const SL: { id: string; x: number; a: number; b: number }[] = [
  { id: 'e1', x: 225, a: 2, b: 4 }, { id: 'e2', x: 365, a: 6, b: 0 }, { id: 'o1', x: 505, a: 1, b: 3 }, { id: 'o2', x: 645, a: 5, b: 7 },
];
const DCT_INFO: Record<string, [string, string]> = {
  k1: ['Сцепление K1 — нечётные', 'Передаёт момент на внутренний вал с передачами 1, 3, 5, 7. Сцепления бывают сухие (небольшие моторы) и мокрые — в масле, выдерживают больший момент.'],
  k2: ['Сцепление K2 — чётные', 'Передаёт момент на внешний полый вал с передачами 2, 4, 6 и задним ходом (на разных коробках R может быть на любом из валов).'],
  shafts: ['Два первичных вала', 'Один внутри другого: внутренний сплошной — для нечётных передач, внешний полый — для чётных. Фактически две механические коробки в одном корпусе.'],
  mech: ['Мехатроник', 'Блок управления с гидравликой: решает, какую передачу подготовить, двигает муфты и управляет сцеплениями. Самая дорогая и капризная часть DSG.'],
};

function DCT() {
  const info = useInfo();
  const s = useRef({ g: 1, pre: 2, t: 1, sleeves: { e1: -1, e2: 0, o1: -1, o2: 0 } as Record<string, number>, ang: 0, auto: false, autoT: 0 });
  const [, force] = useState(0);
  const tr = useTrace();
  const target = (gear: number, id: string) => { const sl = SL.find((x) => x.id === id)!; return sl.a === gear ? -1 : sl.b === gear ? 1 : 0; };
  useTicker((dt) => {
    const st = s.current;
    if (st.t < 1) {
      st.t = Math.min(1, st.t + dt / 0.35);
      if (st.t >= 1) { st.g = st.pre; st.pre = Math.min(7, st.g + 1); }
    }
    for (const sl of SL) {
      const want = st.t < 1 ? target(st.g, sl.id) || target(st.pre, sl.id) : target(st.g, sl.id) || target(st.pre, sl.id);
      st.sleeves[sl.id] += (want - st.sleeves[sl.id]) * Math.min(1, dt * 8);
    }
    if (st.auto) {
      st.autoT += dt;
      if (st.autoT > 1.3 && st.t >= 1 && st.g < 7) { st.autoT = 0; shift(1); }
      if (st.g >= 7) st.auto = false;
    }
    st.ang += dt * 3;
    const torque = st.t < 1 ? 0.92 - 0.08 * Math.sin(Math.max(0, st.t) * Math.PI) : 0.95;
    tr.push(torque * (1.1 - st.g * 0.08), dt);
    force((n) => (n + 1) % 1e6);
  });
  const shift = (dir: 1 | -1) => {
    const st = s.current;
    if (st.t < 1) return;
    const next = st.g + dir;
    if (next < 1 || next > 7) return;
    // вниз: сначала блок перекладывает подготовленную передачу (на другом валу стояла следующая вверх)
    st.t = next === st.pre ? 0 : -0.7;
    st.pre = next;
  };
  const st = s.current;
  const odd = (n: number) => n % 2 === 1;
  const tt = Math.max(0, st.t);
  const kOdd = st.t < 1 ? (odd(st.g) ? 1 - tt : tt) : odd(st.g) ? 1 : 0;
  const kEven = 1 - kOdd;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: DCT_INFO[id][0], text: DCT_INFO[id][1], kicker: 'DSG / DCT', color: '#5aa8ff' }) });
  const gearRect = (n: number) => {
    const r = DR[n], r1 = C / (1 + r), r2 = (C * r) / (1 + r), x = DX[n];
    const on = n === st.g || (st.t < 1 && n === st.pre);
    const ready = n === st.pre && st.t >= 1;
    const c = on ? '#3de2ff' : ready ? '#ffb547' : '#5a6d90';
    return (
      <g key={n}>
        <rect x={x - 9} y={YI - r1} width={18} height={r1 * 2} rx={3} fill={on ? '#16405e' : '#1e2c47'} stroke={c} strokeWidth={on || ready ? 2 : 1} />
        <rect x={x - 9} y={YO - r2} width={18} height={r2 * 2} rx={3} fill={on ? '#16405e' : '#1a2740'} stroke={c} strokeWidth={on || ready ? 2 : 1} />
        <text x={x} y={YI - r1 - 8} textAnchor="middle" className="mono" style={{ fontSize: 13, fontWeight: 700, fill: c }}>{n}</text>
      </g>
    );
  };
  return (
    <div className="split">
      <Stage label={<>FIG. 11 — <b>DSG / DCT</b> · 7 передач, схема упрощена</>} hint="нажмите на узел">
        <div className="wide-wrap"><svg viewBox="0 0 760 440" className="fig">
          <rect x={10} y={110} width={60} height={130} rx={10} fill="#2a1a14" stroke="#ff8a4c" strokeOpacity=".6" />
          <text x={40} y={180} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>мотор</text>
          <g {...hit('k1')}>
            <rect className="hl" x={84} y={90} width={14} height={170} rx={4} fill={kOdd > 0.5 ? '#3de2ff' : '#2a3650'} opacity={0.4 + kOdd * 0.6} />
            <text x={91} y={80} textAnchor="middle" className="mono" style={{ fontSize: 11, fill: '#3de2ff' }}>K1</text>
          </g>
          <g {...hit('k2')}>
            <rect className="hl" x={106} y={104} width={14} height={142} rx={4} fill={kEven > 0.5 ? '#ffb547' : '#2a3650'} opacity={0.4 + kEven * 0.6} />
            <text x={113} y={276} textAnchor="middle" className="mono" style={{ fontSize: 11, fill: '#ffb547' }}>K2</text>
          </g>
          <g {...hit('shafts')}>
            <line className="hl" x1={98} x2={720} y1={YI} y2={YI} stroke={kOdd > 0.5 ? '#3de2ff' : '#8fa3c6'} strokeWidth={6} />
            <line x1={120} x2={400} y1={YI} y2={YI} stroke={kEven > 0.5 ? '#ffb547' : '#5a6d90'} strokeWidth={18} strokeOpacity=".55" />
            <text x={260} y={YI + 30} textAnchor="middle" className="svg-label" style={{ fill: '#ffb547' }}>полый вал · 2 4 6</text>
            <text x={575} y={YI + 30} textAnchor="middle" className="svg-label" style={{ fill: '#3de2ff' }}>внутренний вал · 1 3 5 7</text>
          </g>
          <line x1={150} x2={730} y1={YO} y2={YO} stroke="#8fa3c6" strokeWidth={7} />
          {[2, 4, 6, 1, 3, 5, 7].map(gearRect)}
          {SL.map((sl) => (
            <g key={sl.id}>
              <rect x={sl.x - 11 + st.sleeves[sl.id] * 18} y={YO - 30} width={22} height={60} rx={4} fill={Math.abs(st.sleeves[sl.id]) > 0.6 ? '#c7d4e8' : '#5a6d90'} />
            </g>
          ))}
          <text x={392} y={YO + 6} className="svg-label">R</text>
          <g {...hit('mech')}>
            <rect className="hl" x={300} y={392} width={170} height={36} rx={8} fill="#13203a" stroke="#5a6d90" />
            <text x={385} y={415} textAnchor="middle" className="svg-label">мехатроник</text>
          </g>
          <text x={740} y={YO + 40} textAnchor="end" className="svg-label">к колёсам →</text>
        </svg></div>
        <div className="stage-ctl">
          <div className="row">
            <button className="btn" onClick={() => shift(-1)}>▼ Вниз</button>
            <button className="btn primary" onClick={() => shift(1)}>▲ Вверх</button>
          </div>
          <button className="btn" onClick={() => { const x = s.current; x.g = 1; x.pre = 2; x.t = 1; x.auto = true; x.autoT = 0; }}>Разгон 1→7</button>
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><span className="eyebrow">Едем на</span><div className="big-num" style={{ color: '#3de2ff' }}>{st.t < 1 ? `${st.g}→${st.pre}` : st.g}</div></div>
            <div style={{ textAlign: 'right' }}><span className="eyebrow">Заранее готова</span><div className="big-num" style={{ color: '#ffb547' }}>{st.t < 1 ? '…' : st.pre}</div></div>
          </div>
          <TorqueTrace data={tr.data} />
        </div>
        <Callout kind="info">
          {st.t < 0 ? `Сначала блок перекладывает подготовленную передачу на ${st.pre}-ю — поэтому кикдаун у DSG чуть дольше.` : st.t < 1 ? `Смена сцеплений: ${odd(st.g) ? 'K1' : 'K2'} размыкается, ${odd(st.pre) ? 'K1' : 'K2'} замыкается одновременно — тяга почти не пропадает.` : `Едем на ${st.g}-й через ${odd(st.g) ? 'K1' : 'K2'}. На другом валу уже включена ${st.pre}-я — её сцепление ${odd(st.pre) ? 'K1' : 'K2'} пока разомкнуто.`}
        </Callout>
      </div>
    </div>
  );
}

/* ── AMT ─────────────────────────────── */
const AMT_STEPS = ['ЭБУ решил переключиться', 'Актуатор выжимает сцепление — тяга пропала', 'Актуатор двигает муфту на следующую передачу', 'Сцепление плавно включается', 'Едем'];
function AMT() {
  const s = useRef({ g: 1, t: 1, auto: false, autoT: 0, pitch: 0 });
  const [, force] = useState(0);
  const tr = useTrace();
  useTicker((dt) => {
    const st = s.current;
    if (st.t < 1) { st.t = Math.min(1, st.t + dt / 1.3); if (st.t >= 1) st.g = Math.min(5, st.g + 1); }
    if (st.auto) { st.autoT += dt; if (st.autoT > 1.6 && st.t >= 1 && st.g < 5) { st.autoT = 0; st.t = 0; } if (st.g >= 5) st.auto = false; }
    const clutch = st.t >= 1 ? 1 : st.t < 0.15 ? 1 : st.t < 0.35 ? 1 - (st.t - 0.15) / 0.2 : st.t < 0.65 ? 0 : (st.t - 0.65) / 0.35;
    const torque = clutch * (1.1 - st.g * 0.12);
    st.pitch += ((torque < 0.2 ? -4 : 0) - st.pitch) * Math.min(1, dt * 6);
    tr.push(torque, dt);
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const step = st.t >= 1 ? 4 : st.t < 0.15 ? 0 : st.t < 0.35 ? 1 : st.t < 0.65 ? 2 : 3;
  const clutch = st.t >= 1 ? 1 : st.t < 0.15 ? 1 : st.t < 0.35 ? 1 - (st.t - 0.15) / 0.2 : st.t < 0.65 ? 0 : (st.t - 0.65) / 0.35;
  const sleeve = st.t < 0.35 ? 0 : st.t < 0.65 ? (st.t - 0.35) / 0.3 : 1;
  const curG = st.t < 1 && st.t >= 0.5 ? st.g + 1 : st.g;
  return (
    <div className="split">
      <Stage label={<>FIG. 12 — <b>Робот AMT</b> · механика + актуаторы</>}>
        <div className="wide-wrap"><svg viewBox="0 0 760 400" className="fig">
          <rect x={10} y={110} width={60} height={130} rx={10} fill="#2a1a14" stroke="#ff8a4c" strokeOpacity=".6" />
          <rect x={86 + (1 - clutch) * 0} y={100} width={12} height={150} rx={3} fill="#5a6d90" />
          <rect x={102 + (1 - clutch) * 8} y={112} width={8} height={126} rx={2} fill={clutch > 0.95 ? '#3de2ff' : '#f0a531'} />
          {/* актуатор сцепления */}
          <rect x={120} y={40} width={70} height={40} rx={8} fill="#13203a" stroke={step === 1 || step === 3 ? '#3de2ff' : '#5a6d90'} strokeWidth={2} />
          <text x={155} y={64} textAnchor="middle" className="svg-label">мотор</text>
          <line x1={140} x2={116 - (1 - clutch) * 6} y1={80} y2={150} stroke="#c7d4e8" strokeWidth={4} />
          <text x={155} y={30} textAnchor="middle" className="svg-label" style={{ fill: step === 1 || step === 3 ? '#3de2ff' : undefined }}>актуатор сцепления</text>
          <line x1={110} x2={700} y1={175} y2={175} stroke={clutch > 0.95 ? '#3de2ff' : '#8fa3c6'} strokeWidth={7} />
          <line x1={200} x2={720} y1={300} y2={300} stroke={clutch > 0.95 ? '#3de2ff' : '#8fa3c6'} strokeWidth={7} />
          {[1, 2, 3, 4, 5].map((n, i) => {
            const x = 260 + i * 90, r1 = 120 / (1 + [3.5, 2, 1.35, 1, 0.8][i]), r2 = 125 - r1;
            const on = n === curG && sleeve > 0.95 || (st.t >= 1 && n === st.g);
            return (
              <g key={n}>
                <rect x={x - 8} y={175 - r1} width={16} height={r1 * 2} rx={3} fill="#1e2c47" stroke={on ? '#3de2ff' : '#5a6d90'} strokeWidth={on ? 2 : 1} />
                <rect x={x - 8} y={300 - r2} width={16} height={r2 * 2} rx={3} fill="#1a2740" stroke={on ? '#3de2ff' : '#5a6d90'} strokeWidth={on ? 2 : 1} />
                <text x={x} y={175 - r1 - 8} textAnchor="middle" className="mono" style={{ fontSize: 12, fontWeight: 700, fill: on ? '#3de2ff' : '#a7b6cf' }}>{n}</text>
              </g>
            );
          })}
          {/* актуатор переключения */}
          <rect x={430} y={340} width={110} height={44} rx={8} fill="#13203a" stroke={step === 2 ? '#3de2ff' : '#5a6d90'} strokeWidth={2} />
          <text x={485} y={366} textAnchor="middle" className="svg-label" style={{ fill: step === 2 ? '#3de2ff' : undefined }}>актуатор выбора</text>
          <rect x={250 + (st.g - 1) * 90 + sleeve * 90 + 20} y={276} width={22} height={48} rx={4} fill={step === 2 ? '#ffb547' : '#c7d4e8'} />
          <rect x={600} y={30} width={130} height={50} rx={8} fill="#13203a" stroke="#ffe45c" strokeOpacity=".6" />
          <text x={665} y={60} textAnchor="middle" className="svg-label" style={{ fill: '#ffe45c' }}>блок управления</text>
          <path d="M600,55 H190 M665,80 V340 H540" stroke="#ffe45c" strokeOpacity=".35" strokeDasharray="4 4" fill="none" />
          <g transform={`translate(640 210) rotate(${st.pitch} 40 20)`}>
            <path d="M4,30 L12,18 Q34,4 60,6 L80,8 Q90,10 94,22 L98,30 Q98,36 92,36 L8,36 Q2,36 4,30 Z" fill="#13203a" stroke="#3de2ff" />
            <circle cx={24} cy={36} r={8} fill="#1b2230" stroke="#c7d4e8" /><circle cx={78} cy={36} r={8} fill="#1b2230" stroke="#c7d4e8" />
          </g>
          <text x={690} y={270} textAnchor="middle" className="svg-label">{st.pitch < -1 ? '«кивок»' : ''}</text>
        </svg></div>
        <div className="stage-ctl">
          <button className="btn primary" onClick={() => { const x = s.current; if (x.t >= 1 && x.g < 5) x.t = 0; }} disabled={st.g >= 5 || st.t < 1}>▲ Переключить</button>
          <button className="btn" onClick={() => { const x = s.current; x.g = 1; x.t = 1; x.auto = true; x.autoT = 0; }}>Разгон 1→5</button>
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <span className="eyebrow">Шаг</span>
          <ol className="steps">{AMT_STEPS.map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}>{t}</li>)}</ol>
          <TorqueTrace data={tr.data} color="#ffb547" />
        </div>
        <Callout kind="info">По сути это механика, где ногу и руку заменили электромоторы. Пока сцепление выжато, тяги нет — отсюда задумчивость и «кивки». Плавнее, если на переключении чуть отпустить газ.</Callout>
      </div>
    </div>
  );
}

export function Robot() {
  const [k, setK] = useState<'amt' | 'dct'>('dct');
  return (
    <div className="stack">
      <Seg value={k} onChange={setK} options={[{ v: 'dct', l: 'DSG / DCT — два сцепления' }, { v: 'amt', l: 'Робот AMT — одно сцепление' }]} />
      {k === 'dct' ? <DCT /> : <AMT />}
    </div>
  );
}
