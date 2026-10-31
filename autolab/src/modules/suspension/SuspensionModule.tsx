import { useRef, useState } from 'react';
import { clamp, useTicker } from '../../lib/anim';
import { useSubTab } from '../../lib/router';
import { useInfo } from '../../lib/info';
import { Particles, Pt } from '../../lib/path';
import { Callout, ModHead, Range, Seg, Stage, Tabs } from '../../ui/kit';

/* ── четверть автомобиля: кузов на пружине и амортизаторе, колесо на шине ── */
const MS = 300, MU = 40, KT = 200000, V = 8.3;
const PRESETS = { soft: { k: 16000, c: 1000, l: 'Мягкая' }, std: { k: 24000, c: 1800, l: 'Стандарт' }, hard: { k: 45000, c: 3400, l: 'Жёсткая' }, dead: { k: 24000, c: 220, l: 'Убитый амортизатор' } };
type Obstacle = 'bump' | 'hole' | 'hump';
const OBS: Record<Obstacle, { l: string; f: (x: number) => number }> = {
  bump: { l: 'Кочка', f: (x) => (x > 0 && x < 0.5 ? 0.05 * (1 - Math.cos((2 * Math.PI * x) / 0.5)) / 2 : 0) },
  hole: { l: 'Яма', f: (x) => (x > 0 && x < 0.6 ? -0.06 * Math.sin((Math.PI * x) / 0.6) : 0) },
  hump: { l: 'Лежачий полицейский', f: (x) => (x > 0 && x < 3 ? 0.07 * Math.sin((Math.PI * x) / 3) : 0) },
};

const PARTS: Record<string, [string, string]> = {
  spring: ['Пружина', 'Держит вес машины и принимает удар от кочки. Мягкая — комфортно, но кузов сильнее кренится и раскачивается.'],
  damper: ['Амортизатор', 'Гасит колебания пружины: превращает энергию раскачки в тепло масла внутри. Без него машина прыгала бы после каждой кочки, а колесо отрывалось от дороги.'],
  arm: ['Рычаг', 'Задаёт траекторию колеса: колесо ходит вверх-вниз, не уходя вбок. Крепится к кузову через сайлентблоки.'],
  ball: ['Шаровая опора', 'Шарнир между рычагом и поворотным кулаком: даёт колесу и подниматься, и поворачиваться. Изношенная шаровая — стук и опасность: в крайнем случае колесо может «выпасть».'],
  bush: ['Сайлентблоки', 'Резинометаллические втулки в креплениях рычагов. Гасят вибрации и шум. Порванные — стуки, плавающая управляемость, неравномерный износ шин.'],
  arb: ['Стабилизатор', 'Торсион, связывающий левое и правое колесо. В повороте он скручивается и уменьшает крен кузова. Стойки стабилизатора — частый источник стука.'],
  mount: ['Опора стойки', 'Верхнее крепление стойки к кузову с подшипником — стойка вращается вместе с колесом при повороте руля.'],
  tire: ['Шина', 'Тоже пружина: первая принимает неровность. От давления в ней зависит и комфорт, и сцепление.'],
};

