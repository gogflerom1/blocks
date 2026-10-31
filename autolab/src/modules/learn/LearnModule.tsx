import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LESSONS, Lesson } from '../../content/lessons';
import { BAY } from '../../content/underhood';
import { ITEMS } from '../../content/maintenance';
import { gearPath, store, useTicker } from '../../lib/anim';
import { useInfo } from '../../lib/info';
import { go } from '../../lib/router';
import { Callout, ModHead, Range, SafetyTag, Stage } from '../../ui/kit';
import { Ico } from '../../ui/icons';
import { Cylinder } from '../engine/Cylinder';
import { StrokeBar, usePlayback } from '../engine/FourStroke';
import { Drive } from '../transmission/Drive';
import { Hydraulics } from '../brakes/BrakesModule';
import { EngineBay } from '../underhood/EngineBay';

function MiniEngine() {
  const pb = usePlayback(10, 150);
  return (
    <div className="stack">
      <Stage label={<>Разрез цилиндра</>}><Cylinder theta={pb.theta} fuel="petrol" time={pb.time} labels={false} idPrefix="lesson" /></Stage>
      <StrokeBar theta={pb.theta} fuel="petrol" onJump={(d) => { pb.set(d); pb.setPlaying(false); }} />
      <div className="row">
        <button className="btn sm" onClick={() => pb.setPlaying(!pb.playing)}>{pb.playing ? <Ico.pause width={16} /> : <Ico.play width={16} />}{pb.playing ? 'Пауза' : 'Пуск'}</button>
      </div>
    </div>
  );
}

/** Две шестерни: меняем число зубьев — видим, как меняются обороты и сила */
function GearRatioDemo() {
  const [z1, setZ1] = useState(12);
  const [z2, setZ2] = useState(36);
  const [a, setA] = useState(0);
  useTicker((dt) => setA((x) => x + dt * 1.4));
  const m = 4, r1 = (m * z1) / 2, r2 = (m * z2) / 2;
  const c1 = 60 + r1, c2 = c1 + r1 + r2;
  const i = z2 / z1;
  return (
    <div className="stack">
      <Stage label={<>Ведущая → ведомая</>}>
        <svg viewBox={`0 0 ${c2 + r2 + 60} ${Math.max(r1, r2) * 2 + 60}`} className="fig" style={{ maxHeight: 340 }}>
          {(() => {
            const cy = Math.max(r1, r2) + 30;
            return (
              <>
                <path d={gearPath(c1, cy, r1 - 3, z1, 6, a)} fill="#2a1a14" stroke="#ff8a4c" strokeWidth={2} />
                <line x1={c1} y1={cy} x2={c1 + (r1 - 8) * Math.cos(a)} y2={cy + (r1 - 8) * Math.sin(a)} stroke="#ff8a4c" strokeWidth={3} />
                <path d={gearPath(c2, cy, r2 - 3, z2, 6, -a / i + Math.PI / z2)} fill="#13283f" stroke="#36e0a0" strokeWidth={2} />
                <line x1={c2} y1={cy} x2={c2 + (r2 - 8) * Math.cos(-a / i)} y2={cy + (r2 - 8) * Math.sin(-a / i)} stroke="#36e0a0" strokeWidth={3} />
                <text x={c1} y={cy + r1 + 22} textAnchor="middle" className="svg-label" style={{ fill: '#ff8a4c' }}>от мотора · {z1} зуб.</text>
                <text x={c2} y={cy + r2 + 22} textAnchor="middle" className="svg-label" style={{ fill: '#36e0a0' }}>к колёсам · {z2} зуб.</text>
              </>
            );
          })()}
        </svg>
      </Stage>
      <div className="panel stack">
        <Range id="z1" label="Зубьев на ведущей" value={z1} min={8} max={30} onChange={setZ1} />
        <Range id="z2" label="Зубьев на ведомой" value={z2} min={8} max={40} onChange={setZ2} />
        <p><b className="mono">{i.toFixed(2)} : 1</b> <span className="muted">— ведомая крутится в {i.toFixed(1)} раза {i >= 1 ? 'медленнее, но с силой' : 'быстрее, но слабее'} × {i.toFixed(1)}</span></p>
      </div>
    </div>
  );
}

