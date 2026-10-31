import { useRef, useState } from 'react';
import { clamp, mix, useTicker } from '../../lib/anim';
import { Particles, Pipe, Pt } from '../../lib/path';
import { useInfo } from '../../lib/info';
import { Callout, Seg, Stage } from '../../ui/kit';

const JACKET: Pt[] = [[140, 392], [356, 392], [356, 344], [144, 344], [144, 296], [356, 296], [356, 248], [144, 248], [144, 206], [384, 206]];
const UPPER: Pt[] = [[420, 196], [520, 196], [520, 150], [640, 150]];
const CORE: Pt[] = [[700, 160], [700, 430]];
const LOWER: Pt[] = [[700, 444], [700, 476], [86, 476], [86, 414]];
const PUMP_OUT: Pt[] = [[100, 396], [140, 392]];
const HEATER: Pt[] = [[384, 206], [384, 92], [270, 92], [150, 92], [60, 92], [60, 396], [74, 400]];
const TANK: Pt[] = [[540, 112], [600, 112], [620, 150]];

const INFO: Record<string, [string, string]> = {
  pump: ['Помпа (водяной насос)', 'Гонит антифриз по кругу. Обычно крутится от ремня (иногда от ремня ГРМ — тогда её меняют вместе с ним). Бывают электрические помпы.'],
  thermo: ['Термостат', 'Клапан с восковым наполнителем. На холодном моторе закрыт — антифриз ходит по малому кругу, и двигатель быстрее прогревается. Примерно при 85–95 °C (зависит от машины) воск плавится, клапан открывает путь в радиатор.'],
  rad: ['Радиатор', 'Тонкие трубки и пластины-ламели: горячий антифриз отдаёт тепло встречному воздуху. Забитые грязью соты — частая причина перегрева летом.'],
  fan: ['Вентилятор', 'Включается, когда встречного потока не хватает — в пробке или на месте. На трассе часто вообще не нужен.'],
  heater: ['Радиатор печки', 'Малый круг: горячий антифриз греет салон. Поэтому печка не дует теплом, пока мотор холодный. При перегреве включённая на максимум печка помогает сбросить немного тепла.'],
  tank: ['Расширительный бачок', 'Антифриз при нагреве расширяется, система под давлением ~1–1,5 бар. Уровень проверяют по меткам MIN/MAX на холодном двигателе. Открывать горячим нельзя — выплеснется кипяток.'],
  engine: ['Рубашка охлаждения', 'Каналы вокруг цилиндров и в головке. Около трети энергии топлива уходит сюда — её нужно постоянно отводить.'],
};

type Fault = 'none' | 'open' | 'closed' | 'fan' | 'low';
const FAULTS: { v: Fault; l: string }[] = [
  { v: 'none', l: 'Всё исправно' }, { v: 'closed', l: 'Термостат закис закрытым' }, { v: 'open', l: 'Термостат закис открытым' }, { v: 'fan', l: 'Не работает вентилятор' }, { v: 'low', l: 'Мало антифриза' },
];

