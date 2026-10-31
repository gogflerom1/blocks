import { useRef, useState } from 'react';
import { clamp, mix, useTicker } from '../../lib/anim';
import { useSubTab } from '../../lib/router';
import { useInfo } from '../../lib/info';
import { Particles, Pipe, Pt } from '../../lib/path';
import { Callout, Chain, ModHead, Pedal, Range, Seg, Stage, Tabs } from '../../ui/kit';
import { Gauge } from '../engine/Turbo';

const LINE: Pt[] = [[380, 160], [470, 160], [470, 300], [540, 300]];
const INFO: Record<string, [string, string]> = {
  pedal: ['Педаль тормоза', 'Рычаг: усилие ноги увеличивается в несколько раз. Педаль толкает шток в вакуумный усилитель.'],
  booster: ['Вакуумный усилитель', 'Большая «шайба» на перегородке моторного отсека. Использует разрежение во впуске (или от вакуумного насоса), чтобы многократно увеличить усилие ноги. При заглушенном моторе после 1–2 нажатий педаль становится очень тугой.'],
  mc: ['Главный тормозной цилиндр', 'Поршни выдавливают жидкость в магистрали. Контуров два (часто по диагонали): если один потечёт, второй всё равно затормозит.'],
  res: ['Бачок тормозной жидкости', 'Запас жидкости. Уровень между MIN и MAX, медленно падает по мере износа колодок.'],
  line: ['Тормозные трубки', 'Жидкость практически не сжимается: давление, созданное в главном цилиндре, без потерь передаётся к каждому колесу.'],
  caliper: ['Суппорт и колодки', 'Поршень суппорта прижимает колодки к диску с обеих сторон. Трение превращает энергию движения в тепло — диск может нагреться до 300–600 °C.'],
  disc: ['Тормозной диск', 'Вращается вместе с колесом. Чем он массивнее и лучше вентилируется, тем дольше держит нагрев без потери эффективности.'],
};