function Suspension() {
  const info = useInfo();
  const [preset, setPreset] = useState<keyof typeof PRESETS>('std');
  const [k, setK] = useState(PRESETS.std.k);
  const [c, setC] = useState(PRESETS.std.c);
  const [obs, setObs] = useState<Obstacle>('bump');
  const s = useRef({ x: -3, zs: 0, vs: 0, zu: 0, vu: 0, trS: [] as number[], trU: [] as number[], trR: [] as number[], maxA: 0, air: false, acc: 0 });
  const [, force] = useState(0);
  const slow = 0.35; // замедленная съёмка
  useTicker((dt0) => {
    const st = s.current, dt = dt0 * slow, n = Math.ceil(dt / 0.0005), h = dt / n;
    for (let i = 0; i < n; i++) {
      st.x += V * h;
      const zr = OBS[obs].f(st.x);
      const fs = -k * (st.zs - st.zu) - c * (st.vs - st.vu);
      const ft = KT * (st.zu - zr);
      const as = fs / MS, au = (-fs - ft) / MU;
      st.vs += as * h; st.zs += st.vs * h; st.vu += au * h; st.zu += st.vu * h;
      st.maxA = Math.max(st.maxA, Math.abs(as) / 9.81);
      if (ft > (MS + MU) * 9.81) st.air = true;
    }
    st.acc += dt0;
    if (st.acc > 1 / 40) { st.acc = 0; st.trS.push(st.zs); st.trU.push(st.zu); st.trR.push(OBS[obs].f(st.x)); if (st.trS.length > 200) { st.trS.shift(); st.trU.shift(); st.trR.shift(); } }
    if (st.x > 9) { st.x = -2; st.maxA = 0; st.air = false; }
    force((q) => (q + 1) % 1e6);
  });
  const st = s.current;
  const PX = 900; // пикселей на метр по вертикали (преувеличено)
  const gy = 330, wx = 300, wr = 48;
  const road = (x: number) => OBS[obs].f(x);
  let roadD = '';
  for (let px = 0; px <= 820; px += 4) { const xm = st.x + (px - wx) / 120; roadD += `${px ? 'L' : 'M'}${px},${(gy - road(xm) * PX).toFixed(1)}`; }
  const wy = gy - wr - st.zu * PX;
  const by = 170 - st.zs * PX;
  const springTop = by + 40, springBot = wy - 10;
  const coil = Array.from({ length: 13 }, (_, i) => `${i ? 'L' : 'M'}${wx - 46 + (i % 2 ? 24 : 0)},${springTop + (i / 12) * (springBot - springTop)}`).join('');
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: PARTS[id][0], text: PARTS[id][1], kicker: 'Подвеска', color: '#8ef06a' }) });
  const tr = (arr: number[], color: string, dash?: string) => <polyline points={arr.map((v, i) => `${(i / 199) * 360},${60 - v * 600}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dash} />;
  const defl = st.zs - st.zu;
  const comfort = st.maxA < 0.25 ? ['мягко', '#36e0a0'] : st.maxA < 0.5 ? ['ощутимо', '#ffb547'] : ['жёстко', '#ff4b5c'];

  return (
    <div className="stack">
      <div className="split">
        <Stage label={<>SIM — <b>Колесо на кочке</b> · замедление ×3, ход подвески преувеличен</>} hint="нажмите на пружину или амортизатор">
          <svg viewBox="0 0 820 400" className="fig">
            <path d={`${roadD} L820,400 L0,400 Z`} fill="#0b1222" stroke="#3a4b6c" strokeWidth={2} />
            <g {...hit('spring')}><path className="hl" d={coil} stroke="#8ef06a" strokeWidth={5} fill="none" strokeLinejoin="round" /></g>
            <g {...hit('damper')}>
              <rect className="hl" x={wx + 14} y={springBot - 70} width={24} height={70} rx={4} fill="#5a6d90" stroke="#c7d4e8" />
              <rect x={wx + 22} y={springTop} width={8} height={Math.max(0, springBot - 70 - springTop + 6)} fill="#c7d4e8" />
            </g>
            <rect x={wx - 160} y={by} width={320} height={44} rx={14} fill="#13203a" stroke="#3de2ff" strokeWidth={2} />
            <text x={wx} y={by + 28} textAnchor="middle" className="svg-label">кузов ¼ машины · 300 кг</text>
            <g {...hit('tire')}>
              <circle className="hl" cx={wx} cy={wy} r={wr} fill="#1b2230" stroke="#c7d4e8" strokeWidth={3} />
              <circle cx={wx} cy={wy} r={wr * 0.55} fill="#2a3346" stroke="#5a6d90" />
              <g transform={`rotate(${(st.x / 0.31) * 57.3} ${wx} ${wy})`}><line x1={wx - 20} x2={wx + 20} y1={wy} y2={wy} stroke="#8fa3c6" strokeWidth={3} /></g>
            </g>
            {st.air && <text x={wx} y={gy + 50} textAnchor="middle" className="mono" style={{ fontSize: 13, fill: '#ff4b5c' }}>колесо оторвалось от дороги</text>}
          </svg>
          <div className="stage-ctl">
            <Seg value={obs} onChange={(v) => { setObs(v); s.current.x = -2; }} options={(Object.keys(OBS) as Obstacle[]).map((v) => ({ v, l: OBS[v].l }))} />
          </div>
        </Stage>
        <div className="stack">
          <div className="panel stack">
            <Seg value={preset} onChange={(p) => { setPreset(p); setK(PRESETS[p].k); setC(PRESETS[p].c); }} options={(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((v) => ({ v, l: PRESETS[v].l }))} />
            <Range id="ks" label="Пружина" value={k} min={10000} max={60000} step={1000} onChange={setK} fmt={(v) => `${v / 1000} кН/м`} />
            <Range id="cs" label="Амортизатор" value={c} min={100} max={5000} step={100} onChange={setC} fmt={(v) => `${v} Н·с/м`} />
          </div>
          <div className="panel">
            <span className="eyebrow">Кузов (голубой) · колесо (зелёный) · дорога (пунктир)</span>
            <svg viewBox="0 0 360 120" style={{ width: '100%', display: 'block' }}>
              <line x1={0} x2={360} y1={60} y2={60} stroke="rgba(130,175,255,.15)" />
              {tr(st.trR, '#6c7e9c', '4 4')}{tr(st.trU, '#8ef06a')}{tr(st.trS, '#3de2ff')}
            </svg>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
              <span>Пик ускорения кузова: <b className="mono">{st.maxA.toFixed(2)} g</b></span>
              <span style={{ color: comfort[1] }}>{comfort[0]}</span>
            </div>
          </div>
          <Callout kind={preset === 'dead' ? 'warn' : 'info'}>{preset === 'dead' ? 'Без нормального амортизатора кузов долго качается, а колесо подпрыгивает и теряет контакт с дорогой — хуже торможение и управляемость.' : 'Мягкая подвеска лучше гасит удар, жёсткая меньше раскачивается и кренится. Амортизатор решает, как быстро всё успокоится.'}</Callout>
        </div>
      </div>
      <MacPherson defl={defl} onPart={(id) => info.show({ id, title: PARTS[id][0], text: PARTS[id][1], kicker: 'Подвеска', color: '#8ef06a' })} />
    </div>
  );
}

function MacPherson({ defl, onPart }: { defl: number; onPart: (id: string) => void }) {
  const up = clamp(-defl * 700, -40, 40); // колесо вверх относительно кузова
  const hit = (id: string) => ({ className: 'hit', onClick: () => onPart(id) });
  const kx = 250, ky = 250 - up;
  const coil = Array.from({ length: 11 }, (_, i) => `${i ? 'L' : 'M'}${160 + (i % 2 ? 40 : 0) + (i / 10) * 26},${70 + (i / 10) * (ky - 120 - 70)}`).join('');
  return (
    <div className="split">
      <Stage label={<>FIG. 40 — <b>Подвеска МакФерсон</b> · вид спереди, левое колесо</>} hint="ход связан с симуляцией выше">
        <svg viewBox="0 0 560 360" className="fig" style={{ maxHeight: 420 }}>
          <rect x={300} y={20} width={240} height={60} rx={10} fill="#13203a" stroke="#3de2ff" strokeOpacity=".5" />
          <text x={420} y={56} textAnchor="middle" className="svg-label">кузов</text>
          <path d="M300,40 H200 V70" stroke="#3de2ff" strokeOpacity=".5" strokeWidth={8} fill="none" />
          <g {...hit('mount')}><rect className="hl" x={170} y={56} width={64} height={18} rx={6} fill="#5a6d90" /></g>
          <g {...hit('damper')}>
            <rect x={193} y={70} width={10} height={ky - 140 - 70 + 40} fill="#c7d4e8" />
            <rect className="hl" x={184} y={ky - 130} width={30} height={100} rx={5} fill="#5a6d90" stroke="#c7d4e8" />
          </g>
          <g {...hit('spring')}><path className="hl" d={coil} stroke="#8ef06a" strokeWidth={5} fill="none" /></g>
          <path d={`M199,${ky - 32} L${kx - 10},${ky - 10} L${kx - 10},${ky + 40} L220,${ky + 60}`} stroke="#8fa3c6" strokeWidth={14} fill="none" strokeLinejoin="round" />
          <g {...hit('tire')}>
            <rect className="hl" x={kx + 20} y={ky - 70} width={70} height={160} rx={18} fill="#1b2230" stroke="#c7d4e8" strokeWidth={2} />
            <rect x={kx} y={ky - 6} width={24} height={12} fill="#5a6d90" />
          </g>
          <g {...hit('arm')}><path className="hl" d={`M220,${ky + 60} L420,300`} stroke="#9aa8bd" strokeWidth={12} strokeLinecap="round" /></g>
          <g {...hit('ball')}><circle className="hl" cx={220} cy={ky + 60} r={10} fill="#ffb547" stroke="#fff" /></g>
          <g {...hit('bush')}><circle className="hl" cx={420} cy={300} r={14} fill="#1b2230" stroke="#ff8a4c" strokeWidth={4} /></g>
          <g {...hit('arb')}>
            <path className="hl" d={`M300,${(ky + 60 + 300) / 2 - 6 + 0} L300,330 L540,330`} stroke="#8ef06a" strokeWidth={6} fill="none" strokeOpacity=".8" />
          </g>
          <text x={430} y={300} className="svg-label">сайлентблок</text>
          <text x={548} y={326} textAnchor="end" className="svg-label">стабилизатор →</text>
          <line x1={0} x2={560} y1={ky + 92} y2={ky + 92} stroke="#3a4b6c" />
        </svg>
      </Stage>
      <div className="stack">
        <p className="muted">Самая распространённая передняя подвеска: амортизатор одновременно служит стойкой, на которой держится колесо. Нажимайте на детали — у каждой свой типичный стук.</p>
        <Callout kind="info">Стук на неровностях — чаще всего стойки стабилизатора, сайлентблоки или опоры. Это проверяют на подъёмнике.</Callout>
      </div>
    </div>
  );
}

/* ── Рулевое ─────────────────────────── */
const HOSE_L: Pt[] = [[560, 300], [560, 240], [250, 240], [250, 214]];
const HOSE_R: Pt[] = [[580, 300], [580, 250], [390, 250], [390, 214]];

function Steering() {
  const info = useInfo();
  const [assist, setAssist] = useState<'hyd' | 'eps'>('eps');
  const [engine, setEngine] = useState(true);
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ a: number } | null>(null);
  const wheelRef = useRef<SVGSVGElement>(null);
  const ph = useRef(0);
  const prev = useRef(0);
  const rate = useRef(0);
  const [, force] = useState(0);
  useTicker((dt) => { rate.current = rate.current * 0.85 + (Math.abs(angle - prev.current) / Math.max(dt, 1e-3)) * 0.15; prev.current = angle; ph.current += dt * Math.sign(angle) * Math.min(1, rate.current / 200); force((n) => (n + 1) % 1e6); });
  const pa = (e: React.PointerEvent) => { const r = wheelRef.current!.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 57.3; };
  const road = angle / 15; // передаточное ~15:1
  const inner = road * 1.12, outer = road * 0.9;
  const lw = road > 0 ? outer : inner, rw = road > 0 ? inner : outer;
  const rack = road * 2.2;
  const works = assist === 'eps' || engine;
  const effort = clamp((Math.abs(road) / 36) * (works ? 0.25 : 1) + (works ? 0.05 : 0.15));
  const hit = (id: string, t: string, x: string) => ({ className: 'hit', onClick: () => info.show({ id, title: t, text: x, kicker: 'Рулевое управление', color: '#c79bff' }) });
  return (
    <div className="split">
      <Stage label={<>FIG. 41 — <b>Рулевое управление</b> · {assist === 'hyd' ? 'гидроусилитель' : 'электроусилитель'}</>}>
        <svg viewBox="40 30 600 420" className="fig">
          {[[170, 110, lw], [470, 110, rw]].map(([x, y, a], i) => (
            <g key={i} transform={`rotate(${a} ${x} ${y})`}>
              <rect x={x - 22} y={y - 50} width={44} height={100} rx={10} fill="#1b2230" stroke="#c7d4e8" strokeWidth={2} />
              <line x1={x} x2={x + (i ? -40 : 40)} y1={y + 30} y2={y + 54} stroke="#8fa3c6" strokeWidth={6} />
            </g>
          ))}
          <g {...hit('rack', 'Рулевая рейка', 'Шестерня на конце рулевого вала двигает зубчатую рейку влево-вправо. Около 3 оборотов руля от упора до упора поворачивают колёса примерно на ±35°.')}>
            <rect className="hl" x={230 + rack} y={196} width={180} height={18} rx={6} fill="#5a4a8a" stroke="#c79bff" />
            {Array.from({ length: 16 }, (_, i) => <line key={i} x1={240 + rack + i * 10} x2={240 + rack + i * 10} y1={196} y2={204} stroke="#c79bff" />)}
          </g>
          <g {...hit('rods', 'Рулевые тяги и наконечники', 'Соединяют рейку с поворотными кулаками. Изношенные наконечники — люфт руля и стук. После их замены нужна регулировка схождения.')}>
            <line className="hl" x1={230 + rack} y1={205} x2={170 + 40 * Math.cos((lw * Math.PI) / 180) - 30 * Math.sin((lw * Math.PI) / 180) + 10} y2={164 + 40 * Math.sin((lw * Math.PI) / 180)} stroke="#c7d4e8" strokeWidth={6} />
            <line className="hl" x1={410 + rack} y1={205} x2={470 - 40 * Math.cos((rw * Math.PI) / 180) - 30 * Math.sin((rw * Math.PI) / 180) - 10} y2={164 - 40 * Math.sin((rw * Math.PI) / 180)} stroke="#c7d4e8" strokeWidth={6} />
          </g>
          <g {...hit('column', 'Рулевой вал', 'Передаёт вращение руля на рейку через карданные шарниры. В аварии вал складывается, чтобы не травмировать водителя.')}>
            <line className="hl" x1={380} y1={210} x2={380} y2={330} stroke="#8fa3c6" strokeWidth={8} />
            <circle cx={380} cy={205} r={14} fill="#2a3650" stroke="#c79bff" strokeWidth={2} transform={`rotate(${angle} 380 205)`} />
            <line x1={380} x2={380} y1={193} y2={217} stroke="#c79bff" strokeWidth={3} transform={`rotate(${angle} 380 205)`} />
          </g>
          {assist === 'eps' ? (
            <g {...hit('eps', 'Электроусилитель (ЭУР)', 'Электромотор на рулевом валу или на рейке. Датчик момента чувствует усилие водителя, блок управления добавляет помощь. Жидкости нет, энергию тратит только при повороте. Работает при включённом зажигании.')}>
              <rect className="hl" x={396} y={268} width={70} height={44} rx={8} fill="#13203a" stroke="#ffe45c" strokeWidth={2} style={rate.current > 20 ? { filter: 'drop-shadow(0 0 10px #ffe45c)' } : undefined} />
              <text x={431} y={295} textAnchor="middle" className="svg-label" style={{ fill: '#ffe45c' }}>мотор</text>
              <path d="M466,290 H560 V380" stroke="#ffe45c" strokeOpacity=".5" strokeDasharray="4 4" fill="none" />
              <rect x={530} y={380} width={70} height={36} rx={6} fill="#13203a" stroke="#ffe45c" strokeOpacity=".6" />
              <text x={565} y={402} textAnchor="middle" className="svg-label">ЭБУ</text>
            </g>
          ) : (
            <g {...hit('hyd', 'Гидроусилитель (ГУР)', 'Насос от ремня двигателя гонит жидкость под давлением. Клапан на валу направляет её в ту полость цилиндра рейки, куда вы поворачиваете. Мотор заглушен — насос стоит, руль становится тяжёлым.')}>
              <circle className="hl" cx={570} cy={320} r={26} fill="#2a1a14" stroke="#ff8a4c" strokeWidth={2} />
              <text x={570} y={366} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>насос ГУР</text>
              <path d={`M${HOSE_L.map((p) => p.join(',')).join('L')}`} stroke="#ff8a4c" strokeOpacity=".35" strokeWidth={6} fill="none" />
              <path d={`M${HOSE_R.map((p) => p.join(',')).join('L')}`} stroke="#ff8a4c" strokeOpacity=".35" strokeWidth={6} fill="none" />
              {engine && Math.abs(rate.current) > 10 && <Particles pts={angle > prev.current - 0.01 ? HOSE_R : HOSE_L} phase={Math.abs(ph.current)} n={10} color="#ff8a4c" r={3} />}
            </g>
          )}
          <text x={320} y={60} textAnchor="middle" className="mono" style={{ fontSize: 12, fill: '#a7b6cf' }}>колёса: {road.toFixed(0)}° · внутреннее поворачивает сильнее</text>
        </svg>
        <div className="stage-ctl">
          <Seg value={assist} onChange={setAssist} options={[{ v: 'eps', l: 'ЭУР' }, { v: 'hyd', l: 'ГУР' }]} />
          <Seg value={engine ? 1 : 0} onChange={(v) => setEngine(!!v)} options={[{ v: 1, l: 'Мотор работает' }, { v: 0, l: 'Заглушен' }]} />
        </div>
      </Stage>
      <div className="stack">
        <div className="panel" style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
          <span className="eyebrow">Крутите руль пальцем или мышью</span>
          <svg ref={wheelRef} viewBox="0 0 200 200" style={{ width: 200, touchAction: 'none', cursor: 'grab' }}
            onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { a: pa(e) }; }}
            onPointerMove={(e) => { if (!drag.current) return; const a = pa(e); let d = a - drag.current.a; if (d > 180) d -= 360; if (d < -180) d += 360; drag.current.a = a; setAngle((x) => clamp(x + d, -540, 540)); }}
            onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
            <g transform={`rotate(${angle} 100 100)`}>
              <circle cx={100} cy={100} r={88} fill="none" stroke="#c7d4e8" strokeWidth={14} />
              <circle cx={100} cy={100} r={26} fill="#2a3650" stroke="#c79bff" strokeWidth={2} />
              <path d="M12,100 H74 M126,100 H188 M100,126 V188" stroke="#c7d4e8" strokeWidth={12} strokeLinecap="round" />
              <rect x={94} y={8} width={12} height={10} rx={2} fill="#ff6a3c" />
            </g>
          </svg>
          <div className="row"><b className="mono">{Math.round(angle)}°</b><button className="btn sm" onClick={() => setAngle(0)}>Прямо</button></div>
          <div className="meter" style={{ width: '100%' }}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span>Усилие на руле</span><b style={{ color: effort > 0.5 ? 'var(--red)' : 'var(--green)' }}>{effort > 0.5 ? 'тяжело' : 'легко'}</b></div>
            <div className="bar"><i style={{ width: `${effort * 100}%`, background: effort > 0.5 ? 'var(--red)' : 'var(--green)' }} /></div>
          </div>
        </div>
        {!works && <Callout kind="warn">ГУР без работающего мотора не помогает: насос крутится от ремня. Руль тяжёлый, но машина управляется.</Callout>}
        <Callout kind="info">Руль → вал → шестерня → рейка → тяги → колёса. Передаточное около 15:1: поворот руля на 15° поворачивает колёса примерно на 1°.</Callout>
      </div>
    </div>
  );
}

const TABS = [{ id: 'susp', label: 'Подвеска' }, { id: 'steering', label: 'Рулевое' }] as const;
type T = (typeof TABS)[number]['id'];
export function SuspensionModule({ sub }: { sub: string }) {
  const [tab, setTab] = useSubTab<T>('chassis', TABS.map((t) => t.id), sub);
  return (
    <>
      <ModHead title="Подвеска и руль" lead="Как колесо следует за дорогой, а кузов — нет. И как поворот руля доходит до колёс." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'susp' ? <Suspension /> : <Steering />}
    </>
  );
}
