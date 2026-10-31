import { useMemo, useRef, useState } from 'react';
import { useTicker } from '../../lib/anim';
import { Particles, Pipe, Pt } from '../../lib/path';
import { useInfo } from '../../lib/info';
import { Callout, HoldButton, Range, Seg, Stage } from '../../ui/kit';
import { Gauge } from './Turbo';

const PICK: Pt[] = [[262, 508], [150, 508], [150, 470]];
const TO_FILTER: Pt[] = [[150, 430], [150, 398], [96, 398], [96, 340]];
const TO_GALLERY: Pt[] = [[96, 256], [96, 232], [172, 232], [172, 346], [600, 346]];
const MAINS: Pt[][] = [220, 390, 560].map((x) => [[x, 346], [x, 380]]);
const RISER: Pt[] = [[600, 346], [636, 346], [636, 104], [200, 104]];
const JETS: Pt[][] = [290, 490].map((x) => [[x, 346], [x, 318], [x, 300]]);
const DRAINS: Pt[][] = [[[196, 150], [196, 440]], [[612, 150], [612, 440]]];

const INFO: Record<string, [string, string]> = {
  sump: ['Поддон', 'Резервуар масла внизу двигателя. Уровень проверяют щупом между MIN и MAX на заглушенном моторе, стоящем ровно.'],
  pick: ['Маслоприёмник с сеткой', 'Трубка, через которую насос забирает масло со дна поддона. Если масла мало, в повороте или при торможении оно отплёскивает, и насос хватает воздух.'],
  pump: ['Масляный насос', 'Шестерённый или роторный насос, крутится от коленвала. Создаёт давление 1–5 бар. Редукционный клапан сбрасывает лишнее давление.'],
  filter: ['Масляный фильтр', 'Задерживает продукты износа и нагар. Меняется при каждой замене масла. Внутри — перепускной клапан: если фильтр забит, масло пойдёт в обход, но уже грязным.'],
  gallery: ['Главная масляная магистраль', 'Канал вдоль блока, из которого масло расходится к коренным подшипникам коленвала, а оттуда — по сверлениям вала к шатунным.'],
  mains: ['Коренные и шатунные вкладыши', 'Подшипники скольжения: вал вращается на масляном клине толщиной в несколько микрон. Без давления масла вкладыши проворачиваются за секунды — «стук» и капремонт.'],
  head: ['Распредвалы и гидрокомпенсаторы', 'Масло поднимается в головку блока: смазывает опоры распредвалов, кулачки, гидрокомпенсаторы и муфты изменения фаз.'],
  jets: ['Форсунки охлаждения поршней', 'Брызгают масло на днище поршня снизу и охлаждают его. Есть у многих турбомоторов и дизелей.'],
  drains: ['Сливы', 'Отработав, масло стекает самотёком обратно в поддон. Поэтому уровень проверяют, подождав несколько минут после остановки.'],
};

// Типичные значения кинематической вязкости, сСт (40 °C / 100 °C)
const OILS = [
  { id: '0W-20', v40: 45, v100: 8.6, cold: -35, color: '#7fe3ff' },
  { id: '5W-30', v40: 68, v100: 11.6, cold: -30, color: '#3de2ff' },
  { id: '5W-40', v40: 86, v100: 14.0, cold: -30, color: '#ffb547' },
  { id: '10W-40', v40: 98, v100: 14.6, cold: -25, color: '#ff8a4c' },
];
/** Уравнение Вальтера по двум точкам */
function visc(o: (typeof OILS)[0], tC: number) {
  const W = (v: number) => Math.log10(Math.log10(v + 0.7));
  const l1 = Math.log10(313.15), l2 = Math.log10(373.15);
  const B = (W(o.v40) - W(o.v100)) / (l2 - l1), A = W(o.v40) + B * l1;
  return Math.pow(10, Math.pow(10, A - B * Math.log10(tC + 273.15))) - 0.7;
}

