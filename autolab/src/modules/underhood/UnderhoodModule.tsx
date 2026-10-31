import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BAY } from '../../content/underhood';
import { go } from '../../lib/router';
import { Callout, ModHead, SafetyTag, Stage } from '../../ui/kit';
import { EngineBay } from './EngineBay';
import { HOTSPOT_RU, useVehicle } from '../../lib/vehicle';
import { MyCarBadge, SrcChip } from '../../ui/src';

export function UnderhoodModule() {
  const v = useVehicle();
  const hs = v?.interactive_underhood?.hotspots ?? [];
  // семантические id профиля → узлы типовой схемы
  const MAP: Record<string, string> = { engine_oil_filler: 'oil', engine_oil_dipstick: 'oil', ecu: 'ecu', battery: 'battery', engine_air_filter: 'air', radiator_filler: 'radiator', coolant_expansion_tank: 'coolant', alternator: 'alt' };
  const [open, setOpen] = useState(true);
  const [sel, setSel] = useState<string | null>('battery');
  const it = BAY.find((x) => x.id === sel || (sel === 'dipstick' && x.id === 'oil'));
  return (
    <>
      <ModHead title="Под капотом" lead="Что здесь находится? Нажмите на любой узел — расскажем, зачем он, когда проверять и можно ли обслужить самому." />
      {v && hs.length > 0 && (
        <MyCarBadge p={v}>
          По руководству по ремонту под капотом вашего {v.model}: {hs.length} узлов. <SrcChip p={v} path="interactive_underhood.hotspots" />
          <div className="chips" style={{ marginTop: 8 }}>
            {hs.map((h) => {
              const id = MAP[h.id];
              return <button key={h.id} className="chip" disabled={!id} aria-pressed={!!id && it?.id === id} style={{ ['--c' as string]: id ? '#36e0a0' : '#3a4b6c', minHeight: 32, opacity: id ? 1 : 0.6 }} onClick={() => { if (id) { setOpen(true); setSel(id); } }}>{h.reference_index}. {HOTSPOT_RU[h.id] ?? h.label}</button>;
            })}
          </div>
          <span style={{ fontSize: 12.5 }}>Координат в профиле нет — узлы показаны в типовых местах схемы. Серые есть в профиле, но не нарисованы на схеме.</span>
        </MyCarBadge>
      )}
      <div className="split wide-aside">
        <div className="stack">
          <Stage label={<>FIG. 21 — <b>Что здесь находится</b> · типичная компоновка</>}>
            <EngineBay open={open} sel={it?.id ?? null} onSelect={setSel} dim={!!it} markers={BAY.map((b) => ({ id: b.id, x: b.x, y: b.y, color: b.color, label: b.title }))} />
            <div className="stage-ctl"><button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Закрыть капот' : 'Открыть капот'}</button></div>
          </Stage>
          <div className="chips">
            {BAY.map((b) => (
              <button key={b.id} className="chip" aria-pressed={it?.id === b.id} style={{ ['--c' as string]: b.color }} onClick={() => { setOpen(true); setSel(b.id); }}>{b.title}</button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {it && (
            <motion.div key={it.id} className="stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="panel">
                <span className="eyebrow" style={{ color: it.color }}>Узел</span>
                <h3 style={{ fontSize: 20 }}>{it.title}</h3>
                <div className="cardgrid">
                  <div><h4>Что это</h4><p>{it.what}</p></div>
                  <div><h4>Зачем нужно</h4><p>{it.why}</p></div>
                  <div><h4>Когда проверять</h4><p>{it.when}</p></div>
                  <div><h4>Типичные неисправности</h4><p>{it.faults}</p></div>
                </div>
              </div>
              <div className="panel">
                <span className="eyebrow">Можно ли самому</span>
                <SafetyTag level={it.diy} />
                <p className="muted" style={{ marginTop: 8 }}>{it.diyNote}</p>
              </div>
              {['oil', 'coolant', 'brake', 'washer'].includes(it.id) && <button className="btn primary" onClick={() => go('fluids')}>Как проверить и что лить →</button>}
              {it.id === 'battery' && <button className="btn primary" onClick={() => go('electrics')}>Схема: АКБ → стартер → генератор →</button>}
              {it.id === 'radiator' && <button className="btn primary" onClick={() => go('engine', 'cooling')}>Путь антифриза →</button>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Callout kind="info">Схема показывает типичную компоновку. Расположение узлов у вашей машины может отличаться — точное место в руководстве по эксплуатации.</Callout>
    </>
  );
}
