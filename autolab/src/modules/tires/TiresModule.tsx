import { useState } from 'react';
import { motion } from 'framer-motion';
import { clamp } from '../../lib/anim';
import { Callout, ModHead, Range, Seg, Stage } from '../../ui/kit';

const LOAD: Record<number, number> = { 84: 500, 86: 530, 88: 560, 89: 580, 91: 615, 92: 630, 94: 670, 95: 690, 97: 730, 99: 775 };
const SPEED: Record<string, number> = { Q: 160, R: 170, S: 180, T: 190, H: 210, V: 240, W: 270, Y: 300 };

const TOKENS = [
  { id: 'w', t: '205', a: -21, title: 'Ширина профиля — 205 мм', text: 'Ширина шины от боковины до боковины в миллиметрах.' },
  { id: 'h', t: '/55', a: -10, title: 'Высота профиля — 55%', text: 'Высота боковины в процентах от ширины: 205 × 0,55 ≈ 113 мм. Чем меньше число, тем «низкопрофильнее» шина: точнее руль, но жёстче и уязвимее к ямам.' },
  { id: 'r', t: 'R', a: -2.5, title: 'R — радиальная конструкция', text: 'Это не «радиус»! R означает, что нити каркаса идут радиально, от борта к борту. Почти все современные легковые шины радиальные.' },
  { id: 'd', t: '16', a: 3.5, title: 'Посадочный диаметр — 16 дюймов', text: 'Диаметр колёсного диска, на который ставится шина: 16″ = 406 мм.' },
  { id: 'l', t: '91', a: 12.5, title: 'Индекс нагрузки — 91', text: 'Максимальная нагрузка на одну шину: 91 = 615 кг. Это код из таблицы, а не килограммы напрямую.' },
  { id: 's', t: 'V', a: 18.5, title: 'Индекс скорости — V', text: 'Максимальная допустимая скорость: V = 240 км/ч. H — 210, T — 190, Q — 160 (часто у зимних шипованных).' },
];

function Sidewall() {
  const [sel, setSel] = useState('r');
  const tok = TOKENS.find((t) => t.id === sel);
  const cx = 450, cy = 760;
  return (
    <div className="split">
      <Stage label={<>FIG. 60 — <b>Боковина шины</b> · нажмите на любую часть надписи</>}>
        <svg viewBox="80 40 740 340" className="fig">
          <defs>
            <radialGradient id="rubber" cx="50%" cy="100%" r="100%"><stop offset=".55" stopColor="#0a0d14" /><stop offset=".8" stopColor="#1a1f2b" /><stop offset="1" stopColor="#0b0e15" /></radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={680} fill="url(#rubber)" />
          <circle cx={cx} cy={cy} r={680} fill="none" stroke="#2a3346" strokeWidth={34} strokeDasharray="10 8" />
          <circle cx={cx} cy={cy} r={440} fill="#1c2638" stroke="#8fa3c6" strokeWidth={4} />
          <circle cx={cx} cy={cy} r={432} fill="none" stroke="#c7d4e8" strokeOpacity=".2" />
          {TOKENS.map((t) => {
            const on = t.id === sel;
            return (
              <g key={t.id} transform={`rotate(${t.a} ${cx} ${cy})`} className="hit" onClick={() => setSel(t.id)} role="button" aria-label={t.title}>
                <rect x={cx - 52} y={cy - 590} width={104} height={74} fill="transparent" />
                <text x={cx} y={cy - 532} textAnchor="middle" style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 46, fill: on ? '#3de2ff' : '#3a4458', stroke: on ? '#3de2ff' : '#59657c', strokeWidth: 1, filter: on ? 'drop-shadow(0 0 10px rgba(61,226,255,.7))' : 'drop-shadow(0 2px 0 #000)', transition: 'fill .25s' }}>{t.t}</text>
              </g>
            );
          })}
          <g transform={`rotate(-14 ${cx} ${cy})`} className="hit" onClick={() => setSel('dot')}>
            <text x={cx} y={cy - 470} textAnchor="middle" className="mono" style={{ fontSize: 20, fill: sel === 'dot' ? '#3de2ff' : '#59657c', fontWeight: 700 }}>DOT XX YY ZZZ 2324</text>
          </g>
          <g transform={`rotate(14 ${cx} ${cy})`} className="hit" onClick={() => setSel('tubeless')}>
            <text x={cx} y={cy - 470} textAnchor="middle" className="mono" style={{ fontSize: 18, fill: sel === 'tubeless' ? '#3de2ff' : '#59657c', fontWeight: 700 }}>TUBELESS · M+S</text>
          </g>
        </svg>
      </Stage>
      <motion.div key={sel} className="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="eyebrow">205/55 R16 91V</span>
        {tok ? <><h3 style={{ fontSize: 19 }}>{tok.title}</h3><p className="muted">{tok.text}</p></> : sel === 'dot' ? (
          <><h3 style={{ fontSize: 19 }}>Дата производства — 2324</h3><p className="muted">Последние 4 цифры кода DOT: 23-я неделя 2024 года. Резина стареет и без пробега — старые шины дубеют и трескаются, даже с хорошим протектором.</p></>
        ) : (
          <><h3 style={{ fontSize: 19 }}>TUBELESS, M+S</h3><p className="muted">Tubeless — бескамерная. M+S (Mud + Snow) — маркировка «грязь и снег», но это не гарантия зимних свойств. Настоящую зимнюю шину отмечает знак горы со снежинкой (3PMSF).</p></>
        )}
      </motion.div>
    </div>
  );
}

