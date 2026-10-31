import { useState } from 'react';
import { useInfo } from '../../lib/info';
import { PARTS, PETROL_VS_DIESEL, STROKES } from '../../content/engine';
import { Cylinder, pressure } from './Cylinder';
import { usePlayback } from './FourStroke';
import { Seg, Stage } from '../../ui/kit';
import { Ico } from '../../ui/icons';

export function PetrolDiesel() {
  const pb = usePlayback(300, 150);
  const info = useInfo();
  const [sel, setSel] = useState<string | null>(null);
  const t = ((pb.theta % 720) + 720) % 720;
  const st = STROKES.find((s) => t >= s.from && t < s.to)!;
  const onPart = (id: string) => { pb.setPlaying(false); setSel(id); info.show({ id, title: PARTS[id].title, text: PARTS[id].text, kicker: 'Деталь', color: '#ff8a4c' }); };
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button className="btn primary" onClick={() => pb.setPlaying(!pb.playing)}>{pb.playing ? <Ico.pause width={18} /> : <Ico.play width={18} />}{pb.playing ? 'Пауза' : 'Пуск'}</button>
          <Seg value={pb.speed} onChange={pb.setSpeed} options={[0.25, 0.5, 1, 2].map((v) => ({ v, l: `${v}×` }))} mono label="Скорость" />
        </div>
        <span className="mono" style={{ color: st.color }}>Такт {st.id} · {st.name} · {Math.round(t)}°</span>
      </div>
      <div className="grid2">
        {(['petrol', 'diesel'] as const).map((f) => (
          <Stage key={f} label={<>{f === 'petrol' ? <b>Бензиновый</b> : <b>Дизельный</b>} · сжатие {f === 'petrol' ? '10,5' : '17'} : 1</>}>
            <Cylinder theta={pb.theta} fuel={f} time={pb.time} labels={false} sel={sel} onPart={onPart} idPrefix={f} />
            <div className="pd-gauge">
              <span className="mono">{pressure(t, f).toFixed(0)} бар</span>
              <i style={{ height: `${Math.min(100, (pressure(t, f) / 110) * 100)}%`, background: f === 'petrol' ? '#b9ef6b' : '#8fd8ff' }} />
            </div>
          </Stage>
        ))}
      </div>
      <div className="panel scroll-x">
        <table className="cmp">
          <thead><tr><th /><th>Бензин</th><th>Дизель</th></tr></thead>
          <tbody>
            {PETROL_VS_DIESEL.map((r) => <tr key={r.k}><th>{r.k}</th><td>{r.p}</td><td>{r.d}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid2">
        <div className="panel">
          <h3>Почему дизелю не нужна искра</h3>
          <p className="muted">Если быстро сжать воздух, он нагревается — как насос, которым качают колесо. При сжатии в 17 раз температура доходит до 700–900 °C. Дизтопливо в таком воздухе вспыхивает само. Бензин так не умеет: при сжатии смеси он загорелся бы раньше времени — это детонация.</p>
        </div>
        <div className="panel">
          <h3>Свеча накаливания ≠ свеча зажигания</h3>
          <p className="muted">Свеча накаливания — это просто нагреватель. Работает перед пуском и первые минуты на холодную. На прогретом дизеле она не нужна, а свеча зажигания у бензинового мотора искрит в каждом цикле.</p>
        </div>
      </div>
    </div>
  );
}
