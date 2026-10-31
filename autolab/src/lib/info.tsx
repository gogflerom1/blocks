import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ico } from '../ui/icons';
import { Safety, SafetyTag } from '../ui/kit';

// Единая карточка «что это за деталь» — всплывает по нажатию на любую часть схемы
export type Info = { id?: string; title: string; kicker?: string; body?: ReactNode; text?: string; safety?: Safety; color?: string };
type Ctx = { info: Info | null; show: (i: Info | null) => void };
const InfoCtx = createContext<Ctx>({ info: null, show: () => {} });

export function InfoProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<Info | null>(null);
  const show = useCallback((i: Info | null) => setInfo(i), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInfo(null);
    const onHash = () => setInfo(null);
    addEventListener('keydown', onKey);
    addEventListener('hashchange', onHash);
    return () => { removeEventListener('keydown', onKey); removeEventListener('hashchange', onHash); };
  }, []);
  return (
    <InfoCtx.Provider value={{ info, show }}>
      {children}
      <AnimatePresence>
        {info && (
          <motion.aside
            key={info.id ?? info.title}
            className="sheet"
            role="dialog"
            aria-label={info.title}
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <button className="iconbtn close" aria-label="Закрыть" onClick={() => setInfo(null)}><Ico.close /></button>
            {info.kicker && <span className="eyebrow" style={{ color: info.color }}>{info.kicker}</span>}
            <h3>{info.title}</h3>
            {info.safety && <div style={{ margin: '0 0 10px' }}><SafetyTag level={info.safety} /></div>}
            {info.text && info.text.split('\n').map((t, i) => <p key={i}>{t}</p>)}
            {info.body}
          </motion.aside>
        )}
      </AnimatePresence>
    </InfoCtx.Provider>
  );
}

export const useInfo = () => useContext(InfoCtx);
