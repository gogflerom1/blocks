import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FLUIDS, Fluid } from '../../content/underhood';
import { Callout, ModHead, Range, Seg, SafetyTag, Stage } from '../../ui/kit';
import { CapIcon, EngineBay } from './EngineBay';

const POS: Record<string, [number, number]> = { oil: [340, 262], coolant: [136, 162], brake: [597, 158], washer: [136, 458], ps: [222, 447], atf: [566, 330] };

/** Проверка щупом: 4 шага */
function Dipstick() {
  const [step, setStep] = useState(0);
  const [lvl, setLvl] = useState(65);
  const steps = ['Ровно, мотор заглушен', 'Вытащить', 'Протереть', 'Вставить до упора', 'Вытащить и смотреть'];
  const out = step === 1 || step === 2 || step === 4;
  const smear = step === 1 ? 100 : step === 4 ? lvl : 0;
  const verdict = lvl < 15 ? ['Ниже MIN — долить и найти причину', 'stop'] : lvl < 40 ? ['Ближе к MIN — можно долить', 'warn'] : lvl <= 100 ? ['В норме', 'info'] : ['Выше MAX', 'warn'];
  return (
    <div className="panel">
      <span className="eyebrow">Проверка щупом</span>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
        <svg viewBox="0 0 90 230" style={{ width: 80, flex: 'none' }}>
          <rect x="34" y="120" width="22" height="110" fill="#1b2433" stroke="#3a4b6c" />
          <g style={{ transition: 'transform .6s cubic-bezier(.6,0,.2,1)', transform: out ? 'translateY(-90px)' : 'none' }}>
            <circle cx="45" cy="104" r="13" fill="none" stroke="#ffd54a" strokeWidth="6" />
            <rect x="42" y="116" width="6" height="190" rx="2" fill="#c7d4e8" />
            <rect x="40" y="250" width="10" height="36" fill="none" stroke="#3de2ff" strokeDasharray="2 2" />
            <text x="58" y="254" className="mono" style={{ fontSize: 8, fill: '#a7b6cf' }}>MAX</text>
            <text x="58" y="288" className="mono" style={{ fontSize: 8, fill: '#a7b6cf' }}>MIN</text>
            {smear > 0 && <rect x="42" y={step === 1 ? 160 : 286 - (smear / 100) * 36} width="6" height={step === 1 ? 130 : 20 + (smear / 100) * 36} fill="#f0a531" opacity=".85" />}
          </g>
        </svg>
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          {steps.map((t, i) => (
            <button key={t} className={`btn sm${step === i ? ' on' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setStep(i)}>{i + 1}. {t}</button>
          ))}
        </div>
      </div>
      {step === 4 && (
        <div className="stack" style={{ marginTop: 10 }}>
          <Range id="dip-lvl" label="Уровень (пример)" value={lvl} min={0} max={115} onChange={setLvl} fmt={(v) => `${v}%`} />
          <Callout kind={verdict[1] as 'info'}>{verdict[0]}</Callout>
        </div>
      )}
      {step === 2 && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Первое вытаскивание показывает масло, размазанное по трубке, — по нему уровень не читают.</p>}
    </div>
  );
}

function CoolantTank() {
  const [hot, setHot] = useState(false);
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Бачок антифриза</span>
        <Seg value={hot ? 'h' : 'c'} onChange={(v) => setHot(v === 'h')} options={[{ v: 'c', l: 'Холодный' }, { v: 'h', l: 'После поездки' }]} />
      </div>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 14, marginTop: 8 }}>
        <svg viewBox="0 0 120 140" style={{ width: 110, flex: 'none' }}>
          <rect x="16" y="24" width="88" height="110" rx="14" fill="rgba(230,240,255,.1)" stroke="#c7d4e8" />
          <rect x="20" y={hot ? 44 : 62} width="80" height={hot ? 86 : 68} rx="10" fill="#ff6fb5" opacity=".7" />
          <line x1="20" x2="44" y1="50" y2="50" stroke="#fff" /><line x1="20" x2="44" y1="100" y2="100" stroke="#fff" />
          <text x="48" y="53" className="mono" style={{ fontSize: 9, fill: '#fff' }}>MAX</text><text x="48" y="103" className="mono" style={{ fontSize: 9, fill: '#fff' }}>MIN</text>
          <rect x="44" y="8" width="32" height="18" rx="5" fill={hot ? '#ff4b5c' : '#5a6d90'} />
          {hot && <g className="blink"><path d="M60,0 v-6" /><text x="60" y="140" textAnchor="middle" className="mono" style={{ fontSize: 10, fill: '#ff4b5c' }}>~1,2 бар · 100 °C</text></g>}
        </svg>
        {hot
          ? <Callout kind="stop"><b>Не открывать!</b> Антифриз горячий и под давлением. Подождите, пока мотор остынет (обычно 1–2 часа), уровень при этом опустится.</Callout>
          : <Callout kind="info">На холодном двигателе уровень между MIN и MAX. Крышку для проверки открывать не нужно — видно сквозь стенку.</Callout>}
      </div>
    </div>
  );
}

function BrakeTank() {
  const [wear, setWear] = useState(20);
  const level = 90 - wear * 0.35;
  return (
    <div className="panel">
      <span className="eyebrow">Почему уровень тормозной жидкости падает</span>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 14, marginTop: 8 }}>
        <svg viewBox="0 0 120 120" style={{ width: 100, flex: 'none' }}>
          <rect x="14" y="20" width="92" height="90" rx="10" fill="rgba(230,240,255,.1)" stroke="#c7d4e8" />
          <rect x="18" y={110 - level} width="84" height={level - 4} rx="7" fill="#d9c27a" opacity=".6" style={{ transition: 'all .3s' }} />
          <line x1="18" x2="40" y1="34" y2="34" stroke="#fff" /><line x1="18" x2="40" y1="74" y2="74" stroke="#fff" />
          <text x="44" y="37" className="mono" style={{ fontSize: 9, fill: '#fff' }}>MAX</text><text x="44" y="77" className="mono" style={{ fontSize: 9, fill: '#fff' }}>MIN</text>
        </svg>
        <div className="stack" style={{ flex: 1 }}>
          <Range id="pad-wear" label="Износ колодок" value={wear} min={0} max={100} onChange={setWear} fmt={(v) => `${v}%`} />
          <p className="muted" style={{ fontSize: 13 }}>Колодки стираются — поршни суппортов выдвигаются, и в них уходит часть жидкости. При замене колодок она вернётся в бачок, поэтому доливать «до MAX» на изношенных колодках не стоит.</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ f, ps, setPs }: { f: Fluid; ps: boolean; setPs: (v: boolean) => void }) {
  return (
    <motion.div key={f.id} className="stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="panel">
        <div className="fhead" style={{ color: f.color }}>
          <span className="ic"><CapIcon kind={f.cap} size={26} /></span>
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow" style={{ margin: 0 }}>{f.n} · значок на крышке</span>
            <h3 style={{ color: 'var(--ink)', fontSize: 19, margin: 0 }}>{f.title}</h3>
          </div>
        </div>
        <div style={{ margin: '10px 0' }}><SafetyTag level={f.safety} /></div>
        {f.warn && <Callout kind="stop">{f.warn}</Callout>}
        <h4>Где</h4><p className="muted">{f.where}</p>
        {f.id === 'ps' && (
          <div style={{ marginTop: 8 }}><Seg value={ps ? 'h' : 'e'} onChange={(v) => setPs(v === 'h')} options={[{ v: 'h', l: 'Гидроусилитель' }, { v: 'e', l: 'Электроусилитель' }]} /></div>
        )}
        {f.id === 'ps' && !ps ? (
          <Callout kind="info">У электроусилителя руля жидкости нет вообще — бачок на схеме пропал. Проверять нечего.</Callout>
        ) : (
          <>
            <h4>Как проверить</h4>
            <ol className="check">{f.check.map((c) => <li key={c}>{c}</li>)}</ol>
            <h4>Что лить</h4><p className="muted">{f.pour}</p>
            {f.note && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{f.note}</p>}
          </>
        )}
      </div>
      {f.id === 'oil' && <Dipstick />}
      {f.id === 'coolant' && <CoolantTank />}
      {f.id === 'brake' && <BrakeTank />}
    </motion.div>
  );
}

export function FluidsModule() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [ps, setPs] = useState(true);
  const f = FLUIDS.find((x) => x.id === sel);
  const list = FLUIDS.filter((x) => x.id !== 'ps' || ps || sel === 'ps');
  return (
    <>
      <ModHead title="Что куда лить" lead="Шесть жидкостей, шесть разных крышек. Откройте капот и нажмите на номер — покажем, где это, как проверить и что лить." />
      <div className="split wide-aside">
        <div className="stack">
          <Stage label={<>FIG. 20 — <b>Моторный отсек</b> · вид сверху, перед машины снизу</>}>
            <EngineBay open={open} sel={f?.at ?? null} ps={ps} dim={!!f} onSelect={(id) => { const x = FLUIDS.find((q) => q.at === id || q.id === id); if (x) setSel(x.id); }}
              markers={FLUIDS.filter((x) => x.id !== 'ps' || ps).map((x) => ({ id: x.id, x: POS[x.id][0], y: POS[x.id][1], color: x.color, n: x.n, label: x.title }))} />
            {!open && (
              <div className="open-hood"><div className="box">
                <span className="eyebrow">Шаг 0</span>
                <p className="muted" style={{ fontSize: 14 }}>Рычаг открывания капота обычно в салоне слева внизу. Потом нащупать защёлку под передним краем капота.</p>
                <button className="btn primary" onClick={() => setOpen(true)}>Открыть капот</button>
              </div></div>
            )}
          </Stage>
          <div className="chips">
            {list.map((x) => (
              <button key={x.id} className="chip" aria-pressed={sel === x.id} style={{ ['--c' as string]: x.color }} onClick={() => { setOpen(true); setSel(x.id); }}>
                <span className="n">{x.n}</span>{x.title}
              </button>
            ))}
            {open && <button className="chip" style={{ ['--c' as string]: '#6c7e9c' }} onClick={() => { setOpen(false); setSel(null); }}>Закрыть капот</button>}
          </div>
        </div>
        <div className="stack">
          <AnimatePresence mode="wait">
            {f ? <Detail key={f.id} f={f} ps={ps} setPs={setPs} /> : (
              <motion.div key="none" className="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="panel">
                  <h3>Главное правило</h3>
                  <p className="muted">Каждая жидкость — только в свой бачок и только той спецификации, что указана в руководстве. Перепутать омывайку с антифризом или долить не тот тип тормозной жидкости — реальные дорогие ошибки.</p>
                </div>
                <div className="panel">
                  <span className="eyebrow">Кто что может</span>
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="row"><SafetyTag level="diy" /><span className="muted" style={{ fontSize: 13.5 }}>масло (проверка/долив), омывайка, осмотр</span></div>
                    <div className="row"><SafetyTag level="care" /><span className="muted" style={{ fontSize: 13.5 }}>антифриз, тормозная жидкость, ГУР</span></div>
                    <div className="row"><SafetyTag level="pro" /><span className="muted" style={{ fontSize: 13.5 }}>масло коробки, замена тормозной жидкости, кондиционер</span></div>
                  </div>
                </div>
                <Callout kind="info">Расположение на схеме — типичное для переднеприводной машины. У вашей всё может стоять иначе: сверяйтесь с руководством.</Callout>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