function Profile() {
  const [w, setW] = useState(205);
  const [h, setH] = useState(55);
  const [d, setD] = useState(16);
  const D = (ww: number, hh: number, dd: number) => dd * 25.4 + 2 * ww * (hh / 100);
  const base = D(205, 55, 16), cur = D(w, h, d);
  const diff = ((cur - base) / base) * 100;
  const S = 0.32;
  const side = w * (h / 100);
  return (
    <div className="split">
      <Stage label={<>FIG. 61 — <b>Профиль</b> · {w}/{h} R{d} против 205/55 R16</>}>
        <svg viewBox="0 0 640 360" className="fig">
          <g transform="translate(200 340)">
            <circle cx={0} cy={-base * S / 2} r={(base * S) / 2} fill="none" stroke="#6c7e9c" strokeDasharray="6 5" />
            <circle cx={0} cy={-cur * S / 2} r={(cur * S) / 2} fill="#141a26" stroke="#c7d4e8" strokeWidth={3} />
            <circle cx={0} cy={-cur * S / 2} r={((d * 25.4) * S) / 2} fill="#2a3346" stroke="#8fa3c6" strokeWidth={2} />
            <line x1={-200} x2={200} y1={0} y2={0} stroke="#3a4b6c" />
          </g>
          <g transform="translate(480 330)">
            <rect x={-(w * 0.6) / 2} y={-side * 0.9 - 40} width={w * 0.6} height={side * 0.9} rx={22} fill="#141a26" stroke="#c7d4e8" strokeWidth={2} />
            <rect x={-(w * 0.6) / 2 + 6} y={-40} width={w * 0.6 - 12} height={40} fill="#2a3346" stroke="#8fa3c6" />
            <text x={0} y={-side * 0.9 - 50} textAnchor="middle" className="mono" style={{ fontSize: 12, fill: '#a7b6cf' }}>{w} мм</text>
            <text x={(w * 0.6) / 2 + 8} y={-40 - side * 0.45} className="mono" style={{ fontSize: 12, fill: '#3de2ff' }}>{Math.round(side)} мм</text>
          </g>
        </svg>
      </Stage>
      <div className="stack">
        <div className="panel stack">
          <Range id="tw" label="Ширина" value={w} min={175} max={255} step={10} onChange={setW} fmt={(v) => `${v} мм`} />
          <Range id="th" label="Высота профиля" value={h} min={35} max={70} step={5} onChange={setH} fmt={(v) => `${v}%`} />
          <Range id="td" label="Диаметр диска" value={d} min={14} max={20} onChange={setD} fmt={(v) => `R${v}`} />
          <dl className="kv">
            <dt>Внешний диаметр</dt><dd>{Math.round(cur)} мм ({diff >= 0 ? '+' : ''}{diff.toFixed(1)}%)</dd>
            <dt>Спидометр при 100</dt><dd>реально {(100 * (1 + diff / 100)).toFixed(0)} км/ч</dd>
          </dl>
        </div>
        <Callout kind={Math.abs(diff) > 3 ? 'warn' : 'info'}>{Math.abs(diff) > 3 ? 'Разница больше ~3% — спидометр и ABS/ESP будут работать с ошибкой, шина может задевать арку. Допустимые размеры — в руководстве и на табличке.' : 'Допустимые размеры шин для вашей машины указаны в руководстве и на табличке на стойке двери.'}</Callout>
      </div>
    </div>
  );
}

