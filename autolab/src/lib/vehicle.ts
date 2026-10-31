import { useEffect, useState } from 'react';
import { store } from './anim';

/*
  Профиль конкретной машины. Данные не выдумываются — загружаются из файла, составленного по руководству.
  Пустое поле = «нет данных», приложение показывает общую информацию.
*/
export type VehicleProfile = {
  id: string; make: string; model: string; year: number; engine: string; gearbox: string;
  sources: { title: string; url?: string; page?: string }[];
  fluids?: Partial<Record<'engineOil' | 'coolant' | 'brakeFluid' | 'atf' | 'mtf' | 'psf', { spec: string; capacityL?: number }>>;
  maintenance?: Partial<Record<string, { km?: number; years?: number; note?: string }>>;
  timing?: 'belt' | 'chain';
  layoutNotes?: string[];
  fuses?: { location: string; note?: string }[];
};

export const PROFILE_TEMPLATE: VehicleProfile = {
  id: 'make-model-year-engine', make: '', model: '', year: 0, engine: '', gearbox: '',
  sources: [{ title: 'Руководство по эксплуатации', page: '' }],
  fluids: { engineOil: { spec: '', capacityL: undefined }, coolant: { spec: '' }, brakeFluid: { spec: '' } },
  maintenance: { oil: { km: undefined, years: undefined }, bfluid: { years: undefined } },
  timing: undefined, layoutNotes: [], fuses: [],
};

export function validateProfile(x: unknown): string | null {
  const p = x as VehicleProfile;
  if (!p || typeof p !== 'object') return 'Это не JSON-объект';
  for (const k of ['id', 'make', 'model', 'engine', 'gearbox'] as const) if (typeof p[k] !== 'string' || !p[k]) return `Не заполнено поле «${k}»`;
  if (typeof p.year !== 'number' || p.year < 1950) return 'Поле «year» должно быть годом выпуска';
  if (!Array.isArray(p.sources) || !p.sources.length || !p.sources.every((s) => s && s.title)) return 'Нужен хотя бы один источник данных в «sources» — без него профиль не принимается';
  return null;
}

const KEY = 'vehicle';
let listeners: ((v: VehicleProfile | null) => void)[] = [];
export function setVehicle(v: VehicleProfile | null) { store.set(KEY, v); listeners.forEach((l) => l(v)); }
export function useVehicle() {
  const [v, setV] = useState<VehicleProfile | null>(() => store.get<VehicleProfile | null>(KEY, null));
  useEffect(() => { listeners.push(setV); return () => { listeners = listeners.filter((l) => l !== setV); }; }, []);
  return v;
}
