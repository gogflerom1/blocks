import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Leaf, Q, SCENARIOS, isLeaf } from '../../content/diagnostics';
import { Callout, ModHead } from '../../ui/kit';
import { Ico } from '../../ui/icons';

const URG = { r: ['Опасно — остановиться / сервис', 'r'], y: ['Проверить в ближайшее время', 'y'], g: ['Не страшно', 'g'] } as const;

/** Мини-карта дерева: показывает, где мы в нём */
function TreeMap({ tree, path }: { tree: Q; path: number[] }) {
  const nodes: { x: number; y: number; on: boolean; leaf: boolean; urg?: string }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number; on: boolean }[] = [];
  let leaves = 0;
  const walk = (n: Q | Leaf, depth: number, on: boolean): number => {
    const x = depth * 90 + 12;
    if (isLeaf(n)) { const y = leaves++ * 22 + 12; nodes.push({ x, y, on, leaf: true, urg: n.urgency }); return y; }
    const kids = n.opts.map((o, i) => { const con = on && path[depth] === i; return { y: walk(o.next, depth + 1, con), on: con }; });
    const y = (Math.min(...kids.map((k) => k.y)) + Math.max(...kids.map((k) => k.y))) / 2;
    kids.forEach((k) => edges.push({ x1: x, y1: y, x2: x + 90, y2: k.y, on: k.on }));
    nodes.push({ x, y, on, leaf: false });
    return y;
  };
  walk(tree, 0, true);
  const H = leaves * 22 + 4, W = Math.max(...nodes.map((n) => n.x)) + 24;
  const urgC = (u?: string) => (u === 'r' ? '#ff4b5c' : u === 'y' ? '#ffb547' : '#36e0a0');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 260, display: 'block' }} aria-hidden="true">
      {edges.map((e, i) => <path key={i} d={`M${e.x1},${e.y1} C${e.x1 + 45},${e.y1} ${e.x2 - 45},${e.y2} ${e.x2},${e.y2}`} fill="none" stroke={e.on ? '#3de2ff' : 'rgba(130,175,255,.18)'} strokeWidth={e.on ? 2.2 : 1.2} />)}
      {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.leaf ? 5 : 6} fill={n.leaf ? urgC(n.urg) : n.on ? '#3de2ff' : '#1c2a44'} opacity={n.leaf && !n.on ? 0.35 : 1} stroke={n.on ? '#fff' : 'none'} strokeWidth={1} />)}
    </svg>
  );
}

export function DiagnosticsModule() {
  const [sid, setSid] = useState<string | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const sc = SCENARIOS.find((s) => s.id === sid);
  let node: Q | Leaf | null = sc ? sc.tree : null;
  const trail: { q: string; a: string }[] = [];
  for (const i of path) { if (!node || isLeaf(node)) break; trail.push({ q: node.q, a: node.opts[i].label }); node = node.opts[i].next; }
  return (
    <>
      <ModHead title="Что случилось с машиной?" lead="Выберите симптом и отвечайте на вопросы. В конце — вероятные причины, что проверить самому и где самостоятельная диагностика заканчивается." />
      {!sc ? (
        <div className="cmp-cards">
          {SCENARIOS.map((s, i) => (
            <motion.button key={s.id} className="bx" onClick={() => { setSid(s.id); setPath([]); }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <span className="eyebrow">Симптом {String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.tree.q}</p>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="split wide-aside">
          <div className="stack">
            <div className="row">
              <button className="btn sm" onClick={() => setSid(null)}><Ico.back width={16} />Все симптомы</button>
              {path.length > 0 && <button className="btn sm" onClick={() => setPath(path.slice(0, -1))}>Шаг назад</button>}
            </div>
            <h2 style={{ fontSize: 22 }}>{sc.title}</h2>
            {trail.map((t, i) => (
              <div key={i} className="trail"><span className="muted">{t.q}</span><b>→ {t.a}</b></div>
            ))}
            <AnimatePresence mode="wait">
              {node && !isLeaf(node) && (
                <motion.div key={path.join('-')} className="panel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                  <span className="eyebrow">Вопрос {path.length + 1}</span>
                  <h3 style={{ fontSize: 18 }}>{node.q}</h3>
                  <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                    {node.opts.map((o, i) => (
                      <button key={o.label} className="btn" style={{ justifyContent: 'space-between', textAlign: 'left', minHeight: 52 }} onClick={() => setPath([...path, i])}>
                        <span>{o.label}{o.hint && <small className="muted" style={{ display: 'block', fontWeight: 400 }}>{o.hint}</small>}</span><Ico.arrow width={18} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {node && isLeaf(node) && (
                <motion.div key="leaf" className="stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="panel">
                    <span className={`tag ${URG[node.urgency][1]}`}><i className="dot" />{URG[node.urgency][0]}</span>
                    <h3 style={{ fontSize: 20, marginTop: 10 }}>{node.title}</h3>
                    <div className="grid2" style={{ marginTop: 6 }}>
                      <div><h4>Вероятные причины</h4><ul>{node.causes.map((c) => <li key={c}>{c}</li>)}</ul></div>
                      <div><h4 style={{ color: 'var(--green)' }}>Можно проверить самому</h4><ul>{node.diy.map((c) => <li key={c}>{c}</li>)}</ul></div>
                    </div>
                  </div>
                  <Callout kind="stop"><b>Граница:</b> {node.stop}</Callout>
                  <button className="btn" onClick={() => setPath([])}>Начать заново</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="panel">
            <span className="eyebrow">Дерево возможных причин</span>
            <TreeMap tree={sc.tree} path={path} />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Каждая точка справа — вывод. Цвет — срочность.</p>
          </div>
        </div>
      )}
      <p className="footer-note">Это подсказки для ориентации, а не диагноз. Любая проблема с тормозами, рулём или красной лампой на приборке — повод не ехать дальше и обратиться в сервис.</p>
    </>
  );
}