export function Cooling() {
  const info = useInfo();
  const [load, setLoad] = useState<'idle' | 'city' | 'hwy'>('idle');
  const [fault, setFault] = useState<Fault>('none');
  const s = useRef({ T: 20, fan: false, ph: { j: 0, u: 0, c: 0, l: 0, h: 0, p: 0 }, ang: 0 });
  const [, force] = useState(0);
  useTicker((dt0) => {
    const st = s.current, dt = dt0 * 5; // ускорено ×5
    const heat = { idle: 1.1, city: 1.6, hwy: 2.2 }[load];
    const air = { idle: 0.15, city: 0.5, hwy: 1.6 }[load];
    let f = clamp((st.T - 87) / 10);
    if (fault === 'open') f = 1;
    if (fault === 'closed') f = 0;
    if (st.T >= 101) st.fan = true;
    if (st.T <= 97) st.fan = false;
    const fanOn = st.fan && fault !== 'fan';
    const eff = fault === 'low' ? 0.35 : 1;
    const cool = 0.008 * (st.T - 20) + 0.03 * f * (st.T - 20) * (air + (fanOn ? 1.1 : 0)) * eff;
    st.T = Math.min(130, st.T + (heat - cool) * dt);
    const pump = 0.35;
    st.ph.j += dt0 * pump * 0.9;
    st.ph.h += dt0 * pump * 0.6;
    st.ph.p += dt0 * pump * 2;
    st.ph.u += dt0 * pump * f;
    st.ph.c += dt0 * pump * f * 0.8;
    st.ph.l += dt0 * pump * f * 0.8;
    st.ang += dt0 * (fanOn ? 900 : 0);
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  let f = clamp((st.T - 87) / 10);
  if (fault === 'open') f = 1;
  if (fault === 'closed') f = 0;
  const hot = mix('#3fb4ff', '#ff6a4a', clamp((st.T - 20) / 90));
  const radOut = mix('#3fb4ff', '#ff6a4a', clamp((st.T - 45) / 120));
  const fanOn = st.fan && fault !== 'fan';
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'Охлаждение', color: '#4dd6c4' }) });
  const over = st.T >= 112;
  const needle = -120 + clamp((st.T - 40) / 90) * 240;

  return (
    <div className="split wide-aside">
      <Stage label={<>FIG. 06 — <b>Система охлаждения</b> · {f > 0.05 ? 'большой круг' : 'малый круг'}</>} hint="нажмите на узел">
        <svg viewBox="30 50 770 450" className="fig">
          <g {...hit('heater')}>
            <Pipe pts={HEATER} color={hot} w={10} />
            <Particles pts={HEATER} phase={st.ph.h} n={16} color={hot} r={2.6} />
            <rect className="hl" x={170} y={72} width={90} height={40} rx={6} fill="#13203a" stroke="#5a6d90" />
            {Array.from({ length: 8 }, (_, i) => <line key={i} x1={180 + i * 10} x2={180 + i * 10} y1={78} y2={106} stroke="#3a4b6c" />)}
            <text x={215} y={66} textAnchor="middle" className="svg-label">печка</text>
          </g>
          <g {...hit('engine')}>
            <rect className="hl" x={112} y={180} width={276} height={236} rx={16} fill="#0b1426" stroke="#3a4b6c" strokeWidth="2" />
            <Pipe pts={JACKET} color={hot} w={12} />
            <Particles pts={JACKET} phase={st.ph.j} n={26} color={hot} r={2.8} />
            <text x={250} y={436} textAnchor="middle" className="svg-label">двигатель · {Math.round(st.T)} °C</text>
          </g>
          <g {...hit('thermo')}>
            <Pipe pts={UPPER} color={hot} w={14} on={f > 0.02} />
            {f > 0.02 && <Particles pts={UPPER} phase={st.ph.u} n={10} color={hot} r={3} />}
            <circle className="hl" cx={404} cy={200} r={20} fill="#13203a" stroke={f > 0.02 ? '#4dd6c4' : '#5a6d90'} strokeWidth="2" />
            <rect x={398} y={186 + f * 8} width={12} height={10} rx={3} fill="#f0a531" />
            <line x1={392} x2={416} y1={200} y2={200} stroke="#c7d4e8" strokeWidth="3" transform={`rotate(${f * 80} 404 200)`} />
            <text x={404} y={244} textAnchor="middle" className="svg-label" style={{ fill: f > 0.02 ? '#4dd6c4' : undefined }}>термостат {f > 0.95 ? 'открыт' : f > 0.02 ? 'приоткрыт' : 'закрыт'}</text>
          </g>
          <g {...hit('tank')}>
            <Pipe pts={TANK} color="#4dd6c4" w={6} />
            <rect className="hl" x={470} y={70} width={74} height={56} rx={8} fill="rgba(220,240,255,.08)" stroke="#a7b6cf" />
            <rect x={472} y={96 - (fault === 'low' ? -18 : 0)} width={70} height={fault === 'low' ? 10 : 28} rx={6} fill="#4dd6c4" opacity=".5" />
            <text x={508} y={62} textAnchor="middle" className="svg-label">бачок</text>
          </g>
          <g {...hit('rad')}>
            <rect className="hl" x={630} y={140} width={140} height={306} rx={8} fill="#0d1a2e" stroke="#4dd6c4" strokeOpacity=".7" strokeWidth="2" />
            {Array.from({ length: 12 }, (_, i) => <line key={i} x1={642 + i * 11} x2={642 + i * 11} y1={160} y2={428} stroke={mix(hot, radOut, 0.5)} strokeOpacity={0.15 + f * 0.4} strokeWidth="4" />)}
            {f > 0.02 && <Particles pts={CORE} phase={st.ph.c} n={10} color={radOut} r={3} colorAt={(x) => mix(hot, radOut, x)} />}
            <text x={700} y={470} textAnchor="middle" className="svg-label">радиатор</text>
          </g>
          <g {...hit('fan')}>
            <g transform={`translate(700 293) rotate(${st.ang})`} opacity={fanOn ? 0.9 : 0.35}>
              {[0, 72, 144, 216, 288].map((a) => <path key={a} d="M0,0 C18,-10 46,-14 56,-4 C46,4 18,6 0,0" fill="#8fa3c6" transform={`rotate(${a})`} />)}
              <circle r={9} fill="#3a4a69" />
            </g>
            <text x={700} y={128} textAnchor="middle" className="svg-label" style={{ fill: fanOn ? '#3de2ff' : undefined }}>вентилятор {fanOn ? 'вкл' : 'выкл'}</text>
          </g>
          <Pipe pts={LOWER} color={radOut} w={14} on={f > 0.02} />
          {f > 0.02 && <Particles pts={LOWER} phase={st.ph.l} n={18} color={radOut} r={3} />}
          <g {...hit('pump')}>
            <Pipe pts={PUMP_OUT} color={hot} w={12} />
            <circle className="hl" cx={86} cy={400} r={20} fill="#13203a" stroke="#5a6d90" strokeWidth="2" />
            <g transform={`translate(86 400) rotate(${st.ph.p * 360})`}>{[0, 60, 120, 180, 240, 300].map((a) => <line key={a} x1={0} y1={0} x2={14} y2={0} stroke="#4dd6c4" strokeWidth="3" transform={`rotate(${a})`} />)}</g>
            <text x={86} y={444} textAnchor="middle" className="svg-label">помпа</text>
          </g>
          {/* указатель температуры */}
          <g transform="translate(560 300)">
            <path d="M-34,20 A40,40 0 1 1 34,20" fill="none" stroke="rgba(130,175,255,.2)" strokeWidth="6" />
            <path d="M24,-30 A40,40 0 0 1 34,20" fill="none" stroke="#ff4b5c" strokeWidth="6" />
            <line x1={0} y1={0} x2={0} y2={-34} stroke={over ? '#ff4b5c' : '#e8eefa'} strokeWidth="3" strokeLinecap="round" transform={`rotate(${needle})`} />
            <circle r={5} fill="#e8eefa" />
            <text x={-30} y={38} className="svg-label" style={{ fill: '#3fb4ff' }}>C</text>
            <text x={24} y={38} className="svg-label" style={{ fill: '#ff4b5c' }}>H</text>
          </g>
        </svg>
        <div className="stage-ctl">
          <div className="row">
            <button className="btn sm" onClick={() => (s.current.T = 20)}>Двигатель холодный</button>
            <button className="btn sm" onClick={() => (s.current.T = 90)}>Прогретый</button>
          </div>
          <Seg value={load} onChange={setLoad} options={[{ v: 'idle', l: 'Пробка' }, { v: 'city', l: 'Город' }, { v: 'hwy', l: 'Трасса' }]} />
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <span className="eyebrow">Неисправность</span>
          <div className="stack" style={{ gap: 6 }}>
            {FAULTS.map((x) => <button key={x.v} className={`btn sm${fault === x.v ? ' on' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setFault(x.v)}>{x.l}</button>)}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Время ускорено в 5 раз.</p>
        </div>
        {over ? (
          <Callout kind="stop"><b>Перегрев.</b> Остановитесь в безопасном месте и заглушите мотор. Печку на максимум можно включить ещё в движении — это немного остудит двигатель. Крышку бачка не открывать, пока не остынет. Дальше — сервис: езда на перегретом моторе ведёт к пробою прокладки ГБЦ.</Callout>
        ) : f < 0.02 ? (
          <Callout kind="info">Термостат закрыт: антифриз ходит по малому кругу (двигатель и печка), радиатор холодный. Так мотор прогревается быстрее.</Callout>
        ) : (
          <Callout kind="info">Термостат открыт: горячий антифриз идёт в радиатор, остывает и через помпу возвращается в двигатель.</Callout>
        )}
        <div className="legend"><span><i style={{ background: '#3fb4ff' }} />холодный антифриз</span><span><i style={{ background: '#ff6a4a' }} />горячий</span></div>
      </div>
    </div>
  );
}