function MiniBay() {
  const info = useInfo();
  const [sel, setSel] = useState<string | null>(null);
  const pick = BAY.filter((b) => ['battery', 'oil', 'coolant', 'brake', 'washer', 'air'].includes(b.id));
  return (
    <Stage label={<>Под капотом · нажмите на метку</>}>
      <EngineBay open sel={sel} dim={!!sel} markers={pick.map((b) => ({ id: b.id, x: b.x, y: b.y, color: b.color, label: b.title }))}
        onSelect={(id) => { const b = BAY.find((x) => x.id === id); if (!b) return; setSel(id); info.show({ id, title: b.title, text: `${b.what}\n${b.why}`, safety: b.diy, color: b.color, kicker: 'Под капотом' }); }} />
    </Stage>
  );
}

function MiniService() {
  return (
    <div className="panel">
      <div className="stack" style={{ gap: 8 }}>
        {ITEMS.filter((x) => ['oil', 'air', 'pads', 'bfluid', 'coolant', 'timing', 'battery'].includes(x.id)).map((x) => (
          <div key={x.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 14 }}>{x.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{x.range}</div></div>
            <SafetyTag level={x.diy} />
          </div>
        ))}
      </div>
    </div>
  );
}

const VISUAL: Record<string, () => JSX.Element> = { engine: MiniEngine, drive: Drive, gears: GearRatioDemo, brakes: Hydraulics, bay: MiniBay, service: MiniService };

type Progress = Record<number, number>; // id урока → правильных ответов

