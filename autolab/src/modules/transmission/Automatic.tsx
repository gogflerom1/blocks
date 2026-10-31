import { useRef, useState } from 'react';
import { gearPath, useTicker } from '../../lib/anim';
import { Particles, Pt } from '../../lib/path';
import { useInfo } from '../../lib/info';
import { AT_APPLY, AT_ELEMENTS } from '../../content/transmission';
import { Callout, Range, Seg, Stage } from '../../ui/kit';

/* ── Гидротрансформатор ───────────────────────────── */
const TC_MODES = [
  { v: 'stall', l: 'Стоим на D', sr: 0, text: 'Двигатель крутит насосное колесо, турбина стоит вместе с колёсами (держим тормоз). Масло бьёт в лопатки турбины, реактор разворачивает поток — момент увеличивается примерно вдвое. Поэтому машина с автоматом «ползёт» без газа.' },
  { v: 'accel', l: 'Разгон', sr: 0.5, text: 'Турбина догоняет насос. Реактор ещё упирается в обгонную муфту и продолжает усиливать момент — отсюда мягкий, но уверенный разгон с места.' },
  { v: 'couple', l: 'Крейсер', sr: 0.88, text: 'Точка сцепления: скорости почти равны, поток бьёт в реактор с обратной стороны, и он свободно вращается. Гидротрансформатор работает как гидромуфта — без усиления, с небольшим проскальзыванием.' },
  { v: 'lock', l: 'Блокировка', sr: 1, text: 'Муфта блокировки жёстко соединяет корпус с турбиной. Проскальзывания нет, масло не греется, расход ниже. Это включается на ровном ходу.' },
] as const;
type TcMode = (typeof TC_MODES)[number]['v'];

const LOOP: Pt[] = [[338, 236], [346, 120], [318, 92], [262, 86], [204, 92], [176, 120], [184, 236], [214, 262], [262, 266], [308, 262], [338, 236]];

const TC_INFO: Record<string, [string, string]> = {
  pump: ['Насосное колесо', 'Приварено к корпусу гидротрансформатора, который прикручен к двигателю. Крутится всегда вместе с мотором и разгоняет масло к краю.'],
  turbine: ['Турбинное колесо', 'Соединено с валом коробки. Его вращает поток масла от насоса — механической связи с двигателем нет (пока не включена блокировка).'],
  stator: ['Реактор (статор)', 'Стоит между колёсами на обгонной муфте. На малых скоростях разворачивает поток масла обратно в насос под удачным углом — это и даёт усиление момента.'],
  lock: ['Муфта блокировки', 'Фрикционный диск, который прижимается к корпусу и соединяет мотор с коробкой напрямую. Убирает потери на проскальзывание.'],
};