function Pressure() {
  const [p, setP] = useState(2.3);
  const nom = 2.3;
  const k = (p - nom) / 1;
  const len = clamp(120 - k * 70, 50, 190);
  const wear = p < 1.9 ? 'Изнашиваются края (плечи), шина греется, растёт расход и риск разрыва боковины' : p > 2.7 ? 'Изнашивается центр, меньше пятно контакта — хуже торможение, жёстче ход' : 'Пятно контакта нормальное, износ равномерный';
  return (
    <div className="split">
      <Stage label={<>FIG. 62 — <b>Давление и пятно контакта</b></>}>
        <svg viewBox="0 0 640 300" className="fig">
          <g transform="translate(170 250)">
            <path d={`M-90,${-20} Q${-110 - clamp(-k * 30, -10, 30)},-110 -70,-200 H70 Q${110 + clamp(-k * 30, -10, 30)},-110 90,-20 Q60,${8 - k * 6} 0,${8 - k * 6} Q-60,${8 - k * 6} -90,-20 Z`} fill="#141a26" stroke="#c7d4e8" strokeWidth={3} />
            <rect x={-58} y={-226} width={116} height={30} rx={4} fill="#2a3346" stroke="#8fa3c6" />
            <line x1={-150} x2={150} y1={10} y2={10} stroke="#3a4b6c" strokeWidth={2} />
            <text x={0} y={-120} textAnchor="middle" className="mono" style={{ fontSize: 20, fill: p < 1.9 ? '#ff8a4c' : p > 2.7 ? '#ffb547' : '#36e0a0' }}>{p.toFixed(1)} бар</text>
          </g>
          <g transform="translate(470 150)">
            <text x={0} y={-120} textAnchor="middle" className="svg-label">пятно контакта (вид снизу)</text>
            <rect x={-60} y={-len / 2} width={120} height={len} rx={24} fill="#1b2230" stroke="#3de2ff" strokeOpacity=".5" />
            <rect x={-60} y={-len / 2} width={24} height={len} rx={12} fill="#ff6a3c" opacity={clamp(-k * 1.4)} />
            <rect x={36} y={-len / 2} width={24} height={len} rx={12} fill="#ff6a3c" opacity={clamp(-k * 1.4)} />
            <rect x={-22} y={-len / 2} width={44} height={len} rx={12} fill="#ffb547" opacity={clamp(k * 1.4)} />
            {Array.from({ length: 5 }, (_, i) => <line key={i} x1={-60} x2={60} y1={-len / 2 + ((i + 1) * len) / 6} y2={-len / 2 + ((i + 1) * len) / 6} stroke="#0a0d14" strokeWidth={3} />)}
          </g>
        </svg>
      </Stage>
      <div className="stack">
        <div className="panel"><Range id="tp" label="Давление" value={p} min={1.4} max={3.2} step={0.1} onChange={setP} fmt={(v) => `${v.toFixed(1)} бар`} /></div>
        <Callout kind={p < 1.9 || p > 2.7 ? 'warn' : 'info'}>{wear}</Callout>
        <p className="muted" style={{ fontSize: 13.5 }}>Правильное давление — на табличке на стойке водительской двери или лючке бака, а не цифра на боковине (там — максимум). Проверяют на холодных шинах, раз в месяц.</p>
      </div>
    </div>
  );
}

