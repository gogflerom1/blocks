import { useRef, useState } from 'react';
import { useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { pd, Pt } from '../../lib/path';
import { Callout, Chain, HoldButton, ModHead, Seg, Stage } from '../../ui/kit';
import { Gauge } from '../engine/Turbo';

const W = {
  bat_starter: [[180, 300], [180, 270], [560, 270], [560, 330]] as Pt[],
  bat_fuse: [[140, 300], [140, 180], [300, 180], [300, 140]] as Pt[],
  key_relay: [[110, 120], [110, 40], [330, 40], [330, 60]] as Pt[],
  relay_starter: [[350, 140], [350, 230], [530, 230], [530, 330]] as Pt[],
  fuse_ecu: [[380, 100], [470, 100]] as Pt[],
  fuse_pump: [[380, 120], [440, 120], [440, 210], [470, 210]] as Pt[],
  fuse_lights: [[420, 70], [760, 70]] as Pt[],
  alt_bat: [[620, 200], [620, 160], [700, 160], [700, 250], [230, 250], [230, 300]] as Pt[],
  ground: [[100, 400], [100, 432], [820, 432]] as Pt[],
};
type WireId = keyof typeof W;

const INFO: Record<string, [string, string]> = {
  battery: ['Аккумулятор 12 В', 'Шесть банок по ~2,1 В. Даёт сотни ампер стартеру. Минус соединён с кузовом и двигателем — это «масса»: обратный путь тока для всех потребителей.'],
  key: ['Замок зажигания', 'OFF — всё выключено. ACC — магнитола и розетки. ON — включаются ЭБУ, насос, приборка. START — на пару секунд включается стартер, потом ключ сам возвращается в ON.'],
  fuse: ['Предохранители и реле', 'Предохранитель — тонкая перемычка, которая перегорает при перегрузке и защищает провода от пожара. Реле — выключатель, которым маленький ток от кнопки управляет большим током к потребителю.'],
  starter: ['Стартер', 'Электромотор на 1–2 кВт. Тяговое реле выдвигает шестерню (бендикс) в зацепление с венцом маховика и замыкает силовую цепь. Ток — 100–300 А.'],
  alt: ['Генератор', 'Крутится от ремня. Вырабатывает переменный ток, диодный мост выпрямляет его, регулятор держит ~14 В. Питает всё и заряжает АКБ, пока мотор работает.'],
  ecu: ['ЭБУ двигателя', 'Компьютер, управляющий впрыском и зажиганием. Просыпается в положении ON.'],
  pump: ['Топливный насос', 'В баке. При включении зажигания жужжит пару секунд — создаёт давление. Если не слышно — проверьте предохранитель насоса.'],
  lights: ['Фары', 'Каждая лампа ближнего — около 55 Вт, то есть почти 5 А. Цепь: выключатель → реле → предохранитель → лампы → масса.'],
  ground: ['Масса', 'Кузов и двигатель — общий «минус». Плохой контакт массы — классика странных электрических глюков и вялого стартера.'],
};

export function ElectricsModule() {
  const info = useInfo();
  const [key, setKey] = useState<0 | 1 | 2>(0);
  const [crank, setCrank] = useState(false);
  const [lights, setLights] = useState(false);
  const [blown, setBlown] = useState(false);
  const [weak, setWeak] = useState(false);
  const s = useRef({ running: false, crankT: 0, volt: 12.6, ph: 0, ang: 0, msg: '' });
  const [, force] = useState(0);
  useTicker((dt) => {
    const st = s.current;
    const cranking = crank && key === 2 && !st.running;
    if (cranking) {
      st.crankT += dt;
      if (!weak && st.crankT > 1.1) { st.running = true; st.msg = 'Завёлся'; }
      if (weak) st.msg = st.crankT > 0.2 ? 'Щёлк-щёлк… стартеру не хватает тока' : '';
    } else st.crankT = 0;
    const lightsOn = lights && !blown && key >= 1;
    let target = 12.6;
    if (key === 1) target = 12.5;
    if (key === 2) target = 12.3;
    if (lightsOn) target -= 0.25;
    if (cranking) target = weak ? 7.6 : 10.3;
    if (st.running) target = lightsOn ? 14.0 : 14.2;
    if (weak && !st.running) target -= 0.7;
    st.volt += (target - st.volt) * Math.min(1, dt * 6);
    st.ph += dt * (cranking ? 3 : 1.2);
    st.ang += dt * (st.running ? 720 : cranking && !weak ? 220 : 0);
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const cranking = crank && key === 2 && !st.running;
  const lightsOn = lights && !blown && key >= 1;
  const active: Partial<Record<WireId, 'out' | 'in' | 'big'>> = {};
  if (key >= 1) active.bat_fuse = 'out';
  if (key === 2) { active.fuse_ecu = 'out'; active.fuse_pump = 'out'; }
  if (cranking) { active.key_relay = 'out'; active.relay_starter = 'out'; if (!weak) active.bat_starter = 'big'; }
  if (lightsOn) active.fuse_lights = 'out';
  if (st.running) active.alt_bat = 'in';
  if (Object.keys(active).length) active.ground = 'out';
  const wire = (id: WireId, color = '#ffe45c') => {
    const a = active[id];
    const big = id === 'bat_starter';
    return (
      <g key={id}>
        <path d={pd(W[id])} fill="none" stroke={id === 'ground' ? '#3a4b6c' : big ? '#7a2630' : '#2c3b58'} strokeWidth={big ? 9 : id === 'ground' ? 6 : 4} strokeLinejoin="round" />
        {a && <path d={pd(W[id])} fill="none" stroke={a === 'in' ? '#36e0a0' : color} strokeWidth={a === 'big' ? 6 : 3} strokeDasharray="6 12" strokeDashoffset={-st.ph * (a === 'big' ? 60 : 30)} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${a === 'in' ? '#36e0a0' : color})` }} />}
      </g>
    );
  };
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Электрика', color: '#ffe45c' }) });
  const step = st.running ? 4 : cranking ? 1 : key === 2 ? 0 : -1;
  const note = cranking ? (weak ? 'Напряжение просело до ~7–8 В: тяговое реле щёлкает, стартер не крутит. Нужен заряд или «прикурить».' : 'Стартер тянет 100–300 А — напряжение проседает до ~10 В. Это нормально.')
    : st.running ? 'Генератор выдаёт ~14 В: питает всю машину и заряжает АКБ (зелёный ток идёт в аккумулятор).'
    : key === 2 ? 'Зажигание включено: проснулся ЭБУ, пару секунд жужжит бензонасос. Теперь — START.'
    : key === 1 ? 'ACC: работают только магнитола и розетки.' : 'Всё выключено. АКБ в покое: заряженный показывает ~12,6 В.';

  return (
    <>
      <ModHead title="Электрика" lead="12 вольт, масса, предохранители и реле. Поверните ключ и посмотрите, куда побежит ток." />
      <div className="split">
        <Stage label={<>FIG. 50 — <b>Цепь пуска и заряда</b></>} hint="нажмите на узел">
          <div className="wide-wrap"><svg viewBox="30 20 820 440" className="fig">
            {(Object.keys(W) as WireId[]).map((id) => wire(id))}
            <g {...hit('battery')}>
              <rect className="hl" x={70} y={300} width={170} height={100} rx={10} fill="#1d2129" stroke="#5a6d90" strokeWidth={2} />
              <rect x={170} y={290} width={22} height={14} rx={3} fill="#ff4b5c" /><rect x={128} y={290} width={22} height={14} rx={3} fill="#2a2f3a" stroke="#8fa3c6" />
              <text x={155} y={360} textAnchor="middle" className="mono" style={{ fontSize: 22, fill: weak ? '#ff8a99' : '#ffe45c', fontWeight: 700 }}>12V</text>
              {weak && <text x={155} y={385} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a99' }}>разряжен</text>}
            </g>
            <g {...hit('key')}>
              <circle className="hl" cx={110} cy={150} r={36} fill="#13203a" stroke="#5a6d90" strokeWidth={2} />
              <g transform={`rotate(${[-60, -20, 20, 60][cranking ? 3 : key]} 110 150)`}><rect x={104} y={118} width={12} height={40} rx={4} fill="#c7d4e8" /></g>
              {['OFF', 'ACC', 'ON', 'ST'].map((t, i) => {
                const a = ((-60 + i * 40 - 90) * Math.PI) / 180;
                return <text key={t} x={110 + 52 * Math.cos(a)} y={154 + 52 * Math.sin(a)} textAnchor="middle" className="mono" style={{ fontSize: 9, fill: (cranking ? 3 : key) === i ? '#3de2ff' : '#6c7e9c' }}>{t}</text>;
              })}
            </g>
            <g {...hit('fuse')}>
              <rect className="hl" x={290} y={56} width={130} height={90} rx={10} fill="#141922" stroke="#5a6d90" />
              <text x={355} y={52} textAnchor="middle" className="svg-label">предохранители / реле</text>
              <path d={`M318,72 h20 v12 h-20 Z`} fill="none" stroke={cranking ? '#ffe45c' : '#5a6d90'} />
              <path d={cranking ? 'M342,78 L352,78' : 'M342,78 L350,70'} stroke="#c7d4e8" strokeWidth={2} />
              {[0, 1, 2].map((i) => <rect key={i} x={372} y={66 + i * 22} width={30} height={12} rx={3} fill={i === 0 && blown ? '#3a1015' : '#ffb547'} opacity={i === 0 && blown ? 1 : 0.8} />)}
              {blown && <text x={404} y={64} className="mono" style={{ fontSize: 9, fill: '#ff4b5c' }}>сгорел</text>}
            </g>
            <g {...hit('ecu')}><rect className="hl" x={470} y={84} width={70} height={36} rx={6} fill="#262f40" stroke={key === 2 ? '#3de2ff' : '#5a6d90'} /><text x={505} y={107} textAnchor="middle" className="svg-label">ЭБУ</text></g>
            <g {...hit('pump')}><rect className="hl" x={470} y={194} width={70} height={34} rx={6} fill="#262f40" stroke={key === 2 ? '#ffb547' : '#5a6d90'} /><text x={505} y={216} textAnchor="middle" className="svg-label">бензонасос</text></g>
            <g {...hit('lights')}>
              <path className="hl" d="M760,46 q60,24 0,48 Z" fill={lightsOn ? '#fff7d6' : '#1b2230'} stroke="#c7d4e8" style={lightsOn ? { filter: 'drop-shadow(0 0 16px #ffe9a8)' } : undefined} />
              {lightsOn && [0, 1, 2].map((i) => <line key={i} x1={800} x2={840} y1={58 + i * 12} y2={52 + i * 16} stroke="#ffe9a8" strokeWidth={2} />)}
              <text x={780} y={116} className="svg-label">фары</text>
            </g>
            <g {...hit('starter')}>
              <rect className="hl" x={510} y={330} width={90} height={56} rx={12} fill="#2a2416" stroke={cranking ? '#ffe45c' : '#5a6d90'} strokeWidth={2} />
              <text x={555} y={404} textAnchor="middle" className="svg-label">стартер</text>
              <circle cx={612 + (cranking ? 8 : 0)} cy={358} r={9} fill="#c7d4e8" />
            </g>
            <g transform={`rotate(${st.ang} 700 358)`}>
              <circle cx={700} cy={358} r={56} fill="#1b2433" stroke="#8fa3c6" strokeWidth={3} strokeDasharray="4 3" />
              <line x1={700} x2={700} y1={310} y2={406} stroke="#5a6d90" strokeWidth={4} />
            </g>
            <text x={700} y={432 - 6} textAnchor="middle" className="svg-label">маховик · {st.running ? 'двигатель работает' : 'стоит'}</text>
            <g {...hit('alt')}>
              <circle className="hl" cx={620} cy={220} r={26} fill="#2a2416" stroke={st.running ? '#36e0a0' : '#5a6d90'} strokeWidth={2} />
              <g transform={`rotate(${st.ang * 2.5} 620 220)`}>{[0, 60, 120].map((a) => <line key={a} x1={600} x2={640} y1={220} y2={220} stroke="#8fa3c6" strokeWidth={2} transform={`rotate(${a} 620 220)`} />)}</g>
              <text x={590} y={190} textAnchor="end" className="svg-label">генератор</text>
              <path d="M640,236 L690,310" stroke="#0a0f18" strokeWidth={6} />
            </g>
            <g {...hit('ground')}><text x={820} y={452} textAnchor="end" className="svg-label">масса — кузов</text>{[0, 1, 2].map((i) => <line key={i} x1={88 + i * 4} x2={112 - i * 4} y1={440 + i * 5} y2={440 + i * 5} stroke="#6c7e9c" strokeWidth={2} />)}</g>
          </svg></div>
          <div className="stage-ctl">
            <Seg value={key} onChange={(v) => { setKey(v); if (v === 0) s.current.running = false; }} options={[{ v: 0, l: 'OFF' }, { v: 1, l: 'ACC' }, { v: 2, l: 'ON' }]} mono />
            <HoldButton className="btn primary" onHold={(on) => { if (on && key !== 2) setKey(2); setCrank(on); }}>START (держать)</HoldButton>
          </div>
        </Stage>
        <div className="stack">
          <div className="panel">
            <Gauge label="Вольтметр" digits={1} value={st.volt} max={16} unit="В" color={st.volt < 11 ? '#ff4b5c' : st.volt > 13.5 ? '#36e0a0' : '#ffe45c'} note={st.running ? 'заряд' : 'от АКБ'} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className={`btn sm${lights ? ' on' : ''}`} onClick={() => setLights(!lights)}>Фары</button>
              <button className="btn sm danger" onClick={() => setBlown(true)} disabled={blown}>Замыкание в фаре</button>
              {blown && <button className="btn sm" onClick={() => setBlown(false)}>Заменить предохранитель</button>}
              <button className={`btn sm${weak ? ' on' : ''}`} onClick={() => { setWeak(!weak); s.current.running = false; }}>Слабый АКБ</button>
            </div>
          </div>
          <Callout kind={cranking && weak ? 'warn' : 'info'}>{note}</Callout>
          {blown && <Callout kind="warn">Предохранитель фар перегорел и разорвал цепь — проводка цела. Новый ставят строго того же номинала. Сгорает снова — ищите замыкание.</Callout>}
          <Chain items={['АКБ', 'Стартер', 'Двигатель запустился', 'Генератор', 'Заряд АКБ']} active={step} />
        </div>
      </div>
    </>
  );
}
