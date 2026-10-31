import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { FINAL_DRIVE, MT_RATIOS, speedAt } from '../../content/transmission';
import { Callout, Chain, Range, Stage } from '../../ui/kit';

type G = 'N' | '1' | '2' | '3' | '4' | '5' | 'R';
const C = 150, YI = 180, YO = 330;
const PAIRS: { g: Exclude<G, 'N'>; x: number; r1: number; r2: number; sleeve: string }[] = [
  { g: 'R', x: 300, r1: 30, r2: 95, sleeve: 'sR' },
  ...(['1', '2', '3', '4', '5'] as const).map((g, i) => {
    const r = MT_RATIOS[g];
    return { g, x: [380, 470, 560, 650, 740][i], r1: C / (1 + r), r2: (C * r) / (1 + r), sleeve: ['s12', 's12', 's34', 's34', 's5'][i] };
  }),
];
const SLEEVES: Record<string, { x: number; map: Partial<Record<G, number>> }> = {
  sR: { x: 255, map: { R: 1 } },
  s12: { x: 425, map: { '1': -1, '2': 1 } },
  s34: { x: 605, map: { '3': -1, '4': 1 } },
  s5: { x: 785, map: { '5': -1 } },
};
const GATE: Record<G, [number, number]> = { '1': [40, 40], '2': [40, 180], '3': [90, 40], '4': [90, 180], '5': [140, 40], R: [140, 180], N: [90, 110] };

const INFO: Record<string, [string, string]> = {
  clutch: ['Сцепление', 'Диск сцепления зажат между маховиком двигателя и нажимным диском. Педаль выжата — диск свободен, двигатель отсоединён от коробки. Подробно — во вкладке «Сцепление».'],
  input: ['Первичный вал', 'Получает вращение от двигателя через сцепление. На нём жёстко сидят ведущие шестерни всех передач — они крутятся всегда, когда сцепление включено.'],
  output: ['Вторичный вал', 'На нём свободно вращаются ведомые шестерни. Передача «включена», когда муфта синхронизатора соединит одну из них с валом. С вторичного вала момент идёт на главную пару.'],
  gear: ['Пара шестерён', 'Маленькая ведущая крутит большую ведомую — получаем больше силы и меньше оборотов (1-я). Почти равные шестерни — 4-я. Ведущая больше ведомой — повышающая 5-я.'],
  sleeve: ['Синхронизатор и муфта', 'Перед включением конусное кольцо синхронизатора трением выравнивает скорость шестерни и вала, потом муфта надвигается на зубчатый венец шестерни. Без синхронизатора передачи включались бы с хрустом.'],
  idler: ['Паразитная шестерня заднего хода', 'Третья шестерня между валами разворачивает направление вращения. Задняя передача часто без синхронизатора — включайте её только когда машина стоит.'],
  final: ['Главная пара и дифференциал', `Последнее понижение: шестерня вторичного вала крутит большое ведомое колесо (здесь ${FINAL_DRIVE}:1). Внутри — дифференциал, который позволяет колёсам крутиться с разной скоростью в повороте.`],
  shafts: ['Приводы (полуоси с ШРУСами)', 'Передают вращение от дифференциала к колёсам. ШРУСы — шарниры, которые позволяют колесу поворачиваться и ходить вверх-вниз. Порванный пыльник ШРУСа = скорый хруст при повороте.'],
};