export function OilSystem() {
  const info = useInfo();
  const [on, setOn] = useState(true);
  const [rpm, setRpm] = useState(1500);
  const [level, setLevel] = useState(80);
  const [corner, setCorner] = useState(false);
  const st = useRef({ ph: 0, tilt: 0, p: 2, ang: 0 });
  const [, force] = useState(0);
  useTicker((dt) => {
    const s = st.current;
    s.tilt += ((corner ? 1 : 0) - s.tilt) * Math.min(1, dt * 5);
    const lvlY = 518 - (level / 100) * 70;
    const pickupY = 508 - 4;
    const surfAtPick = lvlY - s.tilt * 46; // уровень у маслоприёмника падает в повороте
    const starving = surfAtPick > pickupY - 6;
    const target = on ? (starving ? 0.1 : Math.min(4.6, 0.7 + (rpm / 1000) * 1.0)) : 0;
    s.p += (target - s.p) * Math.min(1, dt * 6);
    s.ph += dt * (on ? (rpm / 1000) * 0.25 : 0) * (starving ? 0.15 : 1);
    s.ang += dt * (on ? rpm / 8 : 0);
    force((n) => (n + 1) % 1e6);
  });
  const s = st.current;
  const lvlY = 518 - (level / 100) * 70;
  const lamp = on && s.p < 0.5;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Масляная система', color: '#f0a531' }) });
  const flowing = on && s.p > 0.3;
  const oil = '#f0a531';

  return (
    <div className="stack">
      <div className="split wide-aside">
        <Stage label={<>FIG. 05 — <b>Масляная система</b> · смазка под давлением</>} hint="нажмите на узел">
          <svg viewBox="40 60 640 480" className="fig">
            <rect x={180} y={70} width={440} height={100} rx={18} fill="#0d1628" stroke="#2c3b58" />
            <rect x={180} y={170} width={440} height={240} fill="#0b1426" stroke="#2c3b58" />
            {/* поршни */}
            {[290, 490].map((x, i) => {
              const y = 210 + Math.cos((s.ang * Math.PI) / 180 + i * Math.PI) * 18;
              return (
                <g key={x}>
                  <rect x={x - 52} y={176} width={104} height={160} fill="#050912" stroke="#1f2d48" />
                  <rect x={x - 50} y={y} width={100} height={56} rx={4} fill="#c7d4e8" />
                </g>
              );
            })}
            {/* распредвал */}
            <g {...hit('head')}>
              <rect className="hl" x={200} y={96} width={400} height={16} rx={8} fill="#2a3650" stroke="#5a6d90" />
              {[230, 330, 430, 530].map((x) => <rect key={x} x={x} y={120} width={22} height={34} rx={4} fill="#3a4a69" />)}
              {[260, 390, 520].map((x) => <circle key={x} cx={x} cy={104} r={14} fill="none" stroke={flowing ? oil : '#3a4b6c'} strokeWidth="3" />)}
              <text x={400} y={88} textAnchor="middle" className="svg-label">распредвал · гидрокомпенсаторы</text>
            </g>
            {/* коленвал */}
            <g {...hit('mains')}>
              <rect className="hl" x={200} y={372} width={400} height={16} rx={8} fill="#5a6d90" />
              {[220, 390, 560].map((x) => <circle key={x} cx={x} cy={380} r={16} fill="none" stroke={flowing ? oil : '#3a4b6c'} strokeWidth="4" />)}
              <text x={400} y={404} textAnchor="middle" className="svg-label">коленвал · вкладыши</text>
            </g>
            {/* поддон */}
            <g {...hit('sump')}>
              <path className="hl" d="M200,420 H600 L585,530 H215 Z" fill="#0c1424" stroke="#2c3b58" strokeWidth="2" />
              <path d={`M204,${lvlY + s.tilt * 46} L596,${lvlY - s.tilt * 46} L585,528 H215 Z`} fill={oil} opacity=".7" />
              <text x={590} y={448} textAnchor="end" className="svg-label">MAX</text>
              <text x={590} y={490} textAnchor="end" className="svg-label">MIN</text>
              <line x1={540} x2={598} y1={452} y2={452} stroke="#6c7e9c" strokeDasharray="3 3" />
              <line x1={540} x2={598} y1={494} y2={494} stroke="#6c7e9c" strokeDasharray="3 3" />
            </g>
            <g {...hit('pick')}>
              <Pipe pts={PICK} color={oil} w={10} on={flowing} />
              <rect className="hl" x={250} y={500} width={30} height={14} rx={3} fill="none" stroke="#8fa3c6" strokeDasharray="2 2" />
            </g>
            <g {...hit('pump')}>
              <circle className="hl" cx={150} cy={450} r={24} fill="#13203a" stroke="#5a6d90" strokeWidth="2" />
              <circle cx={142} cy={450} r={10} fill="none" stroke={oil} strokeWidth="3" strokeDasharray="4 3" transform={`rotate(${s.ang} 142 450)`} />
              <circle cx={160} cy={450} r={10} fill="none" stroke={oil} strokeWidth="3" strokeDasharray="4 3" transform={`rotate(${-s.ang} 160 450)`} />
              <text x={150} y={488} textAnchor="middle" className="svg-label">насос</text>
            </g>
            <g {...hit('filter')}>
              <Pipe pts={TO_FILTER} color={oil} w={10} on={flowing} />
              <rect className="hl" x={70} y={252} width={52} height={92} rx={10} fill="#1f2d48" stroke="#5a6d90" strokeWidth="2" />
              {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={78} x2={114} y1={268 + i * 14} y2={268 + i * 14} stroke="#3a4b6c" />)}
              <text x={96} y={366} textAnchor="middle" className="svg-label">фильтр</text>
            </g>
            <g {...hit('gallery')}>
              <Pipe pts={TO_GALLERY} color={oil} w={10} on={flowing} />
            </g>
            {MAINS.map((m, i) => <Pipe key={i} pts={m} color={oil} w={6} on={flowing} />)}
            <g {...hit('head')}><Pipe pts={RISER} color={oil} w={8} on={flowing} /></g>
            <g {...hit('jets')}>{JETS.map((j, i) => <Pipe key={i} pts={j} color={oil} w={6} on={flowing} />)}</g>
            <g {...hit('drains')}>{DRAINS.map((d, i) => <path key={i} d={`M${d[0][0]},${d[0][1]} V${d[1][1]}`} stroke="#f0a531" strokeOpacity=".3" strokeWidth="4" strokeDasharray="2 10" className="flow" style={{ ['--dur' as string]: '2.4s', ['--play' as string]: on ? 'running' : 'paused' }} />)}</g>
            {flowing && (
              <>
                <Particles pts={PICK} phase={s.ph * 2} n={5} color={oil} r={2.6} />
                <Particles pts={TO_FILTER} phase={s.ph * 1.6} n={7} color={oil} r={2.6} />
                <Particles pts={TO_GALLERY} phase={s.ph} n={18} color={oil} r={2.6} />
                {MAINS.map((m, i) => <Particles key={i} pts={m} phase={s.ph * 4 + i * 0.3} n={2} color={oil} r={2.4} />)}
                <Particles pts={RISER} phase={s.ph * 0.8} n={16} color={oil} r={2.6} />
                {JETS.map((j, i) => <Particles key={i} pts={j} phase={s.ph * 4 + i * 0.5} n={3} color={oil} r={2.4} />)}
                {JETS.map(([, , [x]], i) => (
                  <path key={'s' + i} d={`M${x},300 l-14,-34 M${x},300 l0,-38 M${x},300 l14,-34`} stroke={oil} strokeWidth="2" strokeDasharray="3 5" className="flow" style={{ ['--dur' as string]: '.6s' }} opacity=".8" />
                ))}
              </>
            )}
            {lamp && (
              <g className="blink">
                <rect x={520} y={200} width={80} height={44} rx={8} fill="#2a0c10" stroke="#ff4b5c" />
                <path d="M534,226 h24 l10,-8 h14 l-6,8 h-8 v8 h-34 Z" fill="#ff4b5c" />
                <text x={560} y={258} textAnchor="middle" className="svg-label" style={{ fill: '#ff4b5c' }}>ДАВЛЕНИЕ!</text>
              </g>
            )}
          </svg>
          <div className="stage-ctl">
            <Seg value={on ? 1 : 0} onChange={(v) => setOn(!!v)} options={[{ v: 0, l: 'Заглушен' }, { v: 1, l: 'Работает' }]} />
            <HoldButton className="btn" onHold={setCorner}>Резкий поворот (держать)</HoldButton>
          </div>
        </Stage>
        <div className="stack">
          <div className="panel">
            <div className="grid2">
              <Gauge label="Давление масла" digits={1} value={s.p} max={5} unit="бар" color={lamp ? '#ff4b5c' : '#f0a531'} />
              <Gauge label="Обороты" digits={0} value={on ? rpm : 0} max={6000} unit="об/мин" color="#3de2ff" />
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              <Range id="oil-rpm" label="Обороты" value={rpm} min={800} max={5000} step={100} onChange={setRpm} fmt={(v) => `${v}`} />
              <Range id="oil-lvl" label="Уровень в поддоне" value={level} min={5} max={100} onChange={setLevel} fmt={(v) => (v >= 85 ? 'MAX' : v >= 45 ? 'норма' : v >= 35 ? 'MIN' : 'ниже MIN')} />
            </div>
          </div>
          {lamp ? (
            <Callout kind="stop"><b>Красная лампа давления масла = немедленно заглушить двигатель.</b> Без давления вкладыши и турбина разрушаются за минуты. Проверьте уровень; если он в норме — машину на эвакуатор.</Callout>
          ) : level < 45 ? (
            <Callout kind="warn">Масла мало. На прямой давление ещё есть, но нажмите «Резкий поворот» — масло отплеснёт от маслоприёмника.</Callout>
          ) : (
            <Callout kind="info">Путь: поддон → маслоприёмник → насос → фильтр → магистраль → подшипники коленвала, распредвалы, поршни → обратно в поддон.</Callout>
          )}
        </div>
      </div>
      <Viscosity />
    </div>
  );
}

