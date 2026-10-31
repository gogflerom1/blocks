import { useEffect, useRef, useState } from 'react';
import { CarScene, FlowName, Gear } from './CarScene';
import { useCarScene } from './Home';
import { Callout, HoldButton, ModHead, Seg } from '../../ui/kit';
import { Gauge } from '../engine/Turbo';

const FLOW_TITLE: Record<FlowName, string> = { gas: 'Нажат газ', brake: 'Нажат тормоз', steer: 'Поворот руля', start: 'Запуск двигателя', lights: 'Включён свет' };

export function FreeModule() {
  const { host, scene } = useCarScene();
  const [engine, setEngine] = useState(false);
  const [gear, setGear] = useState<Gear>('P');
  const [lights, setLights] = useState(0);
  const [steer, setSteer] = useState(0);
  const [hood, setHood] = useState(false);
  const [hatch, setHatch] = useState(false);
  const [wheel, setWheel] = useState(false);
  const [xray, setXray] = useState(false);
  const [flow, setFlow] = useState<FlowName | null>(null);
  const [hint, setHint] = useState('');
  const last = useRef<FlowName>('start');
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const hud = useRef<{ speed: number; rpm: number }>({ speed: 0, rpm: 0 });
  const [, tick] = useState(0);

  useEffect(() => {
    if (!scene) return;
    let n = 0;
    scene.onFrame = () => {
      hud.current = { speed: scene.live.speed * 3.6, rpm: scene.live.rpm };
      if (n++ % 4 === 0) tick((x) => (x + 1) % 1e6);
      if (!flow) return;
      const f = CarScene.FLOWS[flow];
      const prog = scene.flowProgress();
      f.steps.forEach((s, i) => {
        const el = labels.current[i];
        const p = scene.flowPoint(s.at);
        if (!el || !p) return;
        const q = scene.project(p);
        el.style.transform = `translate3d(${q.x}px, ${q.y}px, 0) translate(-50%, -130%)`;
        el.style.opacity = prog >= s.at ? '1' : '0';
      });
    };
  });

  const L = () => scene?.live;
  const toggleEngine = () => {
    const l = L(); if (!l) return;
    if (engine) { l.engine = false; setEngine(false); setGear('P'); l.gear = 'P'; setHint('Двигатель заглушен.'); return; }
    l.cranking = 1.0;
    last.current = 'start';
    setHint('Стартер крутит маховик…');
    setTimeout(() => { l.engine = true; setEngine(true); setHint('Двигатель работает. Включите D и нажмите газ.'); }, 1000);
  };
  const setG = (g: Gear) => {
    const l = L(); if (!l) return;
    if (g === 'P' && l.speed > 0.5) { setHint('P включают только на стоящей машине: собачка не должна заходить на ходу.'); return; }
    l.gear = g; setGear(g);
    if (!engine && (g === 'D' || g === 'R')) setHint('Сначала заведите двигатель.');
  };
  const show = () => {
    if (!scene) return;
    const name = last.current;
    setFlow(name);
    scene.showFlow(name);
    scene.setXray(true);
    setXray(true);
  };
  const hide = () => { setFlow(null); scene?.showFlow(null); };
  const h = hud.current;
  const f = flow ? CarScene.FLOWS[flow] : null;

  return (
    <>
      <ModHead title="Свободный режим" lead="Заводите, газуйте, рулите, открывайте капот. Нажмите «Покажи, что сейчас происходит» — машина подсветит путь энергии." />
      <div className="split wide-aside">
        <div className="stage free-stage">
          <div ref={host} className="scene-host" />
          <div className="stage-label">SIM — <b>Машина в разрезе</b></div>
          {!scene && <div className="overlay-msg"><div className="box"><h2>3D недоступно</h2><p className="muted">Браузер не дал WebGL. Попробуйте другой браузер.</p></div></div>}
          <div className="free-hud">
            <Gauge label="Скорость" value={h.speed} max={180} unit="км/ч" color="#36e0a0" digits={0} />
            <Gauge label="Обороты" value={h.rpm} digits={0} max={7000} unit="об/мин" color={h.rpm > 5500 ? '#ff4b5c' : '#3de2ff'} />
          </div>
          {f && (
            <div className="flow-labels">
              {f.steps.map((s, i) => (
                <div key={s.label} ref={(el) => (labels.current[i] = el)} className="flow-label" style={{ ['--c' as string]: f.color, opacity: 0 }}><b>{i + 1}</b>{s.label}</div>
              ))}
            </div>
          )}
          <div className="drag-hint mono">⟲ вращайте машину</div>
        </div>
        <div className="stack">
          <button className="btn show-btn" onClick={show}>Покажи, что сейчас происходит</button>
          {flow && (
            <div className="panel">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="eyebrow" style={{ margin: 0, color: f?.color }}>{FLOW_TITLE[flow]}</span>
                <button className="btn sm" onClick={hide}>Скрыть</button>
              </div>
              <ol className="check">{f!.steps.map((s) => <li key={s.label}>{s.label}</li>)}</ol>
            </div>
          )}
          <div className="panel ctl-grid">
            <div className="row">
              <button className={`btn${engine ? ' on' : ''}`} onClick={toggleEngine}>{engine ? 'Заглушить' : 'Завести двигатель'}</button>
              <Seg value={gear} onChange={setG} options={['P', 'R', 'N', 'D'] as Gear[]} mono label="Селектор" />
            </div>
            <div className="row">
              <HoldButton className="btn primary big-hold" onHold={(on) => { const l = L(); if (l) l.throttle = on ? 1 : 0; if (on) { last.current = 'gas'; if (!engine) setHint('Двигатель не заведён — газ ничего не делает.'); else if (gear === 'P' || gear === 'N') setHint(`В ${gear} двигатель только набирает обороты: колёса отсоединены.`); else setHint(''); } }}>Газ</HoldButton>
              <HoldButton className="btn danger big-hold" onHold={(on) => { const l = L(); if (l) l.brake = on ? 1 : 0; if (on) last.current = 'brake'; }}>Тормоз</HoldButton>
            </div>
            <div className="range">
              <label htmlFor="steer"><span>Руль</span><b>{steer > 0 ? 'вправо' : steer < 0 ? 'влево' : 'прямо'}</b></label>
              <input id="steer" type="range" min={-100} max={100} value={steer} style={{ ['--p' as string]: `${(steer + 100) / 2}%` }}
                onChange={(e) => { const v = +e.target.value; setSteer(v); const l = L(); if (l) l.steer = v / 100; last.current = 'steer'; }}
                onPointerUp={() => { if (Math.abs(steer) < 12) { setSteer(0); const l = L(); if (l) l.steer = 0; } }} />
            </div>
            <div className="row">
              <span className="muted" style={{ fontSize: 13 }}>Свет</span>
              <Seg value={lights} onChange={(v) => { setLights(v); const l = L(); if (l) l.lights = v; if (v) last.current = 'lights'; }} options={[{ v: 0, l: 'Выкл' }, { v: 1, l: 'Ближний' }, { v: 2, l: 'Дальний' }]} />
            </div>
            <div className="row">
              <button className={`btn sm${hood ? ' on' : ''}`} onClick={() => { setHood(!hood); scene?.setHood(!hood); }}>Капот</button>
              <button className={`btn sm${hatch ? ' on' : ''}`} onClick={() => { setHatch(!hatch); scene?.setHatch(!hatch); }}>Багажник</button>
              <button className={`btn sm${wheel ? ' on' : ''}`} onClick={() => { setWheel(!wheel); scene?.setWheelOff(!wheel); }}>Снять колесо</button>
              <button className={`btn sm${xray ? ' on' : ''}`} onClick={() => { setXray(!xray); scene?.setXray(!xray); }}>Убрать кузов</button>
            </div>
          </div>
          {hint && <Callout kind="info">{hint}</Callout>}
        </div>
      </div>
    </>
  );
}