export function Manual() {
  const info = useInfo();
  const [gear, setGear] = useState<G>('N');
  const [target, setTarget] = useState<G>('N');
  const [rpm, setRpm] = useState(2500);
  const [knob, setKnob] = useState<{ from: G; to: G }>({ from: 'N', to: 'N' });
  const st = useRef({ th: 0, out: 0, shift: 1, sleeves: { sR: 0, s12: 0, s34: 0, s5: 0 } as Record<string, number> });
  const [, force] = useState(0);
  useTicker((dt) => {
    const s = st.current;
    if (s.shift < 1) {
      s.shift = Math.min(1, s.shift + dt / 0.9);
      if (s.shift > 0.3 && gear !== target) setGear(target);
    }
    const phase = s.shift;
    const clutch = phase < 0.25 ? 1 - phase / 0.25 : phase > 0.75 ? (phase - 0.75) / 0.25 : 0;
    // муфты едут в нейтраль, потом к нужной шестерне
    for (const [id, sl] of Object.entries(SLEEVES)) {
      const want = phase < 0.45 ? 0 : sl.map[target] ?? 0;
      s.sleeves[id] += (want - s.sleeves[id]) * Math.min(1, dt * 12);
    }
    const w = (rpm / 60) * Math.PI * 2 * 0.06; // визуально замедлено
    s.th += w * dt * (0.25 + 0.75 * clutch);
    const ratio = gear === 'N' ? 0 : MT_RATIOS[gear] * (gear === 'R' ? -1 : 1);
    if (ratio && clutch > 0.98) s.out += (w / ratio) * dt;
    force((n) => (n + 1) % 1e6);
  });
  const s = st.current;
  const engaged = s.shift >= 1 && gear !== 'N';
  const clutch = s.shift < 0.25 ? 1 - s.shift / 0.25 : s.shift > 0.75 ? (s.shift - 0.75) / 0.25 : 0;
  const select = (g: G) => { if (g === target) return; setKnob({ from: target, to: g }); setTarget(g); st.current.shift = 0; };
  const pair = PAIRS.find((p) => p.g === gear);
  const pw = (on: boolean) => (on ? { filter: 'drop-shadow(0 0 6px #3de2ff)' } : undefined);
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Механическая коробка', color: '#5aa8ff' }) });
  const teeth = (x: number, y: number, r: number, travel: number, on: boolean, free?: boolean) => {
    const off = ((travel % 8) + 8) % 8;
    return (
      <g>
        <rect className="hl" x={x - 9} y={y - r} width={18} height={r * 2} rx={3} fill={on ? '#16405e' : free ? '#1a2740' : '#1e2c47'} stroke={on ? '#3de2ff' : '#5a6d90'} strokeWidth={on ? 2 : 1} style={pw(on)} />
        <clipPath id={`cp${x}${y}`}><rect x={x - 9} y={y - r} width={18} height={r * 2} /></clipPath>
        <g clipPath={`url(#cp${x}${y})`}>
          {Array.from({ length: Math.ceil((r * 2) / 8) + 1 }, (_, i) => (
            <line key={i} x1={x - 9} x2={x + 9} y1={y - r + i * 8 + off - 8} y2={y - r + i * 8 + off - 8} stroke={on ? '#3de2ff' : '#8fa3c6'} strokeOpacity={on ? 0.8 : 0.35} />
          ))}
        </g>
      </g>
    );
  };
  const thIn = s.th * 40;
  const wheelTravel = (s.out / FINAL_DRIVE) * 60;
  const speed = gear === 'N' ? 0 : speedAt(rpm, MT_RATIOS[gear]);
  const pathIdx = gear === 'N' || !engaged ? 2 : 7;

  return (
    <div className="stack">
      <div className="split">
        <Stage label={<>FIG. 07 — <b>Двухвальная МКПП</b> · вид сверху, схема</>} hint="нажмите на узел">
          <div className="wide-wrap"><svg viewBox="0 0 920 600" className="fig">
            {/* двигатель и сцепление */}
            <g style={pw(clutch > 0.5)}>
              <rect x={14} y={110} width={82} height={140} rx={10} fill="#2a1a14" stroke="#ff8a4c" strokeOpacity=".6" />
              <text x={55} y={186} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>мотор</text>
            </g>
            <g {...hit('clutch')}>
              <rect className="hl" x={102} y={96} width={12} height={168} rx={3} fill="#5a6d90" />
              <rect x={120 + (1 - clutch) * -2} y={112} width={7} height={136} rx={2} fill="#f0a531" />
              <rect x={131 + (1 - clutch) * 8} y={104} width={10} height={152} rx={3} fill="#8fa3c6" />
              <text x={122} y={86} textAnchor="middle" className="svg-label">сцепление</text>
            </g>
            {/* первичный вал */}
            <g {...hit('input')}>
              <line className="hl" x1={110} x2={830} y1={YI} y2={YI} stroke={clutch > 0.5 ? '#3de2ff' : '#8fa3c6'} strokeWidth={8} strokeLinecap="round" style={pw(clutch > 0.5)} />
              <line x1={110} x2={830} y1={YI} y2={YI} stroke="#0a1222" strokeWidth={3} strokeDasharray="6 10" strokeDashoffset={-thIn * 0.3} />
              <text x={838} y={YI + 4} className="svg-label">первичный вал</text>
            </g>
            {/* вторичный вал */}
            <g {...hit('output')}>
              <line className="hl" x1={190} x2={840} y1={YO} y2={YO} stroke={engaged ? '#3de2ff' : '#8fa3c6'} strokeWidth={8} strokeLinecap="round" style={pw(engaged)} />
              <line x1={190} x2={840} y1={YO} y2={YO} stroke="#0a1222" strokeWidth={3} strokeDasharray="6 10" strokeDashoffset={-s.out * 12} />
              <text x={848} y={YO + 4} className="svg-label">вторичный</text>
            </g>
            {/* пары шестерён */}
            {PAIRS.map((p) => {
              const on = engaged && p.g === gear;
              const travel = thIn * (p.r1 / 30);
              return (
                <g key={p.g} {...hit(p.g === 'R' ? 'idler' : 'gear')}>
                  {teeth(p.x, YI, p.r1, travel, on)}
                  {teeth(p.x, YO, p.r2, -travel, on, true)}
                  {p.g === 'R' && teeth(p.x, (YI + p.r1 + YO - p.r2) / 2, 12.5, travel, on)}
                  <text x={p.x} y={YI - p.r1 - 10} textAnchor="middle" className={on ? 'svg-label-c' : 'svg-label'} style={{ fontSize: 13, fontWeight: 700 }}>{p.g}</text>
                </g>
              );
            })}
            {/* синхронизаторы */}
            {Object.entries(SLEEVES).map(([id, sl]) => {
              const off = s.sleeves[id] * 22;
              const on = engaged && sl.map[gear] !== undefined;
              const syncing = s.shift > 0.45 && s.shift < 0.75 && sl.map[target] !== undefined;
              return (
                <g key={id} {...hit('sleeve')}>
                  <rect x={sl.x - 4} y={YO - 22} width={8} height={44} fill="#3a4a69" />
                  <rect className="hl" x={sl.x - 11 + off} y={YO - 32} width={22} height={64} rx={4} fill={on ? '#3de2ff' : syncing ? '#ffb547' : '#8fa3c6'} style={pw(on || syncing)} />
                  <line x1={sl.x + off} x2={sl.x + off} y1={YO - 46} y2={YO - 32} stroke="#6c7e9c" strokeWidth={3} />
                </g>
              );
            })}
            {/* главная пара, дифференциал, приводы */}
            <g {...hit('final')}>
              {teeth(215, YO, 30, -s.out * 30, engaged)}
              {teeth(215, 470, 110, s.out * 30, engaged)}
              <rect x={236} y={438} width={46} height={64} rx={10} fill="#13203a" stroke={engaged ? '#3de2ff' : '#5a6d90'} />
              <text x={259} y={524} textAnchor="middle" className="svg-label">дифф.</text>
            </g>
            <g {...hit('shafts')}>
              <line x1={58} x2={206} y1={470} y2={470} stroke={engaged ? '#3de2ff' : '#8fa3c6'} strokeWidth={7} style={pw(engaged)} />
              <line x1={282} x2={862} y1={470} y2={470} stroke={engaged ? '#3de2ff' : '#8fa3c6'} strokeWidth={7} style={pw(engaged)} />
              {[38, 882].map((x) => (
                <g key={x}>
                  <rect x={x - 20} y={420} width={40} height={100} rx={8} fill="#1b2230" stroke={engaged ? '#3de2ff' : '#3a4b6c'} />
                  <clipPath id={`wc${x}`}><rect x={x - 20} y={420} width={40} height={100} rx={8} /></clipPath>
                  <g clipPath={`url(#wc${x})`}>{Array.from({ length: 9 }, (_, i) => <line key={i} x1={x - 20} x2={x + 20} y1={412 + i * 14 + (((wheelTravel % 14) + 14) % 14)} y2={412 + i * 14 + (((wheelTravel % 14) + 14) % 14)} stroke="#5a6d90" strokeWidth={3} />)}</g>
                </g>
              ))}
              <text x={38} y={545} textAnchor="middle" className="svg-label">колесо</text>
              <text x={882} y={545} textAnchor="middle" className="svg-label">колесо</text>
            </g>
          </svg></div>
        </Stage>
        <div className="stack">
          <div className="panel" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14, alignItems: 'center' }}>
            <svg viewBox="0 0 180 220" style={{ width: '100%' }} role="group" aria-label="Рычаг КПП">
              <rect x={6} y={6} width={168} height={208} rx={22} fill="#060b16" stroke="#2c3b58" />
              <path d="M40,40 V180 M90,40 V180 M140,40 V180 M40,110 H140" stroke="#2c3b58" strokeWidth={14} strokeLinecap="round" />
              {(Object.keys(GATE) as G[]).map((g) => (
                <g key={g} className="hit" onClick={() => select(g)} role="button" aria-label={g === 'N' ? 'Нейтраль' : `Передача ${g}`}>
                  <circle cx={GATE[g][0]} cy={GATE[g][1]} r={22} fill="transparent" />
                  {g !== 'N' && <text x={GATE[g][0]} y={GATE[g][1] + (GATE[g][1] < 100 ? -16 : 26)} textAnchor="middle" className="mono" style={{ fontSize: 15, fontWeight: 700, fill: target === g ? '#3de2ff' : '#a7b6cf' }}>{g}</text>}
                </g>
              ))}
              <motion.circle key={`${knob.from}-${knob.to}`} r={16} fill="#e8eefa" stroke="#3de2ff" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 8px rgba(61,226,255,.6))', pointerEvents: 'none' }}
                initial={{ cx: GATE[knob.from][0], cy: GATE[knob.from][1] }}
                animate={{ cx: [GATE[knob.from][0], GATE[knob.from][0], GATE[knob.to][0], GATE[knob.to][0]], cy: [GATE[knob.from][1], 110, 110, GATE[knob.to][1]] }}
                transition={{ duration: 0.6, ease: 'easeInOut', times: [0, 0.35, 0.65, 1] }} />
            </svg>
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">Передача</span>
              <div className="big-num" style={{ color: 'var(--cyan)' }}>{target}</div>
              <div className="row" style={{ gap: 6 }}>
                {(['1', '2', '3', '4', '5', 'N', 'R'] as G[]).map((g) => <button key={g} className={`btn sm${target === g ? ' on' : ''}`} style={{ minWidth: 38, padding: 0 }} onClick={() => select(g)}>{g}</button>)}
              </div>
            </div>
          </div>
          <div className="panel">
            <Range id="mt-rpm" label="Обороты двигателя" value={rpm} min={1000} max={6000} step={100} onChange={setRpm} fmt={(v) => `${v} об/мин`} />
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Передаточное</dt><dd>{gear === 'N' ? '—' : `${MT_RATIOS[gear]} × ${FINAL_DRIVE} = ${(MT_RATIOS[gear] * FINAL_DRIVE).toFixed(1)}`}</dd>
              <dt>Скорость</dt><dd>{gear === 'N' ? '0' : Math.round(speed)} км/ч{gear === 'R' ? ' назад' : ''}</dd>
              <dt>Сила на колёсах</dt><dd>{gear === 'N' ? '0' : `× ${(MT_RATIOS[gear] * FINAL_DRIVE).toFixed(1)} от момента мотора`}</dd>
            </dl>
          </div>
          {s.shift < 1 ? (
            <Callout kind="warn">{s.shift < 0.25 ? 'Выжимаем сцепление — мотор отсоединён' : s.shift < 0.75 ? 'Синхронизатор выравнивает скорости, муфта едет к шестерне' : 'Плавно отпускаем сцепление'}</Callout>
          ) : gear === 'N' ? (
            <Callout kind="info">Нейтраль: первичный вал и все шестерни крутятся, но ведомые шестерни свободно вращаются на вторичном валу — к колёсам ничего не идёт.</Callout>
          ) : (
            <Callout kind="info">{pair && pair.r1 < pair.r2 ? 'Маленькая ведущая крутит большую ведомую: обороты падают, сила растёт.' : 'Ведущая больше ведомой: повышающая передача для экономичной трассы.'}{gear === 'R' ? ' Паразитная шестерня меняет направление.' : ''}</Callout>
          )}
        </div>
      </div>
      <div className="panel">
        <span className="eyebrow">Путь мощности</span>
        <Chain items={['Двигатель', 'Сцепление', 'Первичный вал', `Шестерня ${gear === 'N' ? '—' : gear}`, 'Муфта синхронизатора', 'Вторичный вал', 'Главная пара', 'Колёса']} active={pathIdx} />
      </div>
    </div>
  );
}
