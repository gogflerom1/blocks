import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LAMPS, LEVEL_TEXT, Level } from '../../content/dashboard';
import { useTicker } from '../../lib/anim';
import { Callout, ModHead, Seg } from '../../ui/kit';
import { LampIcon } from './LampIcon';

function Dial({ x, value, max, label, ticks, red }: { x: number; value: number; max: number; label: string; ticks: number[]; red?: number }) {
  const a = (v: number) => -225 + (v / max) * 270;
  const P = (v: number, r: number) => [x + r * Math.cos((a(v) * Math.PI) / 180), 120 + r * Math.sin((a(v) * Math.PI) / 180)];
  return (
    <g>
      <circle cx={x} cy={120} r={100} fill="#060b16" stroke="#1f2d48" strokeWidth={2} />
      {ticks.map((t) => {
        const [x1, y1] = P(t, 88), [x2, y2] = P(t, 76), [tx, ty] = P(t, 62);
        return <g key={t}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={red !== undefined && t >= red ? '#ff4b5c' : '#a7b6cf'} strokeWidth={2.5} /><text x={tx} y={ty + 4} textAnchor="middle" className="mono" style={{ fontSize: 11, fill: '#6c7e9c' }}>{t}</text></g>;
      })}
      <line x1={x} y1={120} x2={P(value, 86)[0]} y2={P(value, 86)[1]} stroke="#ff6a3c" strokeWidth={3.5} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #ff6a3c)' }} />
      <circle cx={x} cy={120} r={8} fill="#1a2438" stroke="#5a6d90" />
      <text x={x} y={175} textAnchor="middle" className="mono" style={{ fontSize: 10, fill: '#6c7e9c', letterSpacing: '.15em' }}>{label}</text>
    </g>
  );
}

export function DashboardModule() {
  const [sel, setSel] = useState<string | null>('oil');
  const [filter, setFilter] = useState<'all' | Level>('all');
  const [demo, setDemo] = useState<'off' | 'on' | 'run'>('run');
  const [blink, setBlink] = useState(false);
  const rpm = useRef(0.8);
  const [, force] = useState(0);
  useTicker((dt, t) => { rpm.current = demo === 'run' ? 0.82 + Math.sin(t * 2.2) * 0.03 : demo === 'on' ? 0 : 0; force((n) => (n + 1) % 1e6); });
  useEffect(() => { const id = setInterval(() => setBlink((b) => !b), 500); return () => clearInterval(id); }, []);
  const lamp = LAMPS.find((l) => l.id === sel);
  const shown = LAMPS.filter((l) => filter === 'all' || l.level === filter);
  const keyOn = () => { setDemo('on'); setTimeout(() => setDemo('run'), 2600); };

  return (
    <>
      <ModHead title="Приборная панель" lead="Нажмите на значок — узнаете, что он значит, насколько срочно и можно ли ехать дальше." />
      <div className="cluster">
        <svg viewBox="0 0 900 250" className="cluster-svg">
          <rect x={4} y={4} width={892} height={242} rx={120} fill="#03060d" stroke="#1f2d48" strokeWidth={2} />
          <Dial x={170} value={demo === 'off' ? 0 : rpm.current} max={8} label="× 1000 об/мин" ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]} red={6} />
          <Dial x={730} value={0} max={240} label="км/ч" ticks={[0, 40, 80, 120, 160, 200, 240]} />
          <rect x={300} y={34} width={300} height={182} rx={20} fill="#060b16" stroke="#1f2d48" />
          <text x={450} y={64} textAnchor="middle" className="mono" style={{ fontSize: 12, fill: '#3de2ff' }}>{demo === 'on' ? 'ПРОВЕРКА ЛАМП' : demo === 'run' ? 'ДВИГАТЕЛЬ РАБОТАЕТ' : 'ЗАЖИГАНИЕ ВЫКЛ'}</text>
          {LAMPS.slice(0, 15).map((l, i) => {
            const on = demo === 'on' || (demo === 'run' && l.id === sel);
            const show = on && !(l.id === 'esp' && demo === 'run' && blink === false && sel === 'esp');
            return (
              <g key={l.id} transform={`translate(${318 + (i % 5) * 54} ${80 + Math.floor(i / 5) * 44})`} style={{ color: show ? l.color : '#1c2638', cursor: 'pointer', filter: show ? `drop-shadow(0 0 6px ${l.color})` : undefined }} onClick={() => setSel(l.id)}>
                <rect x={-4} y={-4} width={48} height={40} fill="transparent" />
                <LampIcon id={l.id} size={34} />
              </g>
            );
          })}
        </svg>
        <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
          <button className="btn sm" onClick={keyOn}>Ключ в положение ON</button>
          <span className="muted" style={{ fontSize: 12.5 }}>При включении зажигания загораются почти все лампы — это самотестирование. После запуска они должны погаснуть.</span>
        </div>
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="stack">
          <Seg value={filter} onChange={setFilter} options={[{ v: 'all', l: 'Все' }, { v: 'r', l: '🔴 Опасно' }, { v: 'y', l: '🟡 Проверить' }, { v: 'g', l: '🟢 Инфо' }]} />
          <div className="lamp-grid">
            {shown.map((l) => (
              <motion.button layout key={l.id} className="lamp" aria-pressed={sel === l.id} onClick={() => setSel(l.id)} style={{ ['--c' as string]: l.color }}>
                <span className="lamp-ic"><LampIcon id={l.id} size={36} /></span>
                <span>{l.title}</span>
              </motion.button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {lamp && (
            <motion.div key={lamp.id} className="stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="panel">
                <div className="fhead" style={{ color: lamp.color }}>
                  <span className="ic" style={{ width: 64, height: 64, background: '#03060d', boxShadow: `0 0 26px -6px ${lamp.color}` }}><LampIcon id={lamp.id} size={44} /></span>
                  <div className="stack" style={{ gap: 6 }}>
                    <h3 style={{ color: 'var(--ink)', fontSize: 19, margin: 0 }}>{lamp.title}</h3>
                    <span className={`tag ${LEVEL_TEXT[lamp.level].cls}`}><i className="dot" />{LEVEL_TEXT[lamp.level].label}</span>
                  </div>
                </div>
                <h4>Что означает</h4><p className="muted">{lamp.meaning}</p>
                <h4>Можно ли ехать</h4><p style={{ color: lamp.level === 'r' ? '#ffc2c8' : 'var(--ink)' }}>{lamp.drive}</p>
                <h4>Что сделать</h4><p className="muted">{lamp.todo}</p>
              </div>
              {lamp.level === 'r' && <Callout kind="stop">Красная лампа на ходу — повод безопасно остановиться и разобраться, а не «доехать до дома».</Callout>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="footer-note">Значки и их цвета у разных производителей немного отличаются. Точное значение — в руководстве вашей машины.</p>
    </>
  );
}