function Viscosity() {
  const [t, setT] = useState(-20);
  const [sel, setSel] = useState('5W-30');
  const W = 560, H = 230, pad = 44;
  const X = (tc: number) => pad + ((tc + 30) / 150) * (W - pad - 10);
  const Y = (v: number) => 12 + (1 - (Math.log10(v) - Math.log10(4)) / (Math.log10(20000) - Math.log10(4))) * (H - 40);
  const paths = useMemo(() => OILS.map((o) => {
    let d = '';
    for (let tc = -30; tc <= 120; tc += 2) d += (tc === -30 ? 'M' : 'L') + X(tc).toFixed(1) + ',' + Y(visc(o, tc)).toFixed(1);
    return d;
  }), []);
  const o = OILS.find((x) => x.id === sel)!;
  return (
    <div className="split wide-aside">
      <div className="panel">
        <span className="eyebrow">Вязкость: как масло густеет на холоде (типичные значения, уравнение Вальтера)</span>
        <div className="scroll-x">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 420, display: 'block' }}>
            {[10, 100, 1000, 10000].map((v) => (
              <g key={v}><line x1={pad} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="rgba(130,175,255,.12)" /><text x={pad - 6} y={Y(v) + 3} textAnchor="end" className="svg-label" style={{ fontSize: 9.5 }}>{v}</text></g>
            ))}
            {[-30, 0, 40, 100].map((v) => (
              <g key={v}><line x1={X(v)} x2={X(v)} y1={12} y2={H - 28} stroke="rgba(130,175,255,.12)" /><text x={X(v)} y={H - 12} textAnchor="middle" className="svg-label" style={{ fontSize: 9.5 }}>{v} °C</text></g>
            ))}
            <text x={pad} y={H - 1} className="svg-label" style={{ fontSize: 9 }}>сСт (лог. шкала)</text>
            {OILS.map((x, i) => <path key={x.id} d={paths[i]} fill="none" stroke={x.color} strokeWidth={x.id === sel ? 3 : 1.4} opacity={x.id === sel ? 1 : 0.45} />)}
            <line x1={X(t)} x2={X(t)} y1={12} y2={H - 28} stroke="#fff" strokeOpacity=".5" strokeDasharray="4 4" />
            {OILS.map((x) => <circle key={x.id} cx={X(t)} cy={Y(visc(x, t))} r={x.id === sel ? 5 : 3} fill={x.color} />)}
          </svg>
        </div>
        <Range id="visc-t" label="Температура масла" value={t} min={-30} max={120} onChange={setT} fmt={(v) => `${v} °C`} />
      </div>
      <div className="stack">
        <div className="panel">
          <Seg value={sel} onChange={setSel} options={OILS.map((x) => x.id)} mono label="Масло" />
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>При {t} °C</dt><dd>≈ {Math.round(visc(o, t)).toLocaleString('ru')} сСт</dd>
            <dt>«{o.id.split('W')[0]}W»</dt><dd>зимний класс: прокачка стартером до ≈ {o.cold} °C</dd>
            <dt>«{o.id.split('-')[1]}»</dt><dd>вязкость при 100 °C: {o.v100} сСт (класс {o.id.split('-')[1]})</dd>
          </dl>
        </div>
        <div className="panel">
          <h3>Почему нельзя лить случайное масло</h3>
          <ul>
            <li>Вязкость подобрана под зазоры: в моторе под 0W-20 густое масло хуже дойдёт до узких каналов и фазовращателей.</li>
            <li>У масла есть допуски производителя (например, VW 504 00, MB 229.51) и классы API/ACEA.</li>
            <li>Моторам с сажевым фильтром нужны малозольные масла (Low SAPS), иначе фильтр забивается.</li>
            <li>Турбомоторам с прямым впрыском важна защита от преждевременного воспламенения (LSPI).</li>
          </ul>
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>Правильное масло = вязкость + класс + допуск из руководства вашей машины.</p>
        </div>
      </div>
    </div>
  );
}