function TorqueConverter() {
  const info = useInfo();
  const [mode, setMode] = useState<TcMode>('stall');
  const m = TC_MODES.find((x) => x.v === mode)!;
  const st = useRef({ ph: 0, a1: 0, a2: 0, a3: 0 });
  const [, force] = useState(0);
  const sr = m.sr, rpmP = mode === 'stall' ? 2200 : mode === 'accel' ? 2600 : 2000, rpmT = rpmP * sr;
  const tr = sr >= 0.85 ? 1 : 2.0 - (sr / 0.85) * 1.0;
  useTicker((dt) => {
    const s = st.current;
    s.ph += dt * (mode === 'lock' ? 0 : 0.2 + (1 - sr) * 0.9);
    s.a1 += dt * rpmP * 0.06;
    s.a2 += dt * rpmT * 0.06;
    s.a3 += dt * (sr >= 0.85 && mode !== 'lock' ? rpmT * 0.05 : mode === 'lock' ? rpmT * 0.06 : 0);
    force((n) => (n + 1) % 1e6);
  });
  const s = st.current;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: TC_INFO[id][0], text: TC_INFO[id][1], kicker: 'Гидротрансформатор', color: '#5aa8ff' }) });
  const blades = (x0: number, x1: number, phase: number) => Array.from({ length: 7 }, (_, i) => {
    const y = 104 + i * 22 + ((phase % 22) + 22) % 22 * 0;
    return <line key={i} x1={x0} x2={x1} y1={y} y2={y + 10} stroke="#8fa3c6" strokeOpacity=".5" strokeWidth={2} />;
  });
  return (
    <div className="split">
      <Stage label={<>FIG. 09 — <b>Гидротрансформатор</b> · верхняя половина в разрезе</>} hint="нажмите на колесо">
        <svg viewBox="40 20 480 330" className="fig">
          <path d="M70,300 V70 Q70,36 104,36 H420 Q460,36 466,80 L470,300" fill="none" stroke="#3a4b6c" strokeWidth={4} />
          <line x1={50} x2={500} y1={312} y2={312} stroke="#6c7e9c" strokeDasharray="10 4 2 4" />
          <text x={498} y={330} textAnchor="end" className="svg-label">ось вращения</text>
          <g {...hit('lock')}>
            <rect className="hl" x={mode === 'lock' ? 78 : 92} y={70} width={10} height={180} rx={3} fill={mode === 'lock' ? '#3de2ff' : '#5a6d90'} style={mode === 'lock' ? { filter: 'drop-shadow(0 0 8px #3de2ff)' } : undefined} />
            <text x={84} y={62} textAnchor="middle" className="svg-label">блокировка</text>
          </g>
          <g {...hit('turbine')}>
            <path className="hl" d="M262,80 H214 Q160,86 160,140 V232 Q166,262 214,268 H252 L252,240 Q200,236 196,206 V130 Q198,104 236,100 H262 Z" fill="#1e3550" stroke="#5aa8ff" strokeWidth={1.5} />
            {blades(170, 190, s.a2)}
            <text x={150} y={300} textAnchor="middle" className="svg-label" style={{ fill: "#5aa8ff" }}>турбина → коробка</text>
          </g>
          <g {...hit('pump')}>
            <path className="hl" d="M262,80 H310 Q364,86 364,140 V232 Q358,262 310,268 H272 L272,240 Q324,236 328,206 V130 Q326,104 288,100 H262 Z" fill="#3a2418" stroke="#ff8a4c" strokeWidth={1.5} />
            {blades(334, 354, s.a1)}
            <text x={384} y={300} textAnchor="middle" className="svg-label" style={{ fill: "#ff8a4c" }}>насос ← мотор</text>
          </g>
          <g {...hit('stator')}>
            <rect className="hl" x={236} y={248} width={52} height={30} rx={6} fill="#2a3650" stroke={sr >= 0.85 ? '#36e0a0' : '#ff4b5c'} strokeWidth={2} />
            <text x={262} y={268} textAnchor="middle" className="mono" style={{ fontSize: 10, fill: sr >= 0.85 ? '#36e0a0' : '#ff8a99' }}>{sr >= 0.85 ? 'свободно' : 'упор'}</text>
            <text x={262} y={296} textAnchor="middle" className="svg-label">реактор</text>
          </g>
          <Particles pts={LOOP} phase={s.ph} n={22} color="#f0a531" r={3.2} opacity={mode === 'lock' ? 0.25 : 1} />
          {/* вид спереди: насос и турбина */}
          {[{ x: 440, a: s.a1, c: '#ff8a4c', l: 'насос' }, { x: 440, a: s.a2, c: '#5aa8ff', l: 'турбина', y: 220 }].map((w) => (
            <g key={w.l} transform={`translate(${w.x} ${w.y ?? 128})`}>
              <circle r={30} fill="#0a1222" stroke={w.c} strokeWidth={2} />
              {Array.from({ length: 8 }, (_, i) => <line key={i} x1={0} y1={0} x2={26} y2={0} stroke={w.c} strokeWidth={2} transform={`rotate(${w.a + i * 45})`} />)}
              <text y={48} textAnchor="middle" className="svg-label" style={{ fill: w.c }}>{w.l}</text>
            </g>
          ))}
        </svg>
        <div className="stage-ctl"><Seg value={mode} onChange={setMode} options={TC_MODES.map((x) => ({ v: x.v, l: x.l }))} /></div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <dl className="kv">
            <dt>Насос (мотор)</dt><dd>{rpmP} об/мин</dd>
            <dt>Турбина (коробка)</dt><dd>{Math.round(rpmT)} об/мин</dd>
            <dt>Проскальзывание</dt><dd>{Math.round((1 - sr) * 100)}%</dd>
            <dt>Усиление момента</dt><dd style={{ color: tr > 1.05 ? 'var(--amber)' : undefined }}>× {tr.toFixed(2)}</dd>
          </dl>
        </div>
        <Callout kind="info">{m.text}</Callout>
      </div>
    </div>
  );
}