function Quiz({ lesson, onDone }: { lesson: Lesson; onDone: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = lesson.quiz[i];
  if (!q) return null;
  const answer = (k: number) => { if (pick !== null) return; setPick(k); if (k === q.ok) setScore((s) => s + 1); };
  const next = () => { if (i + 1 >= lesson.quiz.length) { onDone(score); return; } setI(i + 1); setPick(null); };
  return (
    <motion.div key={i} className="panel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
      <span className="eyebrow">Тест · вопрос {i + 1} из {lesson.quiz.length}</span>
      <h3 style={{ fontSize: 18 }}>{q.q}</h3>
      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        {q.a.map((a, k) => (
          <button key={a} className={`btn quiz-opt${pick !== null && k === q.ok ? ' right' : ''}${pick === k && k !== q.ok ? ' wrong' : ''}`} onClick={() => answer(k)}>{a}</button>
        ))}
      </div>
      {pick !== null && (
        <div className="stack" style={{ marginTop: 12 }}>
          <Callout kind={pick === q.ok ? 'info' : 'warn'}><b>{pick === q.ok ? 'Верно.' : 'Не совсем.'}</b> {q.why}</Callout>
          <button className="btn primary" onClick={next}>{i + 1 >= lesson.quiz.length ? 'Завершить урок' : 'Дальше'}</button>
        </div>
      )}
    </motion.div>
  );
}

export function LearnModule({ sub }: { sub: string }) {
  const [progress, setProgress] = useState<Progress>(() => store.get<Progress>('learn', {}));
  const lessonId = Number(sub) || 0;
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const [slide, setSlide] = useState(0);
  const [phase, setPhase] = useState<'slides' | 'quiz' | 'done'>('slides');
  const [last, setLast] = useState(0);
  useEffect(() => { setSlide(0); setPhase('slides'); }, [lessonId]);
  const open = (id: number) => { setSlide(0); setPhase('slides'); go('learn', String(id)); };
  const done = Object.keys(progress).length;

  if (!lesson) {
    return (
      <>
        <ModHead title="Режим «Новичок»" lead="Шесть коротких уроков — от «что заставляет машину ехать» до «что обслуживать». В каждом — живая схема и тест на 3 вопроса." />
        <div className="meter" style={{ maxWidth: 420, marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span>Пройдено</span><b className="mono">{done} / {LESSONS.length}</b></div>
          <div className="bar"><i style={{ width: `${(done / LESSONS.length) * 100}%`, background: 'var(--green)' }} /></div>
        </div>
        <div className="path-map">
          {LESSONS.map((l, i) => (
            <motion.button key={l.id} className={`lesson-card${progress[l.id] !== undefined ? ' done' : ''}`} onClick={() => open(l.id)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <span className="num">{String(l.id).padStart(2, '0')}</span>
              <span className="eyebrow">Урок {l.id} · {l.sub}</span>
              <b style={{ fontSize: 16 }}>{l.title}</b>
              <span className="muted" style={{ fontSize: 13 }}>{progress[l.id] !== undefined ? `Тест: ${progress[l.id]} из ${l.quiz.length} ✓` : `${l.slides.length} шага + тест`}</span>
            </motion.button>
          ))}
        </div>
        {done > 0 && <button className="btn sm" style={{ marginTop: 16 }} onClick={() => { store.set('learn', {}); setProgress({}); }}>Сбросить прогресс</button>}
      </>
    );
  }

  const sl = lesson.slides[Math.min(slide, lesson.slides.length - 1)];
  const V = VISUAL[sl.visual];
  const finish = (score: number) => {
    const p = { ...progress, [lesson.id]: Math.max(score, progress[lesson.id] ?? 0) };
    setProgress(p); store.set('learn', p); setLast(score); setPhase('done');
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => go('learn')}><Ico.back width={16} />Все уроки</button>
        <span className="eyebrow" style={{ margin: 0 }}>Урок {lesson.id} из {LESSONS.length}</span>
      </div>
      <ModHead title={lesson.title} />
      <AnimatePresence mode="wait">
        {phase === 'slides' && (
          <motion.div key={'s' + slide} className="split wide-aside" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <div style={{ minWidth: 0 }}><V /></div>
            <div className="stack">
              <div className="panel">
                <div className="dots" style={{ marginBottom: 10 }}>{lesson.slides.map((_, k) => <i key={k} className={k === slide ? 'on' : ''} />)}</div>
                <h3 style={{ fontSize: 20 }}>{sl.title}</h3>
                <p className="muted" style={{ fontSize: 15 }}>{sl.text}</p>
              </div>
              <div className="row">
                {slide > 0 && <button className="btn" onClick={() => setSlide(slide - 1)}>Назад</button>}
                {slide < lesson.slides.length - 1
                  ? <button className="btn primary" onClick={() => setSlide(slide + 1)}>Дальше<Ico.arrow width={18} /></button>
                  : <button className="btn primary" onClick={() => setPhase('quiz')}>К тесту<Ico.arrow width={18} /></button>}
              </div>
            </div>
          </motion.div>
        )}
        {phase === 'quiz' && <div key="q" style={{ maxWidth: 640 }}><Quiz lesson={lesson} onDone={finish} /></div>}
        {phase === 'done' && (
          <motion.div key="d" className="panel" style={{ maxWidth: 560 }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Урок пройден</span>
            <div className="big-num" style={{ margin: '8px 0', color: last === lesson.quiz.length ? 'var(--green)' : 'var(--amber)' }}>{last} / {lesson.quiz.length}</div>
            <p className="muted">{last === lesson.quiz.length ? 'Без ошибок.' : 'Можно пройти ещё раз — объяснения уже знаете.'}</p>
            <div className="row" style={{ marginTop: 12 }}>
              {LESSONS.find((l) => l.id === lesson.id + 1) ? <button className="btn primary" onClick={() => open(lesson.id + 1)}>Следующий урок<Ico.arrow width={18} /></button> : <button className="btn primary" onClick={() => go('free')}>В свободный режим<Ico.arrow width={18} /></button>}
              <button className="btn" onClick={() => { setSlide(0); setPhase('slides'); }}>Повторить</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
