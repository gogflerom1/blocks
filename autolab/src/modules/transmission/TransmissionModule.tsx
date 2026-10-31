import { useMemo, useState } from 'react';
import { useSubTab } from '../../lib/router';
import { BOXES, BoxId } from '../../content/transmission';
import { ModHead, Tabs } from '../../ui/kit';
import { Manual } from './Manual';
import { Clutch } from './Clutch';
import { Automatic } from './Automatic';
import { Robot } from './Robot';
import { CVT } from './CVT';
import { Drive, Differential } from './Drive';
import { useVehicle } from '../../lib/vehicle';
import { MyCarBadge, SrcChip } from '../../ui/src';

const TABS = [
  { id: 'compare', label: 'Сравнение' },
  { id: 'manual', label: 'МКПП' },
  { id: 'clutch', label: 'Сцепление' },
  { id: 'auto', label: 'Автомат' },
  { id: 'robot', label: 'Робот / DSG' },
  { id: 'cvt', label: 'Вариатор' },
  { id: 'drive', label: 'Привод' },
  { id: 'diff', label: 'Дифференциал' },
] as const;
type T = (typeof TABS)[number]['id'];

/** Обороты и тяга во время разгона 0→100 для каждого типа коробки (качественная модель) */
function curves(id: BoxId) {
  const N = 240, rpm: number[] = [], pull: number[] = [];
  const shifts = { mt: 4, at: 5, amt: 4, dct: 6, cvt: 0 }[id];
  const gap = { mt: 0.05, at: 0.012, amt: 0.08, dct: 0.004, cvt: 0 }[id];
  const dip = { mt: 1, at: 0.25, amt: 1, dct: 0.08, cvt: 0 }[id];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    if (id === 'cvt') {
      rpm.push(t < 0.08 ? 0.25 + (t / 0.08) * 0.5 : 0.75);
      pull.push(0.95 - t * 0.45);
      continue;
    }
    const seg = Math.min(shifts, Math.floor(Math.pow(t, 0.75) * (shifts + 1)));
    const segStart = Math.pow(seg / (shifts + 1), 1 / 0.75), segEnd = Math.pow((seg + 1) / (shifts + 1), 1 / 0.75);
    const k = (t - segStart) / (segEnd - segStart);
    const inGap = seg > 0 && t - segStart < gap;
    rpm.push(0.45 + k * 0.4 - (inGap ? 0.05 : 0));
    pull.push((inGap ? 1 - dip : 1) * (1 - seg * 0.13) * (id === 'at' && seg === 0 ? 1.15 : 1) * 0.85);
  }
  return { rpm, pull };
}

function Compare({ go }: { go: (t: T) => void }) {
  const v = useVehicle();
  const mine: BoxId | null = v?.powertrain.transmission?.type?.includes('automatic') ? 'at' : null;
  const [sel, setSel] = useState<BoxId>(mine ?? 'mt');
  const c = useMemo(() => curves(sel), [sel]);
  const b = BOXES.find((x) => x.id === sel)!;
  const W = 520, H = 120;
  const line = (arr: number[]) => arr.map((v, i) => `${(i / (arr.length - 1)) * W},${H - 8 - v * (H - 20)}`).join(' ');
  return (
    <div className="stack">
      <div className="cmp-cards">
        {BOXES.map((x) => (
          <button key={x.id} className="bx" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
            <span className="eyebrow">{x.short}{mine === x.id && <b style={{ color: 'var(--green)' }}> · ваша</b>}</span>
            <h3>{x.title}</h3>
            <p>{x.feel}</p>
          </button>
        ))}
      </div>
      <div className="split">
        <div className="panel">
          <span className="eyebrow">Разгон 0 → 100 км/ч · {b.title}</span>
          <svg viewBox={`0 0 ${W} ${H * 2 + 20}`} style={{ width: '100%', display: 'block' }}>
            <text x={0} y={12} className="svg-label">обороты двигателя</text>
            <polyline points={line(c.rpm)} fill="none" stroke="#ff8a4c" strokeWidth={2.5} />
            <g transform={`translate(0 ${H + 20})`}>
              <text x={0} y={12} className="svg-label">тяга на колёсах</text>
              <polyline points={`0,${H - 8} ${line(c.pull)} ${W},${H - 8}`} fill="#3de2ff" fillOpacity=".12" />
              <polyline points={line(c.pull)} fill="none" stroke="#3de2ff" strokeWidth={2.5} />
            </g>
          </svg>
          <p className="muted" style={{ fontSize: 13 }}>Провалы на графике тяги — моменты переключения. Чем они глубже и шире, тем сильнее «кивает» машина.</p>
        </div>
        <div className="stack">
          <div className="panel">
            <h3>{b.title}</h3>
            <p className="muted">{b.how}</p>
            <div className="grid2" style={{ marginTop: 10 }}>
              <div><h4 style={{ color: 'var(--green)' }}>Плюсы</h4><ul>{b.plus.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h4 style={{ color: 'var(--amber)' }}>Минусы</h4><ul>{b.minus.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => go(b.tab as T)}>Посмотреть, как устроена →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransmissionModule({ sub }: { sub: string }) {
  const [tab, setTab] = useSubTab<T>('gearbox', TABS.map((t) => t.id), sub);
  const v = useVehicle();
  return (
    <>
      <ModHead title="Коробка и привод" lead="Зачем нужны передачи, чем механика отличается от автомата, робота и вариатора, и как мощность доходит до колёс." />
      {v?.powertrain.transmission && <MyCarBadge p={v}>Коробка {v.powertrain.transmission.model}: {v.powertrain.transmission.gears}-ступенчатый гидромеханический автомат, ATF {v.powertrain.transmission.atf_spec} <SrcChip p={v} path="powertrain.transmission.model" /> · привод {v.vehicle.drive === 'FWD' ? 'передний' : String(v.vehicle.drive)} <SrcChip p={v} path="vehicle.drive" /></MyCarBadge>}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'compare' && <Compare go={setTab} />}
      {tab === 'manual' && <Manual />}
      {tab === 'clutch' && <Clutch />}
      {tab === 'auto' && <Automatic />}
      {tab === 'robot' && <Robot />}
      {tab === 'cvt' && <CVT />}
      {tab === 'drive' && <Drive />}
      {tab === 'diff' && <Differential />}
    </>
  );
}