/* ── Планетарный ряд ───────────────────────────── */
const S = 24, P = 18, Rg = 60, MOD = 4.2;
const PLAN = [
  { v: 'low', l: 'Понижающая', inp: 's', held: 'r', out: 'c', ratio: 1 + Rg / S, text: 'Коронная шестерня заторможена, крутим солнце — водило с сателлитами обкатывается медленно. Большое понижение, как 1-я передача.' },
  { v: 'mid', l: 'Средняя', inp: 'r', held: 's', out: 'c', ratio: 1 + S / Rg, text: 'Солнце заторможено, крутим коронную шестерню — водило вращается чуть медленнее. Небольшое понижение.' },
  { v: 'direct', l: 'Прямая 1:1', inp: 'sc', held: '', out: 'r', ratio: 1, text: 'Два элемента сцеплены фрикционом — весь ряд крутится как одно целое. Передаточное число 1:1.' },
  { v: 'od', l: 'Повышающая', inp: 'c', held: 's', out: 'r', ratio: Rg / (S + Rg), text: 'Солнце заторможено, крутим водило — коронная шестерня обгоняет вход. Повышающая (overdrive) передача для трассы.' },
  { v: 'rev', l: 'Задний ход', inp: 's', held: 'c', out: 'r', ratio: -Rg / S, text: 'Водило заторможено, сателлиты работают как паразитные шестерни — коронная крутится в обратную сторону.' },
  { v: 'n', l: 'Нейтраль', inp: 's', held: '', out: 'c', ratio: 0, text: 'Ничего не заторможено. Солнце крутится, водило (выход) стоит, коронная свободно вращается назад. Момент никуда не передаётся.' },
] as const;
type PlanMode = (typeof PLAN)[number]['v'];

