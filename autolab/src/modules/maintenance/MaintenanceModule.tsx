import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ITEMS, MItem } from '../../content/maintenance';
import { useVehicle } from '../../lib/vehicle';
import { go } from '../../lib/router';
import { Callout, ModHead, Range, SafetyTag, Seg } from '../../ui/kit';

const MAX = 150000;
const TICKS = [0, 10000, 30000, 60000, 100000, 150000];

type Plan = { item: MItem; every: number; byTime: boolean; points: number[]; inspect: number[] };

export function MaintenanceModule() {
  const v = useVehicle();
  const [annual, setAnnual] = useState(15000);
  const [severe, setSevere] = useState(false);
  const [odo, setOdo] = useState(30000);
  const [sel, setSel] = useState<string>('oil');
  const plans: Plan[] = useMemo(() => ITEMS.map((it) => {
    const ov = v?.maintenance?.[it.id];
    const km = ov?.km ?? (severe && it.kmSevere ? it.kmSevere : it.km);
    const yrs = ov?.years ?? it.years;
    const byYears = yrs ? yrs * annual : undefined;
    const every = Math.min(km ?? Infinity, byYears ?? Infinity);
    const points: number[] = [];
    if (isFinite(every)) for (let x = every; x <= MAX + 1; x += every) points.push(Math.round(x));
    const inspect: number[] = [];
    if (it.inspect) for (let x = it.inspect; x <= MAX; x += it.inspect) inspect.push(x);
    return { item: it, every, byTime: !!byYears && byYears < (km ?? Infinity), points, inspect };
  }), [annual, severe, v]);
  const W = 900, L = 210, R = 20, rowH = 34;
  const X = (km: number) => L + (km / MAX) * (W - L - R);
  const H = plans.length * rowH + 40;
  const near = (p: Plan) => p.points.some((x) => Math.abs(x - odo) <= 2500) || p.inspect.some((x) => Math.abs(x - odo) <= 2500);
  const due = plans.filter(near);
  const cur = plans.find((p) => p.item.id === sel)!;
  const next = cur.points.find((x) => x > odo);
  const years = (km: number) => (km / annual).toFixed(1).replace('.', ',');

  return (
    <>
      <ModHead title="Техобслуживание" lead="Что и когда менять. Перетащите одометр — увидите, что подходит по плану." />
      <Callout kind="warn"><b>Шкала примерная.</b> Реальные интервалы — только в руководстве вашей машины. В тяжёлых условиях (пробки, короткие поездки, пыль, мороз) многие производители требуют обслуживать чаще.</Callout>
      {v && <Callout kind="info">Интервалы из профиля «{v.make} {v.model} {v.year}» подставлены там, где они заполнены. Источник: {v.sources.map((s) => s.title).join(', ')}.</Callout>}
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="grid3">
          <Range id="odo" label="Одометр" value={odo} min={0} max={MAX} step={500} onChange={setOdo} fmt={(x) => `${x.toLocaleString('ru')} км`} />
          <Range id="annual" label="Пробег в год" value={annual} min={5000} max={40000} step={1000} onChange={setAnnual} fmt={(x) => `${x.toLocaleString('ru')} км`} />
          <div className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Условия</span>
            <Seg value={severe ? 's' : 'n'} onChange={(x) => setSevere(x === 's')} options={[{ v: 'n', l: 'Обычные' }, { v: 's', l: 'Тяжёлые' }]} />
          </div>
        </div>
        <div className="scroll-x" style={{ marginTop: 12 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 720, display: 'block' }}>
            {TICKS.map((t) => (
              <g key={t}>
                <line x1={X(t)} x2={X(t)} y1={20} y2={H - 6} stroke="rgba(130,175,255,.14)" />
                <text x={X(t)} y={14} textAnchor="middle" className="mono" style={{ fontSize: 11, fill: '#a7b6cf' }}>{t === 150000 ? '150 тыс. км' : t / 1000}</text>
              </g>
            ))}
            {plans.map((p, i) => {
              const y = 36 + i * rowH;
              const on = p.item.id === sel, hot = near(p);
              return (
                <g key={p.item.id} className="hit" onClick={() => setSel(p.item.id)}>
                  <rect x={0} y={y - 15} width={W} height={rowH - 4} rx={8} fill={on ? 'rgba(61,226,255,.07)' : 'transparent'} />
                  <text x={8} y={y + 4} style={{ fontSize: 12.5, fill: hot ? '#3de2ff' : on ? '#e8eefa' : '#a7b6cf', fontWeight: hot || on ? 600 : 400 }}>{p.item.title.length > 30 ? p.item.title.slice(0, 29) + '…' : p.item.title}</text>
                  <line x1={L} x2={W - R} y1={y} y2={y} stroke="rgba(130,175,255,.1)" />
                  {p.inspect.map((x) => <line key={'i' + x} x1={X(x)} x2={X(x)} y1={y - 6} y2={y + 6} stroke="#6c7e9c" strokeWidth={1.5} />)}
                  {p.points.map((x) => {
                    const passed = x <= odo;
                    const c = Math.abs(x - odo) <= 2500 ? '#3de2ff' : passed ? '#36e0a0' : '#5a6d90';
                    return p.byTime
                      ? <rect key={x} x={X(x) - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${X(x)} ${y})`} fill={c} />
                      : <circle key={x} cx={X(x)} cy={y} r={6.5} fill={c} />;
                  })}
                </g>
              );
            })}
            <line x1={X(odo)} x2={X(odo)} y1={20} y2={H - 6} stroke="#ff6a3c" strokeWidth={2} />
            <rect x={X(odo) - 34} y={H - 22} width={68} height={18} rx={6} fill="#ff6a3c" />
            <text x={X(odo)} y={H - 9} textAnchor="middle" className="mono" style={{ fontSize: 10.5, fill: '#03121a', fontWeight: 700 }}>{Math.round(odo / 1000)} тыс.</text>
          </svg>
        </div>
        <div className="legend" style={{ marginTop: 8 }}>
          <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#5a6d90" /></svg>замена по пробегу</span>
          <span><svg width="12" height="12"><rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill="#5a6d90" /></svg>по времени (наступит раньше)</span>
          <span><svg width="12" height="12"><line x1="6" x2="6" y1="1" y2="11" stroke="#6c7e9c" strokeWidth="2" /></svg>осмотр</span>
          <span><i style={{ background: '#36e0a0' }} />сделано</span><span><i style={{ background: '#3de2ff' }} />сейчас</span>
        </div>
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <motion.div key={sel} className="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <span className="eyebrow">Позиция ТО</span>
          <h3 style={{ fontSize: 19 }}>{cur.item.title}</h3>
          <div style={{ margin: '8px 0' }}><SafetyTag level={cur.item.diy} /></div>
          <dl className="kv">
            <dt>Типично</dt><dd>{cur.item.range}</dd>
            <dt>На шкале</dt><dd>{isFinite(cur.every) ? `каждые ${Math.round(cur.every).toLocaleString('ru')} км ≈ ${years(cur.every)} г.${cur.byTime ? ' (по времени)' : ''}` : 'только осмотр'}</dd>
            <dt>Следующая</dt><dd>{next ? `на ${next.toLocaleString('ru')} км — через ${(next - odo).toLocaleString('ru')} км` : '—'}</dd>
          </dl>
          <p className="muted" style={{ marginTop: 10 }}>{cur.item.why}</p>
        </motion.div>
        <div className="stack">
          <div className="panel">
            <span className="eyebrow">Около {Math.round(odo / 1000)} тыс. км по плану</span>
            {due.length ? <ul>{due.map((p) => <li key={p.item.id}><button className="linkbtn" onClick={() => setSel(p.item.id)}>{p.item.title}</button></li>)}</ul> : <p className="muted">Ничего — следующее ТО позже.</p>}
          </div>
          <div className="panel">
            <span className="eyebrow">Без пробега — всегда</span>
            <ul>
              <li>Давление в шинах — раз в месяц, на холодных</li>
              <li>Уровень масла — раз в 1–2 недели</li>
              <li>Сезонная смена шин — дважды в год</li>
            </ul>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go('mycar')}>Подставить интервалы моей машины →</button>
          </div>
        </div>
      </div>
    </>
  );
}
