import { useEffect, useState } from 'react';

// Хеш-роутинг: #engine, #engine-turbo (модуль-вкладка). Только ASCII и дефисы — так ссылки работают и в Artifact.
export type Route = { mod: string; sub: string };

function parse(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (!h) return { mod: 'home', sub: '' };
  const i = h.indexOf('-');
  return i < 0 ? { mod: h, sub: '' } : { mod: h.slice(0, i), sub: h.slice(i + 1) };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(mod: string, sub = '') {
  const h = mod === 'home' ? '' : sub ? `${mod}-${sub}` : mod;
  if (location.hash.replace('#', '') === h) return;
  location.hash = h;
  if (!h) history.replaceState(null, '', location.pathname + location.search);
  if (!h) dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Вкладка модуля, синхронизированная с хешем */
export function useSubTab<T extends string>(mod: string, tabs: readonly T[], sub: string): [T, (t: T) => void] {
  const cur = (tabs.includes(sub as T) ? sub : tabs[0]) as T;
  return [cur, (t: T) => go(mod, t === tabs[0] ? '' : t)];
}