export function Hydraulics() {
  const info = useInfo();
  const [pedal, setPedal] = useState(0);
  const [water, setWater] = useState(1);
  const [pad, setPad] = useState(9);
  const [hill, setHill] = useState(false);
  const s = useRef({ v: 80, T: 60, ang: 0, ph: 0 });
  const [, force] = useState(0);
  const bp = 230 - (75 / 3.7) * water;
  useTicker((dt) => {
    const st = s.current;
    const fluidT = st.T * 0.4 + 20;
    const vapor = fluidT > bp;
    const press = pedal * (vapor ? 0.35 : 1);
    const mu = st.T > 550 ? clamp(1 - (st.T - 550) / 400, 0.35, 1) : 1;
    const decel = press * 8.5 * mu * (pad > 0 ? 1 : 0.6);
    if (hill) st.v = Math.max(st.v, 60);
    const power = decel * st.v;
    st.v = Math.max(0, st.v - decel * dt * 3.6 * (hill ? 0 : 1));
    st.T += (power * 0.09 - (st.T - 20) * 0.012 * (1 + st.v / 60)) * dt * 3;
    st.ang += (st.v / 3.6 / 0.31) * dt * 57.3 * 0.2;
    st.ph += dt * pedal * 1.5;
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const fluidT = st.T * 0.4 + 20;
  const vapor = fluidT > bp;
  const fade = st.T > 550;
  const pressure = pedal * (vapor ? 0.35 : 1) * 110;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Тормоза', color: '#ff4b5c' }) });
  const discC = mix('#5a6d90', st.T > 400 ? '#ff6a3c' : '#a33', clamp((st.T - 150) / 350));
  const padMm = pad;
  return (
    <div className="split">
      <Stage label={<>FIG. 30 — <b>Гидравлический тормоз</b></>} hint="нажмите на узел">
        <svg viewBox="20 40 800 380" className="fig">
          <g {...hit('pedal')}>
            <g transform={`rotate(${pedal * 22} 90 80)`}>
              <path className="hl" d="M90,80 L70,270" stroke="#8fa3c6" strokeWidth={10} strokeLinecap="round" />
              <rect x={44} y={262} width={54} height={20} rx={6} fill="#2a3a5a" stroke="#c7d4e8" />
            </g>
            <circle cx={90} cy={80} r={8} fill="#5a6d90" />
            <line x1={84} y1={150} x2={150 + pedal * 12} y2={160} stroke="#c7d4e8" strokeWidth={5} />
          </g>
          <g {...hit('booster')}>
            <circle className="hl" cx={205} cy={160} r={58} fill="#1b2433" stroke="#5a6d90" strokeWidth={2} />
            <path d={`M${190 + pedal * 10},110 Q${215 + pedal * 10},160 ${190 + pedal * 10},210`} stroke="#3de2ff" strokeOpacity=".5" fill="none" strokeWidth={3} />
            <text x={205} y={240} textAnchor="middle" className="svg-label">усилитель</text>
          </g>
          <g {...hit('mc')}>
            <rect className="hl" x={265} y={140} width={115} height={40} rx={8} fill="#232d3f" stroke="#8fa3c6" />
            <rect x={270 + pedal * 40} y={146} width={14} height={28} rx={3} fill="#c7d4e8" />
            <rect x={284 + pedal * 40} y={148} width={92 - pedal * 40} height={24} fill="#c79bff" opacity={0.25 + pedal * 0.5} />
          </g>
          <g {...hit('res')}>
            <rect className="hl" x={285} y={86} width={70} height={46} rx={8} fill="rgba(230,240,255,.1)" stroke="#c7d4e8" />
            <rect x={289} y={104 + (12 - padMm) * 0.8} width={62} height={24 - (12 - padMm) * 0.8} rx={5} fill="#d9c27a" opacity=".6" />
            <rect x={306} y={76} width={28} height={12} rx={3} fill="#ffd54a" />
          </g>
          <g {...hit('line')}>
            <Pipe pts={LINE} color="#c79bff" w={10} on={pedal > 0.02} />
            {pedal > 0.02 && <Particles pts={LINE} phase={st.ph} n={10} color="#c79bff" r={2.6} />}
            {vapor && Array.from({ length: 6 }, (_, i) => <circle key={i} cx={480 + (i * 13) % 50} cy={286 + (i % 3) * 6} r={3 + (i % 2)} fill="none" stroke="#fff" strokeOpacity=".8" />)}
          </g>
          <g {...hit('disc')}>
            <circle className="hl" cx={650} cy={230} r={118} fill="#1b2230" stroke={discC} strokeWidth={14} style={st.T > 300 ? { filter: `drop-shadow(0 0 ${clamp((st.T - 300) / 20, 0, 18)}px ${discC})` } : undefined} />
            <g transform={`rotate(${st.ang} 650 230)`}>
              {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={650 + 82 * Math.cos(i * 0.628)} cy={230 + 82 * Math.sin(i * 0.628)} r={5} fill="#0a1222" />)}
              {Array.from({ length: 5 }, (_, i) => <circle key={'b' + i} cx={650 + 30 * Math.cos(i * 1.256)} cy={230 + 30 * Math.sin(i * 1.256)} r={6} fill="#5a6d90" />)}
            </g>
            <circle cx={650} cy={230} r={18} fill="#3a4a69" />
          </g>
          <g {...hit('caliper')}>
            <path className="hl" d="M528,250 Q530,330 590,352 L606,330 Q560,312 556,250 Z" fill={pedal > 0.05 ? '#ff4b5c' : '#a33'} stroke="#ffb3bb" strokeWidth={1.2} style={pedal > 0.05 ? { filter: 'drop-shadow(0 0 8px #ff4b5c)' } : undefined} />
          </g>
          {/* разрез: суппорт, поршень, колодки */}
          <g transform="translate(40 300)">
            <rect x={0} y={0} width={200} height={110} rx={12} fill="#060b16" stroke="#1f2d48" />
            <text x={10} y={18} className="svg-label">разрез суппорта</text>
            <rect x={96} y={24} width={10} height={76} fill={discC} />
            <rect x={96 - 2 - padMm * 1.6 - (1 - pedal) * 6} y={34} width={padMm * 1.6} height={56} fill="#f0a531" />
            <rect x={96 - 6 - padMm * 1.6 - (1 - pedal) * 6} y={30} width={4} height={64} fill="#8fa3c6" />
            <rect x={108 + (1 - pedal) * 6} y={34} width={padMm * 1.6} height={56} fill="#f0a531" />
            <rect x={110 + padMm * 1.6 + (1 - pedal) * 6} y={30} width={4} height={64} fill="#8fa3c6" />
            <rect x={30} y={44} width={40 - padMm * 1.6 - (1 - pedal) * 6 + 22} height={36} fill="#c79bff" opacity=".4" />
            <text x={160} y={104} textAnchor="middle" className="mono" style={{ fontSize: 10, fill: padMm < 3 ? '#ff4b5c' : '#a7b6cf' }}>{padMm.toFixed(0)} мм</text>
          </g>
          <text x={650} y={392} textAnchor="middle" className="mono" style={{ fontSize: 13, fill: discC }}>диск ≈ {Math.round(st.T)} °C</text>
        </svg>
      </Stage>
      <div className="stack">
        <div className="panel row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Pedal label="Тормоз" value={pedal} onChange={setPedal} color="#ff4b5c" />
          <div className="stack" style={{ flex: 1, minWidth: 180 }}>
            <Gauge label="Скорость" digits={0} value={st.v} max={140} unit="км/ч" color="#36e0a0" />
            <Gauge label="Давление" digits={0} value={pressure} max={150} unit="бар" color="#c79bff" />
            <div className="row">
              <button className="btn sm" onClick={() => { s.current.v = 100; }}>Разогнать</button>
              <button className={`btn sm${hill ? ' on' : ''}`} onClick={() => setHill(!hill)}>Затяжной спуск</button>
              <button className="btn sm" onClick={() => { s.current.T = 60; }}>Остудить</button>
            </div>
          </div>
        </div>
        <div className="panel stack">
          <Range id="pads" label="Толщина колодок" value={pad} min={0} max={12} step={0.5} onChange={setPad} fmt={(x) => `${x} мм`} />
          <Range id="water" label="Вода в тормозной жидкости" value={water} min={0} max={5} step={0.1} onChange={setWater} fmt={(x) => `${x.toFixed(1)}% · кипит при ${Math.round(230 - (75 / 3.7) * x)} °C`} />
        </div>
        {vapor ? <Callout kind="stop"><b>Жидкость закипела — педаль проваливается.</b> Пар сжимается, в отличие от жидкости. Старая жидкость с водой закипает раньше — поэтому её меняют по времени.</Callout>
          : fade ? <Callout kind="warn"><b>Перегрев колодок (fade).</b> Трение падает — машина тормозит хуже при той же педали. На спусках тормозите двигателем: пониженная передача.</Callout>
          : pad < 0.5 ? <Callout kind="stop"><b>Скрежет: металл по диску.</b> Колодок не осталось — тормоза слабые, диск уничтожается. Сразу в сервис.</Callout>
          : pad < 3 ? <Callout kind="warn"><b>Пищит индикатор износа.</b> Пора менять колодки.</Callout>
          : <Callout kind="info">Нажмите педаль: давление жидкости одинаково во всей системе и прижимает колодки к диску. Энергия движения уходит в нагрев.</Callout>}
        <Chain items={['Педаль', 'Усилитель', 'Главный цилиндр', 'Жидкость', 'Суппорт', 'Колодки', 'Диск']} active={pedal > 0.02 ? 6 : -1} />
      </div>
    </div>
  );
}

/* ── ABS ─────────────────────────────── */
type Lane = { x: number; y: number; v: number; wheel: number; hit: boolean; stop: boolean; pres: number[]; wv: number[]; vv: number[] };
const OBST = 520;
const freshLane = (y: number): Lane => ({ x: 60, y, v: 1, wheel: 1, hit: false, stop: false, pres: [], wv: [], vv: [] });

function ABS() {
  const [run, setRun] = useState(false);
  const L = useRef({ a: freshLane(0), b: freshLane(0), t: 0 });
  const [, force] = useState(0);
  useTicker((dt) => {
    if (!run) return;
    const S = L.current;
    S.t += dt;
    for (const [lane, abs] of [[S.a, false], [S.b, true]] as const) {
      if (lane.stop) continue;
      const decel = abs ? 0.33 : 0.28;
      lane.v = Math.max(0, lane.v - decel * dt);
      if (abs) {
        const cyc = (S.t * 12) % 1;
        lane.wheel = lane.v * (0.82 + 0.16 * Math.abs(Math.sin(cyc * Math.PI)));
        lane.pres.push(0.55 + 0.4 * Math.sin(cyc * Math.PI * 2));
        // управляемость сохраняется: объезжаем
        if (lane.x > 300 && lane.x < 560) lane.y = Math.min(1, lane.y + dt * 2.2);
        if (lane.x > 600) lane.y = Math.max(0.6, lane.y - dt * 0.4);
      } else {
        lane.wheel = 0;
        lane.pres.push(1);
      }
      lane.wv.push(lane.wheel); lane.vv.push(lane.v);
      if (lane.pres.length > 140) { lane.pres.shift(); lane.wv.shift(); lane.vv.shift(); }
      lane.x += lane.v * dt * 400;
      if (!abs && lane.x >= OBST - 70) { lane.hit = true; lane.stop = true; lane.x = OBST - 70; }
      if (lane.v <= 0) lane.stop = true;
    }
    force((n) => (n + 1) % 1e6);
  });
  const reset = () => { L.current = { a: freshLane(0), b: freshLane(0), t: 0 }; setRun(false); force((n) => n + 1); };
  const S = L.current;
  const laneSvg = (lane: Lane, abs: boolean, y0: number) => (
    <g transform={`translate(0 ${y0})`}>
      <rect x={0} y={0} width={820} height={120} fill="#0b1222" />
      <line x1={0} x2={820} y1={60} y2={60} stroke="#3a4b6c" strokeDasharray="20 14" />
      <rect x={OBST} y={74} width={34} height={36} rx={4} fill="#ffb547" stroke="#fff" strokeOpacity=".4" />
      <text x={OBST + 17} y={128} textAnchor="middle" className="svg-label" style={{ fontSize: 10 }}>препятствие</text>
      {/* следы юза */}
      {!abs && lane.x > 260 && <path d={`M260,84 H${lane.x - 10} M260,104 H${lane.x - 10}`} stroke="#000" strokeOpacity=".6" strokeWidth={6} />}
      <g transform={`translate(${lane.x} ${92 - lane.y * 58}) rotate(${abs && lane.x > 300 && lane.x < 600 ? (lane.y < 1 ? -10 : 0) : 0})`}>
        <rect x={-36} y={-14} width={72} height={28} rx={8} fill="#13203a" stroke={lane.hit ? '#ff4b5c' : '#3de2ff'} strokeWidth={2} />
        {[-22, 22].map((dx) => [-14, 14].map((dy) => <rect key={`${dx}${dy}`} x={dx - 7} y={dy - 3} width={14} height={6} rx={2} fill={!abs && run ? '#ff4b5c' : '#c7d4e8'} />))}
      </g>
      {lane.hit && <text x={OBST - 30} y={30} className="mono" style={{ fontSize: 13, fill: '#ff4b5c' }}>УДАР</text>}
      <text x={10} y={20} className="mono" style={{ fontSize: 12, fill: abs ? '#36e0a0' : '#ff8a99' }}>{abs ? 'С ABS — колёса крутятся, руль работает' : 'БЕЗ ABS — колёса заблокированы, руль не работает'}</text>
    </g>
  );
  const graph = (lane: Lane, color: string) => {
    const W = 360, H = 70;
    const P = (arr: number[]) => arr.map((v, i) => `${(i / 139) * W},${H - 6 - v * (H - 14)}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <polyline points={P(lane.vv)} fill="none" stroke="#a7b6cf" strokeWidth={1.5} strokeDasharray="4 3" />
        <polyline points={P(lane.wv)} fill="none" stroke={color} strokeWidth={2} />
      </svg>
    );
  };
  return (
    <div className="split">
      <Stage label={<>SIM — <b>Экстренное торможение с объездом</b></>}>
        <svg viewBox="0 0 820 270" className="fig">
          {laneSvg(S.a, false, 10)}
          {laneSvg(S.b, true, 145)}
        </svg>
        <div className="stage-ctl">
          <button className="btn primary" onClick={() => { reset(); setTimeout(() => setRun(true), 30); }}>Тормозим в пол!</button>
          <button className="btn" onClick={reset}>Сброс</button>
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <span className="eyebrow">Скорость колеса (сплошная) и машины (пунктир)</span>
          <p className="muted" style={{ fontSize: 12.5 }}>Без ABS</p>{graph(S.a, '#ff4b5c')}
          <p className="muted" style={{ fontSize: 12.5 }}>С ABS — давление сбрасывается и подаётся 10–15 раз в секунду</p>{graph(S.b, '#36e0a0')}
        </div>
        <Callout kind="info">Главное, что даёт ABS, — возможность рулить во время экстренного торможения. Заблокированное колесо скользит и не поворачивает машину. На рыхлом снегу или гравии тормозной путь с ABS бывает даже длиннее.</Callout>
        <Callout kind="warn">Если машина с ABS: тормозите в пол и держите, вибрация педали — это нормально. Не «качайте» тормоз.</Callout>
      </div>
    </div>
  );
}

/* ── ESP ─────────────────────────────── */
function ESP() {
  const [esp, setEsp] = useState(true);
  const [run, setRun] = useState(false);
  const s = useRef({ u: 0, yaw: 0, off: 0, flash: 0 });
  const [, force] = useState(0);
  useTicker((dt) => {
    if (!run) return;
    const st = s.current;
    st.u = Math.min(1, st.u + dt * 0.28);
    if (st.u > 0.3 && st.u < 0.85) {
      if (esp) { st.yaw += (8 - st.yaw) * dt * 3; st.flash = 1; }
      else { st.yaw += dt * 140; st.off += dt * 0.35 * (st.u - 0.3); }
    } else { st.flash = Math.max(0, st.flash - dt * 2); if (esp) st.yaw *= 1 - dt * 3; }
    if (st.u >= 1) setRun(false);
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const cx = 300, cy = 420, R = 300;
  const ang = -Math.PI + st.u * Math.PI * 0.85;
  const r = R + st.off * 260;
  const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
  const heading = (ang * 180) / Math.PI + 90 + st.yaw;
  return (
    <div className="split">
      <Stage label={<>SIM — <b>ESP в повороте на скользкой дороге</b> · занос задней оси</>}>
        <svg viewBox="0 0 600 440" className="fig">
          <path d={`M${cx - R - 40},${cy} A${R + 40},${R + 40} 0 0 1 ${cx + R + 40},${cy}`} fill="none" stroke="#0b1222" strokeWidth={0} />
          <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="#1b2a46" strokeWidth={70} />
          <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="#3a4b6c" strokeWidth={2} strokeDasharray="14 12" />
          <g transform={`translate(${x} ${y}) rotate(${heading})`}>
            <rect x={-14} y={-28} width={28} height={56} rx={7} fill="#13203a" stroke="#3de2ff" strokeWidth={2} />
            <rect x={-18} y={-24} width={6} height={12} rx={2} fill={esp && st.flash > 0.5 && Math.sin(performance.now() / 60) > 0 ? '#ff4b5c' : '#c7d4e8'} />
            <rect x={12} y={-24} width={6} height={12} rx={2} fill="#c7d4e8" />
            <rect x={-18} y={12} width={6} height={12} rx={2} fill="#c7d4e8" />
            <rect x={12} y={12} width={6} height={12} rx={2} fill="#c7d4e8" />
            <path d="M0,-34 l-6,8 h12 Z" fill="#3de2ff" />
          </g>
          {esp && st.flash > 0.5 && <text x={300} y={250} textAnchor="middle" className="mono" style={{ fontSize: 13, fill: '#ff8a99' }}>ESP подтормаживает внешнее переднее колесо</text>}
          {!esp && st.off > 0.15 && <text x={300} y={250} textAnchor="middle" className="mono" style={{ fontSize: 14, fill: '#ff4b5c' }}>РАЗВОРОТ — машина ушла с траектории</text>}
        </svg>
        <div className="stage-ctl">
          <Seg value={esp ? 'on' : 'off'} onChange={(v) => setEsp(v === 'on')} options={[{ v: 'on', l: 'ESP вкл' }, { v: 'off', l: 'ESP выкл' }]} />
          <button className="btn primary" onClick={() => { s.current = { u: 0, yaw: 0, off: 0, flash: 0 }; setRun(true); }}>Войти в поворот</button>
        </div>
      </Stage>
      <div className="stack">
        <Callout kind="info">ESP сравнивает, куда вы рулите (датчик угла руля), и куда машина реально поворачивает (датчик рыскания). Заносит зад — подтормаживает внешнее переднее колесо. Сносит перёд — внутреннее заднее. Плюс снижает тягу двигателя.</Callout>
        <p className="muted" style={{ fontSize: 13.5 }}>Мигающая лампа ESP на приборке во время езды значит, что система прямо сейчас ловит машину. Сбросьте скорость.</p>
      </div>
    </div>
  );
}

const TABS = [{ id: 'hydro', label: 'Как работают' }, { id: 'abs', label: 'ABS' }, { id: 'esp', label: 'ESP' }] as const;
type T = (typeof TABS)[number]['id'];
export function BrakesModule({ sub }: { sub: string }) {
  const [tab, setTab] = useSubTab<T>('brakes', TABS.map((t) => t.id), sub);
  return (
    <>
      <ModHead title="Тормоза" lead="Педаль → жидкость → колодки → тепло. Нажимайте, перегревайте, проверяйте ABS." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'hydro' && <Hydraulics />}
      {tab === 'abs' && <ABS />}
      {tab === 'esp' && <ESP />}
    </>
  );
}
