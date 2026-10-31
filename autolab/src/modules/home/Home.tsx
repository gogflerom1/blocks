import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Vector3 } from 'three';
import { CarScene } from './CarScene';
import { LAYERS, LayerId, SYSTEMS, SystemId } from '../../content/systems';
import { MAIN_MENU, MODULES } from '../../content/nav';
import { go } from '../../lib/router';
import { ru, useVehicle } from '../../lib/vehicle';
import { Ico } from '../../ui/icons';

export function useCarScene(opts: { autoRotate?: boolean; body?: string } = {}) {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<CarScene | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let s: CarScene | null = null;
    try { s = new CarScene(host.current, opts); setScene(s); } catch (e) { console.warn('WebGL недоступен', e); }
    return () => { s?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.body]);
  return { host, scene };
}

export function Home() {
  const v = useVehicle();
  const { host, scene } = useCarScene({ autoRotate: true, body: v?.vehicle.body as string | undefined });
  const dots = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [sel, setSel] = useState<SystemId | null>(null);
  const [explode, setExplode] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(() => Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<LayerId, boolean>);
  const [hover, setHover] = useState<LayerId | null>(null);

  useEffect(() => {
    if (!scene) return;
    let n = 0;
    scene.onFrame = () => {
      // подписи не должны налезать друг на друга: прячем ту, что перекрывается (остаётся точка)
      const placed: [number, number, number, number][] = [];
      const update = n++ % 3 === 0;
      const items = SYSTEMS.map((s) => ({ s, p: scene.project(s.anchor, s.normal) })).sort((a, b) => b.p.vis - a.p.vis);
      for (const { s, p } of items) {
        const el = dots.current.get(s.id);
        if (!el) continue;
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        el.style.opacity = p.behind ? '0' : String(p.vis);
        if (!update) continue;
        const w = (el.dataset.w ? +el.dataset.w : (el.dataset.w = String(el.offsetWidth), el.offsetWidth));
        const r: [number, number, number, number] = [p.x - 14, p.y - 13, p.x - 14 + w, p.y + 13];
        const hit = p.vis < 1 || placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        el.classList.toggle('nolbl', hit && sel !== s.id);
        if (!hit) placed.push(r);
      }
    };
    scene.onPick = (id) => {
      if (!id) return;
      const s = SYSTEMS.find((x) => x.layer === id && (id !== 'electrics' || x.id === 'electrics')) ?? SYSTEMS.find((x) => x.layer === id);
      if (s) select(s.id);
    };
    scene.onHover = setHover;
  });

  const select = (id: SystemId | null) => {
    setSel(id);
    if (!scene) return;
    if (!id) { scene.focus(null); return; }
    const s = SYSTEMS.find((x) => x.id === id)!;
    scene.focus(s.layer ?? null, s.anchor);
  };

  const toggleExplode = () => {
    const v = !explode;
    setExplode(v);
    setSel(null);
    scene?.highlight(null);
    scene?.setHood(false);
    scene?.setExplode(v);
    scene?.flyTo(v ? new Vector3(6.2, 6.4, -9.6) : new Vector3(4.7, 2.2, -4.6), new Vector3(v ? -0.3 : 0, v ? 0.8 : 0.55, 0));
    if (v) setLayersOpen(true);
  };

  const toggleLayer = (id: LayerId) => {
    const v = !layers[id];
    setLayers({ ...layers, [id]: v });
    scene?.setLayer(id, v);
  };

  const cur = SYSTEMS.find((s) => s.id === sel);
  const hoverTitle = hover && LAYERS.find((l) => l.id === hover)?.title;

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-stage stage">
          <div ref={host} className="scene-host" />
          <div className="stage-label">FIG. 01 — <b>{v ? `${v.make} ${v.model} ${v.generation ?? ''}` : 'Автомобиль в разрезе'}</b><span className="hide-sm"> · {v ? `${ru(v.vehicle.body as string)}, ${v.powertrain.engine?.code ?? ''} ${v.powertrain.engine?.family ?? ''}, ${v.powertrain.transmission?.gears ?? ''}AT · модель условная` : 'передний привод, бензин 1.6'}</span></div>
          {!scene && (
            <div className="overlay-msg"><div className="box"><h2>3D недоступно</h2><p className="muted">Браузер не дал WebGL. Все разделы работают — выберите в меню.</p></div></div>
          )}
          {/* точки-узлы */}
          <div className="hotspots" aria-label="Узлы автомобиля" style={{ opacity: explode ? 0 : 1, pointerEvents: explode ? 'none' : undefined }}>
            {SYSTEMS.map((s) => (
              <button
                key={s.id}
                ref={(el) => { if (el) dots.current.set(s.id, el); }}
                className={`hs${sel === s.id ? ' on' : ''}`}
                style={{ ['--c' as string]: s.color }}
                onClick={() => select(sel === s.id ? null : s.id)}
                aria-pressed={sel === s.id}
              >
                <i className="hs-dot" /><span className="hs-lbl">{s.title}</span>
              </button>
            ))}
          </div>
          {hoverTitle && !sel && <div className="hover-tip mono">{hoverTitle} · нажмите</div>}

          <div className="hero-tools">
            <button className={`btn sm${explode ? ' on' : ''}`} onClick={toggleExplode}><Ico.explode width={18} />{explode ? 'Собрать' : 'Разобрать машину'}</button>
            <button className={`btn sm${layersOpen ? ' on' : ''}`} onClick={() => setLayersOpen(!layersOpen)}><Ico.layers width={18} />Слои</button>
            {(sel || explode) && <button className="btn sm" onClick={() => { if (explode) toggleExplode(); select(null); }}><Ico.reset width={18} />Сброс</button>}
          </div>

          <AnimatePresence>
            {layersOpen && (
              <motion.div className="layers" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
                <span className="eyebrow">Слои · снимите кузов</span>
                {LAYERS.map((l) => (
                  <button key={l.id} className="layer-row" aria-pressed={layers[l.id]} onClick={() => toggleLayer(l.id)} style={{ ['--c' as string]: l.color }}>
                    <span className="chk">{layers[l.id] && <Ico.check width={14} height={14} />}</span>{l.title}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {cur && (
              <motion.div key={cur.id} className="sys-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                <span className="eyebrow" style={{ color: cur.color }}>Система</span>
                <h3>{cur.title}</h3>
                <p>{cur.lead}</p>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => go(cur.link[0], cur.link[1])}>{cur.linkLabel}<Ico.arrow width={18} /></button>
                  <button className="btn" onClick={() => select(null)}>Назад</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="drag-hint mono">⟲ тяните, чтобы вращать · щипок — зум</div>
        </div>

        <nav className="hero-menu" aria-label="Изучить автомобиль">
          <div className="hero-title">
            <span className="eyebrow">Интерактивный техмузей</span>
            <h1>Изучить <br />автомобиль</h1>
            <p className="muted">Нажмите на любую точку на машине или выберите систему. Всё двигается, всё можно трогать.</p>
          </div>
          <div className="menu-grid">
            {MAIN_MENU.map((id, i) => {
              const m = MODULES.find((x) => x.id === id)!;
              const I = Ico[m.icon];
              return (
                <motion.button key={id} className="tile" onClick={() => go(id)}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.035, type: 'spring', stiffness: 300, damping: 28 }}
                  onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); }}>
                  <span className="ti"><I /></span>
                  <span style={{ minWidth: 0 }}><span className="tt" style={{ display: 'block' }}>{m.title}</span><span className="ts" style={{ display: 'block' }}>{m.sub}</span></span>
                  <Ico.arrow className="arrow" width={18} />
                </motion.button>
              );
            })}
          </div>
        </nav>
      </section>

      <section className="more">
        <span className="eyebrow">Ещё разделы</span>
        <div className="more-row">
          {MODULES.filter((m) => !MAIN_MENU.includes(m.id)).map((m) => {
            const I = Ico[m.icon];
            return <button key={m.id} className="btn" onClick={() => go(m.id)}><I width={18} />{m.title}</button>;
          })}
        </div>
      </section>
    </div>
  );
}
