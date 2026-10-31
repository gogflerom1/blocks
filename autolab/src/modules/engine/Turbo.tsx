import { useRef, useState } from 'react';
import { clamp, mix, useTicker } from '../../lib/anim';
import { Particles, Pipe, Pt } from '../../lib/path';
import { useInfo } from '../../lib/info';
import { Callout, HoldButton, Range, Seg, Stage } from '../../ui/kit';

const AIR_IN: Pt[] = [[70, 92], [430, 92], [470, 130]];
const C_OUT: Pt[] = [[520, 188], [520, 240], [270, 240]];
const IC_OUT: Pt[] = [[150, 300], [150, 360], [300, 360]];
const NA_AIR: Pt[] = [[70, 92], [110, 92], [110, 360], [300, 360]];
const MANI: Pt[] = [[340, 360], [380, 360], [380, 318], [560, 318]];
const EXH: Pt[] = [[660, 360], [700, 360], [700, 200], [690, 182]];
const T_OUT: Pt[] = [[720, 130], [860, 130], [860, 230]];
const NA_EXH: Pt[] = [[660, 360], [860, 360], [860, 420]];
const WG: Pt[] = [[700, 250], [760, 250], [800, 130]];

const PARTS: Record<string, [string, string]> = {
  turbine: ['Турбина (горячая часть)', 'Выхлопные газы, которые иначе просто ушли бы в трубу, раскручивают турбинное колесо до 150–250 тысяч об/мин. Корпус раскаляется — бывает до 900 °C у бензиновых моторов.'],
  compressor: ['Компрессор (холодная часть)', 'Сидит на одном валу с турбиной. Его колесо засасывает воздух и сжимает его — в цилиндр помещается больше воздуха, а значит, можно сжечь больше топлива.'],
  shaft: ['Вал и подшипники', 'Вал вращается в масляной плёнке. Поэтому турбомоторам критичны качественное масло и вовремя замененный фильтр. После жёсткой езды полезно дать мотору поработать 30–60 секунд, чтобы турбина остыла.'],
  ic: ['Интеркулер', 'Радиатор для воздуха. При сжатии воздух нагревается до 100–150 °C, горячий воздух менее плотный. Интеркулер охлаждает его — в цилиндр попадает больше кислорода.'],
  wg: ['Вестгейт (перепускной клапан)', 'Ограничивает давление наддува: открывается и пускает часть выхлопа в обход турбины. Без него турбина раскручивалась бы бесконечно.'],
  throttle: ['Дроссельная заслонка', 'Регулирует, сколько воздуха попадёт в двигатель. У атмосферника на прикрытой заслонке во впуске разрежение — давление ниже атмосферного.'],
  filter: ['Воздушный фильтр', 'Задерживает пыль. Забитый фильтр «душит» двигатель. Это один из самых простых расходников — часто меняется своими руками.'],
  engine: ['Двигатель', 'Сколько воздуха вошло в цилиндры — столько топлива можно сжечь. Наддув позволяет маленькому мотору выдавать мощность большого атмосферного.'],
};