function Planetary({ force }: { force?: PlanMode }) {
  const [modeState, setMode] = useState<PlanMode>('low');
  const mode = force ?? modeState;
  const m = PLAN.find((x) => x.v === mode)!;
  const ang = useRef({ s: 0, c: 0, r: 0 });
  const [, tick] = useState(0);
  useTicker((dt) => {
    const a = ang.current, w = 0.7 * dt;
    if (mode === 'low') { a.s += w; a.c = (a.s * S) / (S + Rg); a.r = 0; }
    else if (mode === 'mid') { a.r += w; a.c = (a.r * Rg) / (S + Rg); a.s = 0; }
    else if (mode === 'direct') { a.s += w; a.c = a.s; a.r = a.s; }
    else if (mode === 'od') { a.c += w; a.r = (a.c * (S + Rg)) / Rg; a.s = 0; }
    else { a.s += w; a.c = 0; a.r = (-a.s * S) / Rg; }
    tick((n) => (n + 1) % 1e6);
  });
  const a = ang.current;
  const cx = 160, cy = 160, rs = (MOD * S) / 2, rp = (MOD * P) / 2, rr = (MOD * Rg) / 2, h = 5.5, d = rs + rp;
  const col = (k: 's' | 'c' | 'r') => (m.inp.includes(k) ? '#3de2ff' : m.held === k ? '#ff4b5c' : m.out === k ? '#36e0a0' : '#6c7e9c');
  const sig0 = 0;
  const phis = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((p) => p - Math.PI / 2);
  const psi0 = phis.map((ph) => ph + Math.PI + Math.PI / P - (sig0 - ph) * (S / P));
  const rho0 = phis[0] + Math.PI / Rg + (psi0[0] - phis[0]) * (P / Rg);
  return (
    <div className="split">
      <Stage label={<>FIG. 10 — <b>Планетарный ряд</b> · {m.l.toLowerCase()}</>}>
        <svg viewBox="0 0 320 320" className="fig" style={{ maxHeight: 440 }}>
          <path d={gearPath(cx, cy, rr + h / 2, Rg, h, rho0 + a.r, true)} fill="none" stroke={col('r')} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={rr + 16} fill="none" stroke={col('r')} strokeWidth={10} strokeOpacity={0.35} />
          {/* водило */}
          <g transform={`rotate(${(a.c * 180) / Math.PI} ${cx} ${cy})`}>
            {phis.map((ph, k) => <line key={k} x1={cx} y1={cy} x2={cx + d * Math.cos(ph)} y2={cy + d * Math.sin(ph)} stroke={col('c')} strokeWidth={10} strokeLinecap="round" strokeOpacity={0.55} />)}
          </g>
          {phis.map((ph, k) => {
            const pc = [cx + d * Math.cos(ph + a.c), cy + d * Math.sin(ph + a.c)];
            const spin = psi0[k] + a.c + (a.r - a.c) * (Rg / P);
            return (
              <g key={k}>
                <path d={gearPath(pc[0], pc[1], rp - h / 2, P, h, spin)} fill="#13203a" stroke="#c7d4e8" strokeWidth={1.4} />
                <circle cx={pc[0]} cy={pc[1]} r={7} fill={col('c')} />
              </g>
            );
          })}
          <path d={gearPath(cx, cy, rs - h / 2, S, h, sig0 + a.s)} fill="#13203a" stroke={col('s')} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={10} fill={col('s')} />
        </svg>
        <div className="stage-ctl" style={{ justifyContent: 'center' }}>
          <div className="legend" style={{ background: 'rgba(6,11,22,.75)', padding: '6px 10px', borderRadius: 10 }}>
            <span><i style={{ background: '#3de2ff' }} />вход</span><span><i style={{ background: '#ff4b5c' }} />заторможено</span><span><i style={{ background: '#36e0a0' }} />выход</span>
          </div>
        </div>
      </Stage>
      <div className="stack">
        {!force && (
          <div className="panel">
            <span className="eyebrow">Что держим, что крутим</span>
            <div className="row">{PLAN.map((x) => <button key={x.v} className={`btn sm${mode === x.v ? ' on' : ''}`} onClick={() => setMode(x.v)}>{x.l}</button>)}</div>
          </div>
        )}
        <div className="panel">
          <dl className="kv">
            <dt>Солнце</dt><dd style={{ color: col('s') }}>{S} зубьев</dd>
            <dt>Сателлиты</dt><dd>3 × {P} зубьев, на водиле</dd>
            <dt>Коронная</dt><dd style={{ color: col('r') }}>{Rg} зубьев</dd>
            <dt>Передаточное</dt><dd>{m.ratio === 0 ? '—' : m.ratio.toFixed(2).replace('.', ',')}{m.ratio < 0 ? ' (назад)' : ''}</dd>
          </dl>
          <p className="muted" style={{ marginTop: 10 }}>{m.text}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Селектор P R N D ───────────────────────────── */
const SEL = ['P', 'R', 'N', 'D'] as const;
const SEL_TEXT: Record<(typeof SEL)[number], string> = {
  P: 'Паркинг: стопорная собачка заходит в зубья шестерни на выходном валу и механически блокирует колёса. На уклоне сначала ручник, потом P — иначе вся масса машины висит на собачке.',
  R: 'Задний ход: гидроблок включает фрикцион и тормоз так, что планетарный ряд разворачивает вращение.',
  N: 'Нейтраль: все фрикционы разомкнуты, выход свободен, собачка не стоит. Колёса катятся, двигатель отсоединён.',
  D: 'Драйв: блок управления сам выбирает передачу по скорости, нагрузке и положению педали. Гидроблок по команде соленоидов подаёт давление масла на нужные фрикционы и тормоза.',
};
const gearForSpeed = (v: number) => (v < 18 ? '1' : v < 35 ? '2' : v < 55 ? '3' : v < 80 ? '4' : v < 110 ? '5' : '6');

function Selector() {
  const [sel, setSel] = useState<(typeof SEL)[number]>('P');
  const [speed, setSpeed] = useState(40);
  const g = sel === 'D' ? gearForSpeed(speed) : sel;
  const applied = AT_APPLY[g] ?? [];
  return (
    <div className="split">
      <div className="panel">
        <div className="prnd-wrap">
          <div className="prnd" role="group" aria-label="Селектор АКПП">
            {SEL.map((x) => <button key={x} aria-pressed={sel === x} onClick={() => setSel(x)}>{x}</button>)}
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <span className="eyebrow">Гидроблок · пример 6-ступенчатого автомата (схема Лепелетье, ZF 6HP и аналоги)</span>
            <div className="apply">
              {AT_ELEMENTS.map((e) => {
                const on = applied.includes(e.id);
                return (
                  <div key={e.id} className={`el${on ? ' on' : ''}`}>
                    <b>{e.id}</b><span>{e.kind}</span>
                    <svg viewBox="0 0 60 26"><rect x={4} y={4} width={52} height={18} rx={4} fill="none" stroke="currentColor" strokeOpacity=".4" />{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={8 + i * 10 + (on ? 0 : i % 2 ? 2 : -2)} y={7} width={4} height={12} fill="currentColor" opacity={on ? 1 : 0.4} />)}</svg>
                  </div>
                );
              })}
            </div>
            {sel === 'D' && <Range id="at-speed" label={`Скорость → передача ${g}`} value={speed} min={0} max={180} onChange={setSpeed} fmt={(v) => `${v} км/ч`} />}
            {sel === 'P' && (
              <svg viewBox="0 0 300 110" style={{ width: '100%', maxWidth: 360 }}>
                <path d={gearPath(70, 60, 38, 14, 8, 0)} fill="#13203a" stroke="#8fa3c6" />
                <circle cx={70} cy={60} r={9} fill="#3a4a69" />
                <path d="M250,30 L140,20 L104,30 L140,36 Z" fill="#ff8a4c" />
                <circle cx={250} cy={30} r={7} fill="#5a6d90" />
                <text x={120} y={100} className="svg-label" style={{ fill: "#ff8a4c" }}>собачка в зацеплении</text>
              </svg>
            )}
          </div>
        </div>
      </div>
      <div className="stack">
        <Callout kind={sel === 'P' ? 'warn' : 'info'}>{SEL_TEXT[sel]}</Callout>
        <div className="panel">
          <span className="eyebrow">Что включено</span>
          <p className="muted">{applied.length ? `Работают ${applied.join(' и ')} — ровно два элемента на каждую передачу. Переключение = один элемент отпускается, другой одновременно включается.` : sel === 'P' ? 'Фрикционы разомкнуты, колёса держит собачка.' : 'Все фрикционы и тормоза разомкнуты.'}</p>
        </div>
      </div>
    </div>
  );
}

export function Automatic() {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <TorqueConverter />
      <Planetary />
      <Selector />
      <p className="footer-note">Реальные автоматы используют 2–4 связанных планетарных ряда. Схема включения элементов показана для конкретной конструкции; у других коробок она своя.</p>
    </div>
  );
}

export { Planetary };