function Tread() {
  const [mm, setMm] = useState(5);
  const [v, setV] = useState(90);
  const [winter, setWinter] = useState(false);
  const risk = clamp(((v - 50) / 70) * (1.3 - mm / 8));
  const legal = winter ? 4 : 1.6;
  return (
    <div className="split">
      <Stage label={<>FIG. 63 — <b>Протектор и аквапланирование</b></>}>
        <svg viewBox="0 0 640 300" className="fig">
          <g transform="translate(40 60)">
            <rect x={0} y={0} width={260} height={30} fill="#141a26" />
            {Array.from({ length: 6 }, (_, i) => <rect key={i} x={6 + i * 43} y={30} width={30} height={mm * 9} fill="#2a3346" stroke="#5a6d90" />)}
            <line x1={0} x2={260} y1={30 + 1.6 * 9} y2={30 + 1.6 * 9} stroke="#ff4b5c" strokeDasharray="4 3" />
            <line x1={0} x2={260} y1={30 + 4 * 9} y2={30 + 4 * 9} stroke="#ffb547" strokeDasharray="4 3" />
            <text x={266} y={30 + 1.6 * 9 + 4} className="mono" style={{ fontSize: 10, fill: '#ff4b5c' }}>1,6</text>
            <text x={266} y={30 + 4 * 9 + 4} className="mono" style={{ fontSize: 10, fill: '#ffb547' }}>4 мм</text>
            <text x={0} y={-10} className="svg-label">протектор · {mm.toFixed(1)} мм</text>
          </g>
          <g transform="translate(360 150)">
            <rect x={-20} y={60} width={280} height={20} fill="#1f6fb0" opacity=".5" />
            <path d={`M0,60 Q${110},${60 - risk * 40} 220,${60 - risk * 50} L220,80 L0,80 Z`} fill="#3fb4ff" opacity=".6" />
            <circle cx={110} cy={60 - 70 - risk * 30} r={70} fill="#141a26" stroke="#c7d4e8" strokeWidth={3} />
            <text x={110} y={-90 - risk * 30} textAnchor="middle" className="mono" style={{ fontSize: 13, fill: risk > 0.6 ? '#ff4b5c' : '#a7b6cf' }}>{risk > 0.6 ? 'шина всплывает' : risk > 0.3 ? 'клин воды растёт' : 'вода уходит в канавки'}</text>
          </g>
        </svg>
      </Stage>
      <div className="stack">
        <div className="panel stack">
          <Seg value={winter ? 'w' : 's'} onChange={(x) => setWinter(x === 'w')} options={[{ v: 's', l: 'Летняя' }, { v: 'w', l: 'Зимняя' }]} />
          <Range id="mm" label="Глубина протектора" value={mm} min={0.5} max={8} step={0.5} onChange={setMm} fmt={(x) => `${x} мм`} />
          <Range id="aq" label="Скорость по лужам" value={v} min={40} max={130} step={5} onChange={setV} fmt={(x) => `${x} км/ч`} />
          <div className="meter"><div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span>Риск аквапланирования (качественно)</span><b>{risk > 0.6 ? 'высокий' : risk > 0.3 ? 'средний' : 'низкий'}</b></div><div className="bar"><i style={{ width: `${risk * 100}%`, background: risk > 0.6 ? 'var(--red)' : risk > 0.3 ? 'var(--amber)' : 'var(--green)' }} /></div></div>
        </div>
        <Callout kind={mm < legal ? 'stop' : 'info'}>{mm < legal ? `Меньше ${legal} мм — ${winter ? 'для зимних шин в РФ это предел' : 'это предел для легковых шин'}. Шину пора менять.` : `Минимум в РФ: ${winter ? '4 мм для зимних шин на снегу и льду' : '1,6 мм для летних шин легковых'}. Но тормозить на воде шина начинает заметно хуже уже около 3–4 мм.`}</Callout>
      </div>
    </div>
  );
}

function Indexes() {
  return (
    <div className="grid2">
      <div className="panel">
        <span className="eyebrow">Индекс нагрузки → кг на шину</span>
        <div className="idx">{Object.entries(LOAD).map(([k, v]) => <div key={k} className={k === '91' ? 'on' : ''}><b>{k}</b><span>{v}</span></div>)}</div>
      </div>
      <div className="panel">
        <span className="eyebrow">Индекс скорости → км/ч</span>
        <div className="idx">{Object.entries(SPEED).map(([k, v]) => <div key={k} className={k === 'V' ? 'on' : ''}><b>{k}</b><span>{v}</span></div>)}</div>
      </div>
      <div className="panel">
        <h3>Балансировка</h3>
        <p className="muted">Если масса колеса распределена неравномерно, на скорости появляется вибрация в руле (часто 80–120 км/ч). Шиномонтаж ставит грузики. Делают при каждой переобувке.</p>
      </div>
      <div className="panel">
        <h3>Развал-схождение</h3>
        <p className="muted">Углы установки колёс. Сбились после ямы или замены рулевых тяг — машину тянет в сторону, руль стоит криво, шины изнашиваются по краю «ёлочкой».</p>
      </div>
      <div className="panel">
        <h3>Летняя или зимняя</h3>
        <p className="muted">Летняя резина на холоде дубеет — часто ориентируются на среднесуточные +5…+7 °C. Зимняя мягче и с ламелями, но на жаре быстро изнашивается и хуже тормозит. Сроки обязательной зимней резины в регионе — в правилах.</p>
      </div>
    </div>
  );
}

export function TiresModule() {
  const [tab, setTab] = useState<'mark' | 'size' | 'press' | 'tread' | 'idx'>('mark');
  return (
    <>
      <ModHead title="Колёса и шины" lead="Четыре пятна размером с ладонь — всё, что держит машину на дороге." />
      <div className="tabs">
        {([['mark', 'Маркировка'], ['size', 'Размер'], ['press', 'Давление'], ['tread', 'Протектор'], ['idx', 'Индексы и уход']] as const).map(([id, l]) => (
          <button key={id} className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>
      {tab === 'mark' && <Sidewall />}
      {tab === 'size' && <Profile />}
      {tab === 'press' && <Pressure />}
      {tab === 'tread' && <Tread />}
      {tab === 'idx' && <Indexes />}
    </>
  );
}