function Wheel({ x, y, r, angle, color }: { x: number; y: number; r: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <circle r={r} fill="#0a1222" stroke={color} strokeWidth="1.5" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M0,0 Q${r * 0.5},${-r * 0.2} ${r * 0.92},${-r * 0.42}`} stroke={color} strokeWidth="3" fill="none" transform={`rotate(${i * 36})`} strokeLinecap="round" />
      ))}
      <circle r={r * 0.22} fill={color} />
    </g>
  );
}

export function Turbo() {
  const [turbo, setTurbo] = useState(true);
  const [thr, setThr] = useState(0.25);
  const [hold, setHold] = useState(false);
  const info = useInfo();
  const s = useRef({ n: 0.05, map: 0.45, ang: 0, ph: { air: 0, comp: 0, ic: 0, man: 0, exh: 0, out: 0, wg: 0 } });
  const [, force] = useState(0);
  const throttle = hold ? 1 : thr;
  useTicker((dt) => {
    const st = s.current;
    const rpm = 900 + throttle * 4600;
    const exhaustEnergy = throttle * (rpm / 5500);
    const target = turbo ? clamp(exhaustEnergy * 1.25) : 0;
    st.n += (target - st.n) * dt * (target > st.n ? 0.9 : 1.6); // раскрутка медленнее, чем спад — это и есть турбояма
    const boost = turbo ? Math.min(0.9, st.n * st.n * 1.35) : 0;
    const mapTarget = 0.32 + 0.66 * throttle + boost * throttle;
    st.map += (mapTarget - st.map) * dt * 4;
    st.ang = (st.ang + st.n * dt * 2400) % 360;
    const flow = (rpm / 5500) * (0.3 + st.map) * 0.6;
    for (const k of ['air', 'comp', 'ic', 'man'] as const) st.ph[k] += dt * flow * (k === 'air' ? 0.9 : 0.7);
    st.ph.exh += dt * flow * 0.9;
    st.ph.out += dt * flow * 0.8;
    st.ph.wg += dt * flow * 0.8;
    force((x) => (x + 1) % 1e6);
  });
  const st = s.current;
  const boost = turbo ? Math.min(0.9, st.n * st.n * 1.35) : 0;
  const wgOpen = turbo && boost >= 0.88;
  const rpm = 900 + throttle * 4600;
  const tC = turbo ? 20 + boost * 120 : 20;
  const power = Math.round(((st.map - 0.32) / 0.66) * 100 * (rpm / 5500) * 1.1);
  const part = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: PARTS[id][0], text: PARTS[id][1], kicker: 'Турбонаддув', color: '#ff8a4c' }) });

  return (
    <div className="split wide-aside">
      <Stage label={<>FIG. 03 — <b>{turbo ? 'Турбокомпрессор' : 'Атмосферный двигатель'}</b></>} hint="нажмите на узел">
        <div className="wide-wrap"><svg viewBox="0 0 900 470" className="fig">
          {/* воздух */}
          {turbo ? (
            <>
              <Pipe pts={AIR_IN} color="#8fd8ff" />
              <Pipe pts={C_OUT} color={mix('#8fd8ff', '#ff9a5a', boost)} w={16} />
              <Pipe pts={IC_OUT} color="#8fd8ff" w={16} />
              <Particles pts={AIR_IN} phase={st.ph.air} n={16} color="#8fd8ff" />
              <Particles pts={C_OUT} phase={st.ph.comp} n={Math.round(12 + boost * 14)} color={mix('#8fd8ff', '#ffb27a', boost)} />
              <Particles pts={IC_OUT} phase={st.ph.ic} n={Math.round(10 + boost * 14)} color="#8fd8ff" />
            </>
          ) : (
            <>
              <Pipe pts={NA_AIR} color="#8fd8ff" />
              <Particles pts={NA_AIR} phase={st.ph.air} n={16} color="#8fd8ff" />
            </>
          )}
          <Pipe pts={MANI} color="#8fd8ff" w={18} />
          <Particles pts={MANI} phase={st.ph.man} n={Math.round(8 + st.map * 12)} color="#8fd8ff" r={3.4} />
          {/* выхлоп */}
          {turbo ? (
            <>
              <Pipe pts={EXH} color="#ff6a3c" w={18} />
              <Pipe pts={T_OUT} color="#a2958c" w={18} />
              <Particles pts={EXH} phase={st.ph.exh} n={16} color="#ff7a45" r={3.4} />
              <Particles pts={T_OUT} phase={st.ph.out} n={14} color="#a2958c" r={3.4} />
              <g {...part('wg')}>
                <Pipe pts={WG} color="#ff6a3c" w={10} on={wgOpen} />
                {wgOpen && <Particles pts={WG} phase={st.ph.wg} n={6} color="#ff7a45" r={2.6} />}
                <circle className="hl" cx={760} cy={250} r={13} fill="#13203a" stroke={wgOpen ? '#ff6a3c' : '#3a4b6c'} strokeWidth="2" />
                <line x1={752} y1={250} x2={768} y2={250} stroke="#c7d4e8" strokeWidth="3" transform={`rotate(${wgOpen ? 80 : 0} 760 250)`} />
                <text x={780} y={276} className="svg-label" style={{ fill: wgOpen ? '#ff8a4c' : undefined }}>вестгейт {wgOpen ? 'открыт' : 'закрыт'}</text>
              </g>
            </>
          ) : (
            <>
              <Pipe pts={NA_EXH} color="#ff6a3c" w={18} />
              <Particles pts={NA_EXH} phase={st.ph.exh} n={12} color="#ff7a45" r={3.4} />
            </>
          )}

          {/* фильтр */}
          <g {...part('filter')}>
            <rect className="hl" x={22} y={64} width={56} height={56} rx={10} fill="#13203a" stroke="#3a4b6c" />
            {Array.from({ length: 6 }, (_, i) => <line key={i} x1={30 + i * 8} y1={72} x2={30 + i * 8} y2={112} stroke="#5a6d90" />)}
            <text x={50} y={142} textAnchor="middle" className="svg-label">фильтр</text>
          </g>
          {/* интеркулер */}
          {turbo && (
            <g {...part('ic')}>
              <rect className="hl" x={100} y={212} width={170} height={96} rx={8} fill="#0d1a2e" stroke="#4dd6c4" strokeOpacity=".6" />
              {Array.from({ length: 15 }, (_, i) => <line key={i} x1={110 + i * 10.5} y1={220} x2={110 + i * 10.5} y2={300} stroke="#4dd6c4" strokeOpacity=".35" />)}
              <text x={185} y={200} textAnchor="middle" className="svg-label">интеркулер</text>
              <text x={185} y={334} textAnchor="middle" className="svg-label" style={{ fill: '#8fd8ff' }}>{Math.round(20 + boost * 28)} °C</text>
            </g>
          )}
          {/* дроссель */}
          <g {...part('throttle')}>
            <circle cx={320} cy={360} r={18} fill="#0a1222" stroke="#3a4b6c" strokeWidth="2" />
            <line className="hl" x1={320 - 15 * Math.cos(1.45 - throttle * 1.3)} y1={360 - 15 * Math.sin(1.45 - throttle * 1.3)} x2={320 + 15 * Math.cos(1.45 - throttle * 1.3)} y2={360 + 15 * Math.sin(1.45 - throttle * 1.3)} stroke="#c7d4e8" strokeWidth="4" strokeLinecap="round" />
            <text x={320} y={398} textAnchor="middle" className="svg-label">дроссель</text>
          </g>
          {/* двигатель */}
          <g {...part('engine')}>
            <rect className="hl" x={400} y={300} width={260} height={150} rx={14} fill="#13203a" stroke="#3a4b6c" />
            {[0, 1, 2, 3].map((i) => {
              const ph = st.ang * 0 + (performance.now() / 1000) * (rpm / 60) * 0.35 * Math.PI * 2 + [0, Math.PI, Math.PI, 0][i];
              const y = 360 + Math.cos(ph) * 16;
              return (
                <g key={i}>
                  <rect x={420 + i * 60} y={330} width={44} height={100} rx={4} fill="#050912" stroke="#2c3b58" />
                  <rect x={422 + i * 60} y={332} width={40} height={y - 332} fill="#8fd8ff" opacity={0.15 + st.map * 0.25} />
                  <rect x={422 + i * 60} y={y} width={40} height={22} rx={3} fill="#c7d4e8" />
                </g>
              );
            })}
            <text x={530} y={470} textAnchor="middle" className="svg-label">двигатель · {Math.round(rpm)} об/мин</text>
          </g>

          {/* турбина: компрессор — вал — турбина */}
          <g opacity={turbo ? 1 : 0.15}>
            <g {...part('compressor')}>
              <path className="hl" d="M520,72 a62,62 0 1 1 -1,0 Z" fill="#0f2238" stroke="#3fb4ff" strokeWidth="2" />
              <Wheel x={520} y={130} r={42} angle={st.ang} color="#8fd8ff" />
              <text x={520} y={52} textAnchor="middle" className="svg-label" style={{ fill: '#8fd8ff' }}>компрессор</text>
            </g>
            <g {...part('shaft')}>
              <rect className="hl" x={572} y={116} width={76} height={28} rx={6} fill="#2a3650" stroke="#5a6d90" />
              <rect x={582} y={126} width={56} height={8} fill="#c7d4e8" />
              <text x={610} y={168} textAnchor="middle" className="svg-label">вал</text>
            </g>
            <g {...part('turbine')}>
              <path className="hl" d="M700,72 a62,62 0 1 1 -1,0 Z" fill="#2a1410" stroke="#ff6a3c" strokeWidth="2" />
              <Wheel x={700} y={130} r={42} angle={-st.ang} color="#ff8a4c" />
              <text x={700} y={52} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>турбина</text>
            </g>
          </g>
          <text x={860} y={turbo ? 252 : 442} textAnchor="middle" className="svg-label">к катализатору</text>
        </svg></div>
        <div className="stage-ctl">
          <Seg value={turbo ? 't' : 'na'} onChange={(v) => setTurbo(v === 't')} options={[{ v: 'na', l: 'Атмосферный' }, { v: 't', l: 'Турбо' }]} />
          <HoldButton className="btn primary" onHold={setHold}>Газ в пол (держать)</HoldButton>
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <span className="eyebrow">Приборы</span>
          <div className="grid2" style={{ gap: 14 }}>
            <Gauge label="Давление во впуске" value={st.map} max={2} unit="бар абс." color={st.map > 1.02 ? '#ff8a4c' : '#3de2ff'} note={st.map < 0.98 ? 'разрежение' : st.map > 1.05 ? 'наддув' : 'атмосфера'} />
            <Gauge label="Турбина" value={turbo ? st.n * 220 : 0} max={220} unit="тыс. об/мин" color="#ff8a4c" />
            <Gauge label="Воздух после компрессора" value={tC} max={160} unit="°C" color="#ffb27a" />
            <Gauge label="Мощность (условно)" value={Math.max(0, power)} max={200} unit="%" color="#36e0a0" />
          </div>
          <div style={{ marginTop: 14 }}>
            <Range id="thr" label="Педаль газа" value={Math.round(thr * 100)} min={0} max={100} onChange={(v) => setThr(v / 100)} fmt={(v) => `${v}%`} />
          </div>
        </div>
        <div className="panel">
          <h3>Путь воздуха и газов</h3>
          <p className="muted">Выхлоп → турбина → вал → компрессор → сжатый горячий воздух → интеркулер → дроссель → цилиндры.</p>
          <p className="muted">Нажмите «Газ в пол» и смотрите на стрелку давления: она растёт не сразу. Турбине нужно время раскрутиться — это <b style={{ color: 'var(--ink)' }}>турбояма</b>.</p>
        </div>
        <Callout kind="info">Атмосферный мотор вдыхает воздух сам, и давление во впуске не выше атмосферного. Турбо дожимает до 1,5–2 бар (абсолютных) — в цилиндр помещается больше воздуха и топлива.</Callout>
      </div>
    </div>
  );
}

export function Gauge({ label, value, max, unit, color, note, digits }: { label: string; value: number; max: number; unit: string; color: string; note?: string; digits?: number }) {
  const p = clamp(value / max);
  const a0 = -220, a1 = 40, a = a0 + (a1 - a0) * p;
  const arc = (from: number, to: number) => {
    const r = 34, cx = 40, cy = 40;
    const P = (d: number) => [cx + r * Math.cos((d * Math.PI) / 180), cy + r * Math.sin((d * Math.PI) / 180)];
    const [x0, y0] = P(from), [x1, y1] = P(to);
    return `M${x0},${y0} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  return (
    <div className="gauge">
      <svg viewBox="0 0 80 68">
        <path d={arc(a0, a1)} stroke="rgba(130,175,255,.15)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={arc(a0, Math.max(a0 + 0.5, a))} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        <text x="40" y="44" textAnchor="middle" className="mono" style={{ fontSize: 14, fill: '#e8eefa', fontWeight: 600 }}>{digits !== undefined ? value.toFixed(digits) : value >= 10 ? Math.round(value) : value.toFixed(2)}</text>
      </svg>
      <div><b>{label}</b><span>{unit}{note ? ` · ${note}` : ''}</span></div>
    </div>
  );
}
