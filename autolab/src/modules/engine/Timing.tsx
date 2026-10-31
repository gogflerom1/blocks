import { useRef, useState } from 'react';
import { gearPath, useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { Callout, Seg, Stage } from '../../ui/kit';
import { crownY, deckY, liftIn } from './Cylinder';
import { useVehicle } from '../../lib/vehicle';
import { MyCarBadge, SrcChip } from '../../ui/src';

type C = { x: number; y: number; r: number; id: string };
// по часовой стрелке на экране: коленвал → обводной ролик → распредвал вып. → распредвал вп. → натяжитель
const CIRCLES: C[] = [
  { id: 'crank', x: 300, y: 440, r: 32 },
  { id: 'idler', x: 178, y: 300, r: 20 },
  { id: 'camEx', x: 210, y: 118, r: 64 },
  { id: 'camIn', x: 390, y: 118, r: 64 },
  { id: 'tens', x: 432, y: 300, r: 22 },
];

function beltPath(cs: C[], pad: number) {
  const cx = cs.reduce((s, c) => s + c.x, 0) / cs.length, cy = cs.reduce((s, c) => s + c.y, 0) / cs.length;
  const segs = cs.map((a, i) => {
    const b = cs[(i + 1) % cs.length];
    const ra = a.r + pad, rb = b.r + pad;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), al = Math.acos((ra - rb) / d);
    const opts = [phi + al, phi - al].map((n) => ({ p1: [a.x + ra * Math.cos(n), a.y + ra * Math.sin(n)], p2: [b.x + rb * Math.cos(n), b.y + rb * Math.sin(n)] }));
    const far = (o: (typeof opts)[0]) => Math.hypot((o.p1[0] + o.p2[0]) / 2 - cx, (o.p1[1] + o.p2[1]) / 2 - cy);
    return far(opts[0]) > far(opts[1]) ? opts[0] : opts[1];
  });
  let d = `M${segs[0].p1[0].toFixed(1)},${segs[0].p1[1].toFixed(1)}`;
  segs.forEach((s, i) => {
    const next = segs[(i + 1) % segs.length];
    const c = cs[(i + 1) % cs.length], r = c.r + pad;
    const aArr = Math.atan2(s.p2[1] - c.y, s.p2[0] - c.x), aDep = Math.atan2(next.p1[1] - c.y, next.p1[0] - c.x);
    const delta = (((aDep - aArr) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    d += `L${s.p2[0].toFixed(1)},${s.p2[1].toFixed(1)}A${r},${r} 0 ${delta > Math.PI ? 1 : 0} 1 ${next.p1[0].toFixed(1)},${next.p1[1].toFixed(1)}`;
  });
  return d;
}
const BELT = beltPath(CIRCLES, 4);

const INFO: Record<string, [string, string]> = {
  crank: ['Шестерня коленвала', 'Маленькая: в 2 раза меньше зубьев, чем у распредвала. За два оборота коленвала распредвалы делают ровно один — так клапаны открываются раз в 4 такта.'],
  camIn: ['Шкив распредвала впуска', 'Метки на шкивах и на блоке совмещают при замене ремня. Сдвиг даже на один зуб — мотор работает плохо или клапаны встречаются с поршнями.'],
  camEx: ['Шкив распредвала выпуска', 'Часто шкивы распредвалов имеют муфты изменения фаз (VVT): масло под давлением слегка доворачивает распредвал относительно шкива.'],
  tens: ['Натяжитель', 'Держит ремень (или цепь) натянутым. У ремня — ролик с пружиной, у цепи — гидронатяжитель от масляной системы. Ролики меняют вместе с ремнём.'],
  idler: ['Обводной ролик', 'Направляет ремень. Подшипник ролика — тоже расходник: заклинивший ролик рвёт ремень.'],
  belt: ['Ремень / цепь ГРМ', 'Связывает коленвал и распредвалы. Ремень: тихий и лёгкий, но его меняют по регламенту (часто 60–120 тыс. км или по годам — смотрите руководство). Цепь: работает в масле и обычно рассчитана на долгий срок, но растягивается, особенно при плохом масле.'],
};

export function Timing() {
  const info = useInfo();
  const v = useVehicle();
  const td = v?.powertrain.engine?.timing_drive;
  const [kind, setKind] = useState<'belt' | 'chain'>(td === 'chain' || td === 'belt' ? td : 'belt');
  const [interf, setInterf] = useState(true);
  const s = useRef({ crank: 30, cam: 15, omega: 220, mode: 'run' as 'run' | 'broken' | 'crash' | 'stop', bend: 0, off: 0 });
  const [, force] = useState(0);
  const maxLift = interf ? 22 : 10;
  useTicker((dt) => {
    const st = s.current;
    if (st.mode === 'run') { st.crank += st.omega * dt; st.cam = st.crank / 2; }
    else if (st.mode === 'broken') {
      st.omega = Math.max(0, st.omega - 70 * dt);
      st.crank += st.omega * dt;
      const th = (st.crank - st.off + 720) % 720;
      const lift = liftIn((st.cam * 2 - st.off + 720) % 720);
      const valveBottom = deckY('petrol') + lift * maxLift;
      if (crownY(th) <= valveBottom + 0.5 && lift > 0.05) st.mode = 'crash';
      if (st.omega <= 0) st.mode = 'stop';
    } else if (st.mode === 'crash') st.bend = Math.min(1, st.bend + dt * 3);
    force((n) => (n + 1) % 1e6);
  });
  const st = s.current;
  const breakNow = () => {
    // в 4-цилиндровом моторе в любой момент где-то открыт впускной клапан — показываем этот цилиндр
    st.off = [0, 180, 360, 540].reduce((b, o) => (liftIn((st.crank - o + 7200) % 720) > liftIn((st.crank - b + 7200) % 720) ? o : b), 0);
    st.cam = st.crank / 2;
    st.mode = 'broken';
    st.omega = 260;
  };
  const reset = () => { st.mode = 'run'; st.omega = 220; st.bend = 0; st.off = 0; };
  const camTh = (st.cam * 2 - st.off + 7200) % 720;
  const crankA = st.crank, camA = st.cam;
  const hit = (id: string) => ({ className: 'hit', onClick: () => info.show({ id, title: INFO[id][0], text: INFO[id][1], kicker: 'ГРМ', color: '#c79bff' }) });
  const broken = st.mode !== 'run';
  const color = kind === 'belt' ? '#3a4458' : '#8fa3c6';
  const ok = st.mode === 'stop';

  // мини-цилиндр
  const th = (st.crank - st.off + 7200) % 720;
  const crown = crownY(th);
  const cylN = ({ 0: 1, 180: 3, 360: 4, 540: 2 } as Record<number, number>)[st.off];
  const deck = deckY('petrol');
  const vb = deck + liftIn(camTh) * maxLift;

  return (
    <>
    {v && td && <MyCarBadge p={v}>У {v.powertrain.engine?.code} привод ГРМ — {td === 'chain' ? 'цепь' : 'ремень'}. <SrcChip p={v} path="powertrain.engine.timing_drive" /> Встречаются ли клапаны с поршнями — в профиле не указано.</MyCarBadge>}
    <div className="split wide-aside">
      <Stage label={<>FIG. 04 — <b>Привод ГРМ</b> · {kind === 'belt' ? 'зубчатый ремень' : 'цепь'}</>} hint="нажмите на шкив">
        <svg viewBox="100 30 440 470" className="fig" style={{ maxHeight: 560 }}>
          <rect x={130} y={40} width={380} height={450} rx={30} fill="#0b1426" stroke="#1f2d48" />
          {kind === 'chain' && !broken && (
            <g opacity=".9">
              <rect x={148} y={150} width={14} height={140} rx={7} fill="#2a3650" transform="rotate(-6 155 220)" />
              <rect x={448} y={160} width={14} height={140} rx={7} fill="#2a3650" transform="rotate(8 455 230)" />
            </g>
          )}
          {/* ремень / цепь */}
          <g {...hit('belt')}>
            {!broken ? (
              <>
                <path d={BELT} fill="none" stroke={color} strokeWidth={kind === 'belt' ? 10 : 9} strokeLinejoin="round" className="hl" />
                <path d={BELT} fill="none" stroke={kind === 'belt' ? '#1a2030' : '#c7d4e8'} strokeWidth={kind === 'belt' ? 10 : 5} strokeDasharray={kind === 'belt' ? '4 4' : '6 4'} strokeDashoffset={-((crankA * Math.PI) / 180) * 36} />
              </>
            ) : (
              <>
                <path d="M196,340 C150,380 170,450 230,470" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
                <path d="M420,330 C470,380 450,450 390,476" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
                <path d="M146,118 C140,60 280,40 306,70" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" opacity=".9" />
              </>
            )}
          </g>
          {CIRCLES.map((c) => {
            const isCam = c.id.startsWith('cam');
            const ang = c.id === 'crank' ? crankA : isCam ? camA : (crankA * 32) / c.r;
            const teeth = c.id === 'crank' ? 21 : isCam ? 42 : 0;
            return (
              <g key={c.id} {...hit(c.id)}>
                {teeth ? (
                  <path className="hl" d={gearPath(c.x, c.y, c.r - 3, teeth, 5, (ang * Math.PI) / 180)} fill={isCam ? '#1e2c47' : '#2a3a5a'} stroke="#8fa3c6" strokeWidth="1.2" />
                ) : (
                  <circle className="hl" cx={c.x} cy={c.y} r={c.r} fill="#2a3a5a" stroke="#8fa3c6" />
                )}
                <circle cx={c.x} cy={c.y} r={c.r * 0.28} fill="#0a1222" stroke="#5a6d90" />
                {teeth > 0 && <circle cx={c.x + (c.r - 14) * Math.sin((ang * Math.PI) / 180)} cy={c.y - (c.r - 14) * Math.cos((ang * Math.PI) / 180)} r={5} fill="#ff6a3c" />}
                {teeth > 0 && <path d={`M${c.x},${c.y - c.r - 14} l-6,-10 h12 Z`} fill="#ffb547" opacity=".8" />}
              </g>
            );
          })}
          <text x={300} y={498} textAnchor="middle" className="svg-label">коленвал · {Math.floor(crankA / 360) % 100} об.</text>
          <text x={300} y={60} textAnchor="middle" className="svg-label">распредвалы · {Math.floor(camA / 360) % 100} об.</text>
        </svg>
        <div className="stage-ctl">
          <Seg value={kind} onChange={(v) => { setKind(v); reset(); }} options={[{ v: 'belt', l: 'Ремень' }, { v: 'chain', l: 'Цепь' }]} />
          {broken ? <button className="btn" onClick={reset}>Починить</button> : <button className="btn danger" onClick={breakNow}>{kind === 'belt' ? 'Обрыв ремня' : 'Обрыв цепи'}</button>}
        </div>
      </Stage>
      <div className="stack">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">Цилиндр {cylN} · поршень и впускной клапан</span>
            <Seg value={interf ? 'i' : 'n'} onChange={(v) => { setInterf(v === 'i'); reset(); }} options={[{ v: 'i', l: 'Встречаются' }, { v: 'n', l: 'Не встречаются' }]} />
          </div>
          <svg viewBox="300 150 200 130" style={{ width: '100%', display: 'block', marginTop: 8 }}>
            <rect x={322} y={deck} width={156} height={130} fill="#050912" />
            <rect x={300} y={150} width={200} height={deck - 150} fill="#2b3a55" />
            <rect x={300} y={deck} width={22} height={140} fill="#2b3a55" />
            <rect x={478} y={deck} width={22} height={140} fill="#2b3a55" />
            <g transform={`rotate(${st.bend * 14} 362 ${vb})`}>
              <rect x={359.5} y={150} width={5} height={vb - 160} fill="#c7d4e8" />
              <path d={`M359,${vb - 10} L345,${vb} L379,${vb} L365,${vb - 10} Z`} fill={st.mode === 'crash' ? '#ff4b5c' : '#e9f0fb'} />
            </g>
            <rect x={324} y={crown} width={152} height={60} rx={3} fill="#c7d4e8" />
            {st.mode === 'crash' && <circle cx={362} cy={crown} r={14 + st.bend * 10} fill="#ff4b5c" opacity={0.6 - st.bend * 0.4} />}
          </svg>
          {st.mode === 'crash' && <Callout kind="stop"><b>Клапан ударился о поршень.</b> Распредвал встал с открытым клапаном, а коленвал по инерции поднял поршень. Итог — погнутые клапаны, иногда повреждённые поршни и ГБЦ: капитальный ремонт головки.</Callout>}
          {ok && <Callout kind="info"><b>Двигатель просто заглох.</b> В «невтыкающем» моторе ход клапана меньше зазора до поршня — после обрыва достаточно поставить новый ремень.</Callout>}
          {st.mode === 'run' && <p className="muted" style={{ fontSize: 13.5 }}>{interf ? 'В большинстве современных моторов клапан, открываясь, заходит в пространство, куда в другой момент приходит поршень. Пока ремень цел, они разминаются.' : 'Здесь клапану даже в открытом положении не дотянуться до поршня в верхней точке.'}</p>}
        </div>
        <div className="panel">
          <h3>Ремень vs цепь</h3>
          <dl className="kv">
            <dt>Ремень</dt><dd>Тихий, лёгкий, дешёвый. Замена по регламенту вместе с роликами (и часто помпой).</dd>
            <dt>Цепь</dt><dd>В масле, служит долго, но растягивается. Признак — металлический шелест на холодную, ошибки по фазам.</dd>
          </dl>
          <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>Встречаются ли клапаны с поршнями у вашего мотора и когда менять ремень — только по руководству или каталогу на конкретный двигатель.</p>
        </div>
      </div>
    </div>
    </>
  );
}
