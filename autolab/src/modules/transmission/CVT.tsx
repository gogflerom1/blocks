import { useRef, useState } from 'react';
import { clamp, useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { Callout, HoldButton, Stage } from '../../ui/kit';
import { Gauge } from '../engine/Turbo';
import { TorqueTrace } from './Robot';

const CD = 230, R0 = 62, LBELT = Math.PI * 2 * R0 + 2 * CD;
const IMIN = 0.45, IMAX = 2.5;
/** Радиус ведущего шкива для данного передаточного при постоянной длине ремня */
function radii(i: number) {
  const a = (i - 1) ** 2 / CD, b = Math.PI * (1 + i), c = 2 * CD - LBELT;
  const r1 = Math.abs(a) < 1e-6 ? -c / b : (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return [r1, r1 * i];
}

const INFO: Record<string, [string, string]> = {
  p1: ['Ведущий шкив', 'Связан с двигателем. Две конусные половинки: когда гидравлика их сдвигает, ремень выталкивается на больший радиус. Разведены — ремень ныряет к центру.'],
  p2: ['Ведомый шкив', 'Работает зеркально: если на ведущем ремень пошёл наружу, здесь он уходит к центру. Длина ремня постоянна — поэтому радиусы меняются вместе.'],
  belt: ['Толкающий ремень / цепь', 'Не резиновый: это сотни стальных пластин на стальных лентах (ремень Van Doorne) или специальная цепь. Ремень не тянет, а толкает. Масло вариатора обеспечивает нужное трение — его замена критична.'],
};

export function CVT() {
  const info = useInfo();
  const [gas, setGas] = useState(false);
  const s = useRef({ v: 0, i: IMAX, rpm: 900, a1: 0, a2: 0 });
  const [, force] = useState(0);
  const rpmTr = useRef<number[]>(Array(180).fill(0.15));
  const spdTr = useRef<number[]>(Array(180).fill(0));
  const acc = useRef(0);
  useTicker((dt) => {
    const st = s.current;
    const thr = gas ? 1 : 0.08;
    const wheelRpm = ((st.v / 0.315) * 60) / (2 * Math.PI);
    const target = 1200 + thr * 3300;
    // вариатор держит обороты, меняя передаточное число
    const need = wheelRpm > 1 ? target / (wheelRpm * 5.2) : IMAX;
    st.i += (clamp(need, IMIN, IMAX) - st.i) * Math.min(1, dt * 2.5);
    const rpmGear = Math.max(900, wheelRpm * 5.2 * st.i);
    st.rpm += ((gas ? Math.max(rpmGear, Math.min(target, 900 + st.v * 600)) : rpmGear) - st.rpm) * Math.min(1, dt * 5);
    const power = gas ? 60000 * clamp(st.rpm / 4500) : 0;
    const F = power / Math.max(st.v, 2.5) - 200 - 0.42 * st.v * st.v;
    st.v = clamp(st.v + (F / 1300) * dt, 0, 50);
    if (!gas) st.v = Math.max(0, st.v - dt * 1.2);
    st.a1 += dt * st.rpm * 0.05;
    st.a2 += (dt * st.rpm * 0.05) / st.i;
    acc.current += dt;
    while (acc.current > 1 / 30) { acc.current -= 1 / 30; rpmTr.current.push(st.rpm / 6000); rpmTr.current.shift(); spdTr.current.push((st.v * 3.6) / 180); spdTr.current.shift(); }
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const [r1, r2] = radii(st.i);
  const x1 = 180, x2 = x1 + CD, y = 170;
  // внешние касательные для ремня
  const ang = Math.asin((r1 - r2) / CD);
  const top1 = [x1 - r1 * Math.sin(ang), y - r1 * Math.cos(ang)], top2 = [x2 - r2 * Math.sin(ang), y - r2 * Math.cos(ang)];
  const bot1 = [x1 - r1 * Math.sin(ang), y + r1 * Math.cos(ang)], bot2 = [x2 - r2 * Math.sin(ang), y + r2 * Math.cos(ang)];
  const belt = `M${top1} L${top2} A${r2},${r2} 0 ${r2 > r1 ? 1 : 0} 1 ${bot2} L${bot1} A${r1},${r1} 0 ${r1 >= r2 ? 1 : 0} 1 ${top1}`;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Вариатор', color: '#5aa8ff' }) });
  const spokes = (cx: number, a: number, r: number, c: string) => Array.from({ length: 6 }, (_, k) => <line key={k} x1={cx} y1={y} x2={cx + r * Math.cos(a + (k * Math.PI) / 3)} y2={y + r * Math.sin(a + (k * Math.PI) / 3)} stroke={c} strokeWidth={2} strokeOpacity=".5" />);
  // разрез шкивов (вид сбоку): половинки-конусы, ремень на радиусе
  const cone = (cx: number, r: number, c: string) => {
    const gap = 6 + (1 - (r - 25) / 90) * 26;
    return (
      <g>
        <path d={`M${cx - gap / 2},${400} L${cx - gap / 2 - 50},${290} L${cx - gap / 2 - 50},${400} Z`} fill={c} opacity=".35" />
        <path d={`M${cx + gap / 2},${400} L${cx + gap / 2 + 50},${290} L${cx + gap / 2 + 50},${400} Z`} fill={c} opacity=".35" />
        <path d={`M${cx - gap / 2},400 L${cx - gap / 2 - 50},290 M${cx + gap / 2},400 L${cx + gap / 2 + 50},290`} stroke={c} strokeWidth={2} />
        <rect x={cx - 14} y={400 - r * 0.95 - 8} width={28} height={12} rx={2} fill="#c7d4e8" />
      </g>
    );
  };
  return (
    <div className="split">
      <Stage label={<>FIG. 13 — <b>Вариатор CVT</b> · вид спереди и разрез шкивов</>} hint="нажмите на шкив или ремень">
        <svg viewBox="40 40 560 380" className="fig">
          <g {...hit('p1')}>
            <circle className="hl" cx={x1} cy={y} r={120} fill="#0d1628" stroke="#2c3b58" strokeDasharray="4 6" />
            <circle cx={x1} cy={y} r={r1} fill="#13203a" stroke="#ff8a4c" strokeWidth={2} />
            {spokes(x1, st.a1, r1, '#ff8a4c')}
            <text x={x1} y={y + 140} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>от двигателя</text>
          </g>
          <g {...hit('p2')}>
            <circle className="hl" cx={x2} cy={y} r={120} fill="#0d1628" stroke="#2c3b58" strokeDasharray="4 6" />
            <circle cx={x2} cy={y} r={r2} fill="#13203a" stroke="#36e0a0" strokeWidth={2} />
            {spokes(x2, st.a2, r2, '#36e0a0')}
            <text x={x2} y={y + 140} textAnchor="middle" className="svg-label" style={{ fill: '#36e0a0' }}>к колёсам</text>
          </g>
          <g {...hit('belt')}>
            <path className="hl" d={belt} fill="none" stroke="#c7d4e8" strokeWidth={9} />
            <path d={belt} fill="none" stroke="#3a4b6c" strokeWidth={9} strokeDasharray="3 3" strokeDashoffset={-st.a1 * r1 * 0.02} />
          </g>
          <g transform="translate(0 0)">
            {cone(x1 + 0, r1, '#ff8a4c')}
            {cone(x2, r2, '#36e0a0')}
          </g>
        </svg>
        <div className="stage-ctl">
          <HoldButton className="btn primary" onHold={setGas}>Газ (держать)</HoldButton>
          <button className="btn" onClick={() => { s.current.v = 0; s.current.i = IMAX; }}>Остановиться</button>
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <div className="grid2">
            <Gauge label="Обороты" digits={0} value={st.rpm} max={6000} unit="об/мин" color="#ff8a4c" />
            <Gauge label="Скорость" digits={0} value={st.v * 3.6} max={180} unit="км/ч" color="#36e0a0" />
          </div>
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>Передаточное</dt><dd>{st.i.toFixed(2).replace('.', ',')} {st.i > 1.05 ? '— понижающее' : st.i < 0.95 ? '— повышающее' : '— прямое'}</dd>
          </dl>
          <TorqueTrace data={rpmTr.current} color="#ff8a4c" label="обороты" />
          <TorqueTrace data={spdTr.current} color="#36e0a0" label="скорость" />
        </div>
        <Callout kind="info">Держите «Газ»: обороты подскакивают и стоят почти на месте, а скорость растёт плавно — шкивы непрерывно меняют радиус. У ступенчатой коробки обороты рисовали бы «пилу».</Callout>
      </div>
    </div>
  );
}
