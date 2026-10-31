import { useRef, useState } from 'react';
import { clamp, useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { Callout, Pedal, Stage } from '../../ui/kit';
import { Gauge } from '../engine/Turbo';

/** Ёмкость сцепления по положению педали: 0 — выжато, 1 — полностью включено. Точка схватывания ≈ середина хода. */
export const clutchCap = (pedal: number) => Math.pow(clamp((0.72 - pedal) / 0.42), 1.6);

const INFO: Record<string, [string, string]> = {
  fly: ['Маховик', 'Тяжёлый диск на коленвале. Всегда крутится вместе с двигателем. По краю — зубчатый венец, за который его крутит стартер.'],
  disc: ['Ведомый диск', 'Тонкий диск с фрикционными накладками, сидит на шлицах первичного вала коробки. Зажат — крутится вместе с маховиком. Накладки стираются, особенно при пробуксовке.'],
  plate: ['Нажимной диск (корзина)', 'Мощная диафрагменная пружина прижимает его к ведомому диску. Педаль сцепления через выжимной подшипник давит на лепестки пружины и ослабляет прижим.'],
  bearing: ['Выжимной подшипник', 'Давит на лепестки диафрагменной пружины, когда нажата педаль. Если держать педаль выжатой на светофоре, он работает под нагрузкой и изнашивается.'],
  shaft: ['Первичный вал коробки', 'Соединён с ведомым диском шлицами. Дальше — шестерни коробки передач.'],
  hyd: ['Гидропривод сцепления', 'Педаль толкает поршень главного цилиндра, жидкость передаёт усилие на рабочий цилиндр у коробки. На старых машинах вместо этого — трос.'],
};

function ClutchSection({ pedal, t }: { pedal: number; t: number }) {
  const info = useInfo();
  const e = clutchCap(pedal);
  const gap = (1 - e) * 10;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Сцепление', color: '#5aa8ff' }) });
  const flyTravel = t * 60;
  const discTravel = t * 60 * e;
  const stripes = (x: number, y: number, w: number, h: number, travel: number, color: string) => {
    const off = ((travel % 10) + 10) % 10;
    return (
      <g clipPath={`url(#cl-${x})`}>
        <clipPath id={`cl-${x}`}><rect x={x} y={y} width={w} height={h} /></clipPath>
        {Array.from({ length: Math.ceil(h / 10) + 1 }, (_, i) => <line key={i} x1={x} x2={x + w} y1={y + i * 10 + off - 10} y2={y + i * 10 + off - 10} stroke={color} strokeOpacity=".5" />)}
      </g>
    );
  };
  const slip = e > 0.03 && e < 0.97;
  return (
    <svg viewBox="0 0 560 380" className="fig">
      {/* коленвал */}
      <rect x={10} y={176} width={80} height={28} rx={4} fill="#5a6d90" />
      <text x={50} y={226} textAnchor="middle" className="svg-label">коленвал</text>
      <g {...hit('fly')}>
        <rect className="hl" x={90} y={40} width={44} height={300} rx={8} fill="#3a4a69" stroke="#8fa3c6" />
        {stripes(90, 40, 44, 300, flyTravel, '#c7d4e8')}
        {Array.from({ length: 14 }, (_, i) => <rect key={i} x={92} y={30 + ((i * 24 + flyTravel * 0.8) % 330)} width={40} height={4} fill="#c7d4e8" opacity=".2" />)}
        <text x={112} y={30} textAnchor="middle" className="svg-label">маховик</text>
      </g>
      <g {...hit('disc')}>
        <rect className="hl" x={140 + gap * 0.4} y={70} width={14} height={240} rx={3} fill={slip ? '#ff8a4c' : '#f0a531'} style={slip ? { filter: 'drop-shadow(0 0 8px #ff6a3c)' } : undefined} />
        <rect x={146 + gap * 0.4} y={150} width={4} height={80} fill="#1a2438" />
        {stripes(140 + gap * 0.4, 70, 14, 240, discTravel, '#3a2410')}
        <text x={147} y={340} textAnchor="middle" className="svg-label" style={{ fill: '#f0a531' }}>диск</text>
      </g>
      <g {...hit('plate')}>
        <rect className="hl" x={160 + gap} y={60} width={26} height={260} rx={5} fill="#5a6d90" stroke="#8fa3c6" />
        {stripes(160 + gap, 60, 26, 260, discTravel, '#c7d4e8')}
        {/* диафрагменная пружина: лепестки */}
        <path d={`M${190 + gap},70 L${240 - pedal * 22},170 M${190 + gap},310 L${240 - pedal * 22},210`} stroke="#8ef06a" strokeWidth={6} strokeLinecap="round" />
        <path d="M150,40 H260 V340 H150" fill="none" stroke="#3a4b6c" strokeWidth={3} strokeDasharray="6 5" />
        <text x={205} y={30} textAnchor="middle" className="svg-label">корзина</text>
      </g>
      <g {...hit('bearing')}>
        <rect className="hl" x={244 - pedal * 22} y={160} width={22} height={60} rx={6} fill="#c7d4e8" stroke="#fff" />
        <text x={262} y={244} className="svg-label">выжимной</text>
      </g>
      <g {...hit('shaft')}>
        <rect className="hl" x={150} y={180} width={390} height={20} rx={4} fill={e > 0.97 ? '#3de2ff' : '#8fa3c6'} opacity={0.9} />
        {stripes(270, 180, 270, 20, discTravel * 3, '#0a1222')}
        <text x={540} y={220} textAnchor="end" className="svg-label">к коробке →</text>
      </g>
      <g {...hit('hyd')}>
        <path d={`M300,120 H400 V60 H500`} stroke="#c79bff" strokeWidth={6} fill="none" strokeOpacity=".6" />
        <rect x={286} y={110 - pedal * 0} width={30} height={20} rx={4} fill="#2a3650" stroke="#c79bff" />
        <rect x={496} y={48} width={40} height={24} rx={4} fill="#2a3650" stroke="#c79bff" />
        <rect x={500 + pedal * 18} y={52} width={10} height={16} fill="#c79bff" />
        <text x={516} y={92} textAnchor="middle" className="svg-label" style={{ fill: '#c79bff' }}>от педали</text>
      </g>
      <text x={280} y={372} textAnchor="middle" className="mono" style={{ fontSize: 13, fill: e > 0.97 ? '#36e0a0' : e < 0.03 ? '#ff8a4c' : '#ffb547' }}>
        {e > 0.97 ? 'ВКЛЮЧЕНО · мотор соединён с коробкой' : e < 0.03 ? 'ВЫЖАТО · мотор отсоединён' : `ПРОБУКСОВКА · передаётся ${Math.round(e * 100)}%`}
      </text>
    </svg>
  );
}

/* ── мини-симулятор трогания на 1-й передаче ─────────────────────────── */
const I1 = 3.55 * 4.06, RW = 0.31, MASS = 1250, JE = 0.22;
type Sim = { we: number; v: number; on: boolean; x: number; jerk: number; a: number; heat: number; result: '' | 'stall' | 'ok' | 'burn'; t: number };
const fresh = (): Sim => ({ we: (850 / 60) * 2 * Math.PI, v: 0, on: true, x: 0, jerk: 0, a: 0, heat: 0, result: '', t: 0 });

function engineTorque(rpm: number, thr: number) {
  const tmax = Math.max(60, 150 * (1 - Math.pow((rpm - 4000) / 4500, 2)));
  const idle = clamp(0.25 * (900 - rpm), 0, 60);
  return (rpm > 6500 ? 0 : thr * tmax) + idle - (8 + 0.004 * rpm);
}

export function LaunchSim() {
  const [clutch, setClutch] = useState(1);
  const [gas, setGas] = useState(0);
  const sim = useRef<Sim>(fresh());
  const [, force] = useState(0);
  useTicker((dt) => {
    const s = sim.current;
    if (s.result === 'stall' || s.result === 'ok') { force((n) => (n + 1) % 1e6); return; }
    const steps = Math.ceil(dt / 0.001);
    const h = dt / steps;
    const vPrev = s.v;
    for (let i = 0; i < steps; i++) {
      const rpm = (s.we * 60) / (2 * Math.PI);
      const Te = s.on ? engineTorque(rpm, gas) : -(5 + 0.01 * rpm);
      const wIn = (s.v / RW) * I1;
      const cap = 260 * clutchCap(clutch);
      const Tc = clamp(60 * (s.we - wIn), -cap, cap);
      s.we = Math.max(0, s.we + ((Te - Tc) / JE) * h);
      const Fres = s.v > 0.01 ? 150 + 0.4 * s.v * s.v : 0;
      const F = (Tc * I1 * 0.92) / RW;
      s.v = Math.max(0, s.v + ((F - Fres) / (MASS * 1.08)) * h);
      s.heat += Math.abs(Tc * (s.we - wIn)) * h * 0.00002;
      if (s.on && rpm < 380) { s.on = false; s.result = 'stall'; }
    }
    s.heat = Math.max(0, s.heat - dt * 0.1);
    const a = (s.v - vPrev) / Math.max(dt, 1e-3);
    s.jerk = Math.max(s.jerk, Math.abs(a - s.a) / Math.max(dt, 1e-3) * (s.v > 0.2 ? 1 : 0));
    s.a = a;
    s.x += s.v * dt;
    s.t += dt;
    if (s.heat > 3) s.result = 'burn';
    if (s.result !== 'stall' && s.v * 3.6 > 9 && clutch < 0.08) s.result = 'ok';
    force((n) => (n + 1) % 1e6);
  });
  const s = sim.current;
  const rpm = (s.we * 60) / (2 * Math.PI);
  const kmh = s.v * 3.6;
  const restart = () => { sim.current = fresh(); setClutch(1); setGas(0); };
  const bump = Math.sin(s.t * 40) * Math.min(3, s.a * 0.6);
  return (
    <div className="split">
      <Stage label={<>SIM — <b>Трогание с места</b> · 1-я передача</>}>
        <svg viewBox="0 0 640 300" className="fig">
          <rect x={0} y={210} width={640} height={90} fill="#0b1222" />
          {Array.from({ length: 12 }, (_, i) => {
            const x = ((i * 80 - s.x * 40) % 960 + 960) % 960 - 160;
            return <rect key={i} x={x} y={250} width={44} height={6} rx={2} fill="#3a4b6c" />;
          })}
          {Array.from({ length: 7 }, (_, i) => {
            const x = ((i * 140 - s.x * 12) % 980 + 980) % 980 - 160;
            return <rect key={'b' + i} x={x} y={120} width={60} height={90} fill="#0e1a30" stroke="#1f2d48" />;
          })}
          <g transform={`translate(230 ${142 + (s.result === 'stall' ? 0 : bump)}) rotate(${-clamp(s.a * 0.5, -2, 4)} 90 50)`}>
            <path d="M8,60 L20,38 Q60,8 110,10 L150,12 Q172,16 182,40 L190,60 Q192,72 180,72 L14,72 Q4,72 8,60 Z" fill="#13203a" stroke="#3de2ff" strokeWidth={2} />
            <path d="M58,22 L100,16 L140,18 L158,38 L46,38 Z" fill="#0a1830" stroke="#3de2ff" strokeOpacity=".5" />
            {[46, 152].map((cx) => (
              <g key={cx} transform={`rotate(${(s.x / RW) * 57.3} ${cx} 72)`}>
                <circle cx={cx} cy={72} r={20} fill="#1b2230" stroke="#c7d4e8" strokeWidth={2} />
                <line x1={cx - 14} x2={cx + 14} y1={72} y2={72} stroke="#c7d4e8" strokeWidth={2} />
                <line x1={cx} x2={cx} y1={58} y2={86} stroke="#c7d4e8" strokeWidth={2} />
              </g>
            ))}
            {s.on && <circle cx={-6} cy={64} r={4 + gas * 6} fill="#a2958c" opacity={0.3 + gas * 0.3} />}
          </g>
        </svg>
        <div className="sim-gauges">
          <Gauge label="Обороты" digits={0} value={rpm} max={7000} unit="об/мин" color={rpm > 5500 ? '#ff4b5c' : '#3de2ff'} />
          <Gauge label="Скорость" digits={1} value={kmh} max={40} unit="км/ч" color="#36e0a0" />
        </div>
        {s.result === 'stall' && (
          <div className="overlay-msg"><div className="box">
            <span className="eyebrow" style={{ color: 'var(--red)' }}>Обороты упали ниже ~400</span>
            <h2 style={{ color: 'var(--red)' }}>ДВИГАТЕЛЬ ЗАГЛОХ</h2>
            <p className="muted">Сцепление схватило слишком резко: колёса стоят, а мотору не хватило силы раскрутить машину. Отпускайте педаль медленнее в зоне схватывания и чуть добавьте газа.</p>
            <button className="btn primary" onClick={restart}>Завести снова</button>
          </div></div>
        )}
        {s.result === 'ok' && (
          <div className="overlay-msg"><div className="box">
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Сцепление полностью отпущено</span>
            <h2 style={{ color: 'var(--green)' }}>ПОЕХАЛИ ✓</h2>
            <p className="muted">{s.jerk < 15 ? 'Очень плавно — пассажиры даже не заметили.' : s.jerk < 60 ? 'Нормально, с лёгким рывком.' : 'Тронулись, но с рывком — отпускайте сцепление плавнее в точке схватывания.'}</p>
            <button className="btn primary" onClick={restart}>Ещё раз</button>
          </div></div>
        )}
      </Stage>
      <div className="stack">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-around', alignItems: 'flex-start' }}>
            <Pedal label="Сцепление" value={clutch} onChange={setClutch} color="#5aa8ff" />
            <Pedal label="Газ" value={gas} onChange={setGas} color="#36e0a0" wide />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Тяните педаль вниз — нажать, вверх — отпустить. Сцепление начинает «схватывать» примерно в середине хода.</p>
        </div>
        {s.result === 'burn' ? (
          <Callout kind="warn"><b>Запах сцепления.</b> Много газа и долгая пробуксовка греют накладки. Отпускайте сцепление быстрее, когда машина уже тронулась.</Callout>
        ) : (
          <Callout kind="info">Задача: отпустить сцепление до конца и разогнаться до 10 км/ч, не заглохнув. Попробуйте сначала без газа — медленно, как в жизни на ровной дороге.</Callout>
        )}
        <button className="btn" onClick={restart}>Сначала</button>
      </div>
    </div>
  );
}

export function Clutch() {
  const [pedal, setPedal] = useState(0);
  const t = useRef(0);
  const [, force] = useState(0);
  useTicker((dt) => { t.current += dt; force((n) => (n + 1) % 1e6); });
  return (
    <div className="stack">
      <div className="split">
        <Stage label={<>FIG. 08 — <b>Сцепление в разрезе</b></>} hint="нажмите на деталь">
          <ClutchSection pedal={pedal} t={t.current} />
        </Stage>
        <div className="stack">
          <div className="panel row" style={{ justifyContent: 'space-around' }}>
            <Pedal label="Педаль сцепления" value={pedal} onChange={setPedal} color="#5aa8ff" height={200} />
            <div className="stack" style={{ maxWidth: 190, gap: 8 }}>
              <button className="btn sm" onClick={() => setPedal(0)}>Отпущена</button>
              <button className="btn sm" onClick={() => setPedal(0.5)}>Схватывание</button>
              <button className="btn sm" onClick={() => setPedal(1)}>Выжата</button>
            </div>
          </div>
          <Callout kind="info"><b>Педаль отпущена</b> — пружина зажимает диск, двигатель соединён с коробкой. <b>Нажата</b> — диск свободен, можно переключать передачи или стоять на месте с включённой передачей.</Callout>
        </div>
      </div>
      <LaunchSim />
    </div>
  );
}
