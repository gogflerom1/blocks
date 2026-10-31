import { useMemo, useRef, useState } from 'react';
import { useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { Fuel, PARTS, STROKES } from '../../content/engine';
import { Cylinder, crownY, gasColor, pressure } from './Cylinder';
import { Seg, Stage } from '../../ui/kit';
import { Ico } from '../../ui/icons';
import { useVehicle } from '../../lib/vehicle';
import { Fact } from '../../ui/src';

const SPEEDS = [0.25, 0.5, 1, 2] as const;
const FIRING = [{ n: 1, off: 0 }, { n: 2, off: 540 }, { n: 3, off: 180 }, { n: 4, off: 360 }];
const norm = (t: number) => ((t % 720) + 720) % 720;

export function usePlayback(initial = 30, base = 150) {
  const th = useRef(initial);
  const [, force] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(0.5);
  const time = useRef(0);
  useTicker((dt) => {
    time.current += dt;
    if (playing) th.current = th.current + dt * base * speed;
    force((n) => (n + 1) % 1e6);
  });
  return { theta: th.current, set: (v: number) => { th.current = v; force((n) => n + 1); }, playing, setPlaying, speed, setSpeed, time: time.current };
}

export function PressureChart({ theta, fuel, compact }: { theta: number; fuel: Fuel; compact?: boolean }) {
  const W = 320, H = compact ? 110 : 140, pad = 26;
  const max = fuel === 'diesel' ? 110 : 75;
  const path = useMemo(() => {
    let d = '';
    for (let t = 0; t <= 720; t += 3) {
      const x = pad + (t / 720) * (W - pad - 6), y = H - 18 - (pressure(t, fuel) / max) * (H - 30);
      d += (t ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  }, [fuel, H, max]);
  const t = norm(theta);
  const x = pad + (t / 720) * (W - pad - 6), y = H - 18 - (pressure(t, fuel) / max) * (H - 30);
  const peak = Math.round(Math.max(...Array.from({ length: 120 }, (_, i) => pressure(340 + i, fuel))));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Давление в цилиндре по углу поворота">
      {STROKES.map((s) => (
        <rect key={s.id} x={pad + (s.from / 720) * (W - pad - 6)} y={6} width={((s.to - s.from) / 720) * (W - pad - 6)} height={H - 24} fill={s.color} opacity={t >= s.from && t < s.to ? 0.14 : 0.04} />
      ))}
      {[0, 180, 360, 540, 720].map((v) => (
        <g key={v}>
          <line x1={pad + (v / 720) * (W - pad - 6)} x2={pad + (v / 720) * (W - pad - 6)} y1={6} y2={H - 18} stroke="rgba(130,175,255,.15)" />
          <text x={pad + (v / 720) * (W - pad - 6)} y={H - 4} textAnchor="middle" className="svg-label" style={{ fontSize: 9 }}>{v}°</text>
        </g>
      ))}
      <text x={pad - 4} y={14} textAnchor="end" className="svg-label" style={{ fontSize: 9 }}>{max}</text>
      <text x={pad - 4} y={H - 18} textAnchor="end" className="svg-label" style={{ fontSize: 9 }}>0</text>
      <text x={pad + 4} y={16} className="svg-label" style={{ fontSize: 9.5, fill: '#a7b6cf' }}>бар · пик ≈ {peak}</text>
      <path d={path} fill="none" stroke="#3de2ff" strokeWidth="2" />
      <line x1={x} x2={x} y1={6} y2={H - 18} stroke="#fff" strokeOpacity=".35" />
      <circle cx={x} cy={y} r={5} fill="#fff" stroke="#3de2ff" strokeWidth="2" />
    </svg>
  );
}

export function StrokeBar({ theta, onJump, fuel }: { theta: number; onJump?: (deg: number) => void; fuel: Fuel }) {
  const t = norm(theta);
  return (
    <div className="strokebar">
      {STROKES.map((s) => {
        const on = t >= s.from && t < s.to;
        const p = on ? (t - s.from) / 180 : t >= s.to ? 1 : 0;
        return (
          <button key={s.id} className={`sb${on ? ' on' : ''}`} style={{ ['--c' as string]: s.color }} onClick={() => onJump?.(s.from + 1)}>
            <i style={{ width: `${p * 100}%` }} />
            <span className="mono">{s.id}</span> {s.name}
            {s.id === 3 && <small>{fuel === 'petrol' ? 'искра' : 'самовоспл.'}</small>}
          </button>
        );
      })}
    </div>
  );
}

export function FourCylinders({ theta, fuel }: { theta: number; fuel: Fuel }) {
  return (
    <div className="panel">
      <span className="eyebrow">4 цилиндра · порядок работы 1-3-4-2</span>
      <div className="fourcyl">
        {FIRING.map(({ n, off }) => {
          const t = norm(theta - off);
          const st = STROKES.find((s) => t >= s.from && t < s.to)!;
          const g = gasColor(t, fuel);
          const cy = 12 + ((crownY(t) - 203) / 124) * 46;
          return (
            <div key={n} className="mini">
              <svg viewBox="0 0 40 92" role="img" aria-label={`Цилиндр ${n}: ${st.name}`}>
                <rect x="5" y="4" width="30" height="76" rx="3" fill="#050912" stroke="#3a4b6c" />
                <rect x="6" y="5" width="28" height={Math.max(0, cy - 5)} fill={g.c} opacity={g.o} />
                <rect x="6" y={cy} width="28" height="20" rx="2" fill="#c7d4e8" />
              </svg>
              <b className="mono">{n}</b>
              <span style={{ color: st.color }}>{st.name}</span>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Пока один цилиндр в рабочем ходе, остальные впускают, сжимают и выпускают. Поэтому вал крутится ровно, а не толчками.</p>
    </div>
  );
}

export function FourStroke() {
  const v = useVehicle();
  const eng = v?.powertrain.engine;
  const pb = usePlayback(20, 150);
  const [fuel, setFuel] = useState<Fuel>('petrol');
  const [sel, setSel] = useState<string | null>(null);
  const info = useInfo();
  const t = norm(pb.theta);
  const st = STROKES.find((s) => t >= s.from && t < s.to)!;
  const onPart = (id: string) => {
    pb.setPlaying(false);
    setSel(id);
    const p = PARTS[id];
    info.show({ id, title: p.title, text: p.text, kicker: 'Деталь двигателя', color: '#ff8a4c' });
  };

  return (
    <div className="split wide-aside">
      <div className="stack">
        <Stage label={<>FIG. 02 — <b>Цикл Отто</b> · разрез цилиндра</>} hint={pb.playing ? 'нажмите на деталь' : 'пауза · выберите деталь'}>
          <Cylinder theta={pb.theta} fuel={fuel} time={pb.time} sel={sel} onPart={onPart} />
          <div className="stroke-badge" style={{ ['--c' as string]: st.color }}>
            <span className="mono">ТАКТ {st.id}/4</span>
            <b>{st.name}</b>
          </div>
        </Stage>
        <StrokeBar theta={pb.theta} fuel={fuel} onJump={(d) => { pb.set(d); pb.setPlaying(false); }} />
      </div>
      <div className="stack">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Seg value={fuel} onChange={setFuel} options={[{ v: 'petrol', l: 'Бензин' }, { v: 'diesel', l: 'Дизель' }]} label="Тип двигателя" />
            <span className="mono tnum muted" style={{ fontSize: 13 }}>{Math.round(t)}° · вал {Math.floor(t / 360) + 1}/2 об.</span>
          </div>
          <h3 style={{ marginTop: 14, color: st.color, fontSize: 20 }}>{st.id}. {st.name}</h3>
          <p className="muted" style={{ minHeight: 96 }}>{st[fuel]}</p>
        </div>
        <div className="panel">
          <span className="eyebrow">Управление</span>
          <div className="row">
            <button className="btn primary" onClick={() => pb.setPlaying(!pb.playing)} aria-label={pb.playing ? 'Пауза' : 'Пуск'}>
              {pb.playing ? <Ico.pause width={18} /> : <Ico.play width={18} />}{pb.playing ? 'Пауза' : 'Пуск'}
            </button>
            <button className="btn" onClick={() => { pb.setPlaying(false); pb.set(pb.theta + 15); }}><Ico.step width={18} />+15°</button>
            <Seg value={pb.speed} onChange={pb.setSpeed} options={SPEEDS.map((v) => ({ v, l: `${v}×` }))} mono label="Скорость" />
          </div>
          <div className="range" style={{ marginTop: 12 }}>
            <label htmlFor="crank"><span>Угол коленвала</span><b>{Math.round(t)}°</b></label>
            <input id="crank" type="range" min={0} max={719} value={Math.round(t)} style={{ ['--p' as string]: `${(t / 720) * 100}%` }}
              onChange={(e) => { pb.setPlaying(false); pb.set(+e.target.value); }} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>1× ≈ 25 об/мин — в 30 раз медленнее холостого хода.</p>
        </div>
        <div className="panel">
          <span className="eyebrow">Давление в цилиндре (упрощённая модель)</span>
          <PressureChart theta={pb.theta} fuel={fuel} />
        </div>
        {v && eng && (
          <div className="panel" style={{ borderColor: 'rgba(54,224,160,.35)' }}>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Ваш мотор · {v.model} {v.generation}</span>
            <Fact p={v} path="powertrain.engine.code" label="Двигатель" v={eng.code}>{eng.code} {eng.family}</Fact>
            <Fact p={v} path="powertrain.engine.compression_ratio" label="Сжатие" v={eng.compression_ratio}>{eng.compression_ratio} : 1 {eng.compression_ratio === 10.5 && '— как на схеме'}</Fact>
            <Fact p={v} path="powertrain.engine.bore_mm" label="Цилиндр" v={eng.bore_mm}>⌀ {eng.bore_mm} × ход {eng.stroke_mm} мм</Fact>
            <Fact p={v} path="powertrain.engine.firing_order" label="Порядок работы" v={eng.firing_order} />
            <Fact p={v} path="powertrain.engine.power_rpm" label="Макс. мощность" v={eng.power_rpm}>при {eng.power_rpm} об/мин — коленвал {Math.round((eng.power_rpm ?? 0) / 60)} об/с, каждый цилиндр делает {Math.round((eng.power_rpm ?? 0) / 120)} рабочих ходов в секунду</Fact>
          </div>
        )}
        <FourCylinders theta={pb.theta} fuel={fuel} />
        <div className="legend">
          <span><i style={{ background: '#8fd8ff' }} />воздух</span>
          <span><i style={{ background: '#b9ef6b' }} />смесь</span>
          <span><i style={{ background: '#ffd54a' }} />топливо</span>
          <span><i style={{ background: '#ff6a3c' }} />сгорание</span>
          <span><i style={{ background: '#a2958c' }} />выхлоп</span>
          <span><i style={{ background: '#3fb4ff' }} />антифриз</span>
          <span><i style={{ background: '#f0a531' }} />масло</span>
        </div>
      </div>
    </div>
  );
}
