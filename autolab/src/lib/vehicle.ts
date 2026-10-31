import { useEffect, useState } from 'react';
import { store } from './anim';
import solaris from '../content/vehicles/hyundai_solaris_hcr_2018_1.4_6at.json';

/*
  Профиль конкретной машины — формат «Interactive Vehicle Profile» (vehicle-profile.schema.json).
  Правила: у каждого показанного технического поля есть источник (field_sources),
  неизвестное значение = null и показывается как «Нет подтверждённых данных».
*/
export type Source = { id: string; type: string; title: string; url: string; pdf_url?: string; publisher?: string };
type Num = number | null | undefined;
export type Interval = {
  id: string; name: string; action: string; condition?: string; additional_check?: string;
  every_km?: number; every_months?: number; inspect_km?: number[]; replace_km?: number[]; at_km?: number[];
  first_km?: number; first_months?: number; then_every_km?: number; then_every_months?: number;
};
export type Profile = {
  profile_version: string; id: string; title: string; locale?: string; market?: string;
  make: string; model: string; year: number; generation?: string;
  vehicle: { body?: string; drive?: string; transmission_summary?: string; engine_summary?: string; [k: string]: unknown };
  powertrain: {
    engine?: {
      family?: string; code?: string; fuel?: string; layout?: string; displacement_cc?: Num; bore_mm?: Num; stroke_mm?: Num;
      compression_ratio?: Num; cylinders?: Num; valves_per_cylinder?: Num; valvetrain?: string; timing_drive?: string; firing_order?: string;
      power_kw?: Num; power_hp?: Num; power_rpm?: Num; torque_nm?: Num; torque_rpm?: Num; fuel_min_octane_ron?: Num; emissions_standard?: string;
      engine_oil?: { system_capacity_l?: Num; service_fill_l?: Num; quality?: string | null; viscosity_by_temperature?: { ambient: string; sae: string[] }[]; oil_filter_part_number?: string | null };
    };
    transmission?: { type?: string; gears?: Num; model?: string | null; selector_positions?: string[]; atf_spec?: string | null; capacity_l?: Num; capacity_note?: string };
  };
  chassis?: { front_suspension?: string; rear_suspension?: string; steering?: string; brakes?: { abs?: boolean; esc?: boolean; tcs?: boolean; ebd?: boolean; note?: string } };
  fuel_system?: { tank_capacity_l?: Num; pump?: string; return_system?: string };
  maintenance?: { normal_schedule_basis?: string; intervals?: Interval[] };
  interactive_underhood?: { note?: string; hotspots?: { id: string; label: string; reference_index?: number; model_anchor?: unknown }[] };
  safety_rules?: { id: string; severity: string; text: string }[];
  source_policy?: { rule?: string };
  sources: Source[];
  field_sources: Record<string, string[]>;
  last_verified?: string;
};

export const BUILTIN: { id: string; title: string; note: string; data: Profile }[] = [
  { id: (solaris as Profile).id, title: (solaris as Profile).title, note: 'Профиль-пакет v1.1, проверен 31.10.2026', data: solaris as Profile },
];

/** Источники поля: ищем самый длинный совпадающий префикс пути в field_sources */
export function sourcesFor(p: Profile, path: string): Source[] {
  let key = path;
  while (key) {
    const ids = p.field_sources[key];
    if (ids) return ids.map((id) => p.sources.find((s) => s.id === id)).filter(Boolean) as Source[];
    const i = key.lastIndexOf('.');
    key = i > 0 ? key.slice(0, i) : '';
  }
  return [];
}

export function validateProfile(x: unknown): string | null {
  const p = x as Profile;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Это не JSON-объект профиля';
  for (const k of ['profile_version', 'id', 'title', 'make', 'model'] as const) if (typeof p[k] !== 'string' || !p[k]) return `Не заполнено поле «${k}»`;
  if (typeof p.year !== 'number') return 'Поле «year» должно быть числом (год выпуска)';
  if (!p.vehicle || typeof p.vehicle !== 'object') return 'Нет блока «vehicle»';
  if (!p.powertrain || typeof p.powertrain !== 'object') return 'Нет блока «powertrain»';
  if (!Array.isArray(p.sources) || !p.sources.length) return 'Нужен хотя бы один источник в «sources» — без него профиль не принимается';
  for (const s of p.sources) if (!s || !s.id || !s.type || !s.title || !s.url) return `У источника «${s?.id ?? '?'}» нет id, type, title или url`;
  if (!p.field_sources || typeof p.field_sources !== 'object') return 'Нет блока «field_sources»: непонятно, откуда какие данные';
  const ids = new Set(p.sources.map((s) => s.id));
  for (const [k, v] of Object.entries(p.field_sources)) for (const id of v) if (!ids.has(id)) return `field_sources «${k}» ссылается на несуществующий источник «${id}»`;
  return null;
}

/** Статистика: сколько технических полей с источником, без него и пустых */
export function profileStats(p: Profile) {
  let sourced = 0, unsourced = 0, empty = 0;
  const walk = (o: unknown, path: string) => {
    if (o === null || o === undefined) { empty++; return; }
    if (Array.isArray(o) || typeof o !== 'object') { if (sourcesFor(p, path).length) sourced++; else unsourced++; return; }
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) walk(v, path ? `${path}.${k}` : k);
  };
  for (const k of ['vehicle', 'powertrain', 'chassis', 'fuel_system'] as const) walk(p[k], k);
  return { sourced, unsourced, empty };
}

type Saved = { kind: 'builtin'; id: string } | { kind: 'custom'; data: Profile } | null;
const KEY = 'vehicle-v2';
// По умолчанию подключён Solaris владельца; «Отключить» сохраняет null
const read = (): Profile | null => {
  const s = store.get<Saved | undefined>(KEY, undefined);
  if (s === undefined) return BUILTIN[0].data;
  if (!s) return null;
  if (s.kind === 'builtin') return BUILTIN.find((b) => b.id === s.id)?.data ?? null;
  return validateProfile(s.data) ? null : s.data;
};
let current = read();
let listeners: ((v: Profile | null) => void)[] = [];
export function setVehicle(v: Saved) {
  store.set(KEY, v);
  current = read();
  listeners.forEach((l) => l(current));
}
export function useVehicle() {
  const [v, setV] = useState<Profile | null>(current);
  useEffect(() => { listeners.push(setV); return () => { listeners = listeners.filter((l) => l !== setV); }; }, []);
  return v;
}

/* Перевод подписей профиля для интерфейса (сами технические значения не меняются) */
export const RU: Record<string, string> = {
  sedan: 'седан', hatchback: 'хэтчбек', FWD: 'передний', RWD: 'задний', AWD: 'полный', gasoline: 'бензин', diesel: 'дизель',
  'inline-4': 'рядный 4-цилиндровый', chain: 'цепь', belt: 'ремень',
  'hydromechanical automatic': 'гидромеханический автомат', '6-speed hydromechanical automatic': '6-ступенчатый гидромеханический автомат',
  'MacPherson independent': 'независимая, МакФерсон', 'semi-independent torsion-beam': 'полузависимая, торсионная балка',
  'rack-and-pinion, electric assist': 'реечное, с электроусилителем', 'ACEA A5/B5 or higher': 'ACEA A5/B5 или выше', 'electric, in-tank': 'электрический, в баке', returnless: 'без обратной магистрали',
};
export const ru = (s: string | null | undefined) => (s == null ? s : RU[s] ?? s);

export const INTERVAL_RU: Record<string, string> = {
  engine_oil_filter: 'Моторное масло и масляный фильтр', engine_air_filter: 'Воздушный фильтр', cabin_filter: 'Салонный фильтр',
  fuel_filter: 'Топливный фильтр', spark_plugs: 'Свечи зажигания', valve_clearance: 'Зазоры клапанов', cooling_system: 'Система охлаждения',
  coolant: 'Охлаждающая жидкость', brake_fluid: 'Тормозная жидкость', brake_components: 'Тормозные трубки, шланги, диски, колодки',
  tires: 'Давление и износ шин', battery: 'Состояние аккумулятора', atf_level: 'Уровень ATF в АКПП',
};
export const ACTION_RU: Record<string, string> = {
  replace: 'замена', inspect: 'проверка', inspect_or_replace: 'проверка / замена', inspect_replace_cycle: 'проверка и замена по очереди', inspect_adjust_if_needed: 'проверка, регулировка при необходимости',
};
export const NOTE_RU: Record<string, string> = {
  'Check engine-oil level and leaks every 500 km or before a long trip.': 'Проверять уровень масла и подтёки каждые 500 км или перед дальней поездкой.',
  'if equipped': 'если установлен',
  'only where the transmission version has a dipstick; follow the exact service procedure for the installed transmission': 'только если у этой версии коробки есть щуп; по точной сервисной процедуре для установленной АКПП',
};
export const HOTSPOT_RU: Record<string, string> = {
  engine_mount_right: 'Правая опора силового агрегата', engine_oil_filler: 'Крышка маслозаливной горловины', engine_oil_dipstick: 'Щуп уровня масла',
  ecu: 'Блок управления двигателем (ЭБУ)', battery: 'Аккумулятор 12 В', engine_air_filter: 'Воздушный фильтр', air_duct: 'Воздуховод',
  radiator_filler: 'Заливная горловина радиатора', throttle_body: 'Дроссельный узел', intake_manifold: 'Впускной коллектор',
  coolant_expansion_tank: 'Горловина расширительного бачка', alternator: 'Генератор', accessory_belt: 'Ремень привода навесных агрегатов',
};
export const RULE_RU: Record<string, string> = {
  coolant_hot: 'Не открывать крышку радиатора и расширительного бачка на горячем двигателе. Дайте двигателю остыть.',
  oil_warning: 'Если лампа давления масла горит при работающем двигателе — безопасно остановиться, заглушить двигатель и проверить уровень масла.',
  atf_procedure: 'Проверка и доливка ATF зависят от конкретной коробки и заданной температуры жидкости. Универсальной инструкции для новичка нет.',
};
export const AMBIENT_RU = (s: string) => s.replace('from', 'от').replace('to above', 'до выше').replace(/°C/g, ' °C');

/** Диапазон температур из строки вида «from -30°C to above +30°C» */
export function ambientRange(s: string): [number, number] {
  const m = s.match(/(-?\+?\d+)\s*°C.*?(-?\+?\d+)\s*°C/);
  return m ? [parseFloat(m[1]), parseFloat(m[2]) + (/above/.test(s) ? 10 : 0)] : [-40, 40];
}

const fmtKm = (n: number) => `${n.toLocaleString('ru')} км`;
export function intervalText(i: Interval) {
  const parts: string[] = [];
  if (i.every_km) parts.push(`каждые ${fmtKm(i.every_km)}${i.every_months ? ` или ${i.every_months} мес.` : ''}`);
  if (i.first_km) parts.push(`первая — ${fmtKm(i.first_km)}${i.first_months ? ` или ${i.first_months} мес.` : ''}, далее каждые ${fmtKm(i.then_every_km ?? 0)}${i.then_every_months ? ` или ${i.then_every_months} мес.` : ''}`);
  if (i.replace_km) parts.push(`замена: ${i.replace_km.map((x) => x / 1000).join(', ')} тыс.`);
  if (i.inspect_km) parts.push(`проверка: ${i.inspect_km.map((x) => x / 1000).join(', ')} тыс.`);
  if (i.at_km) parts.push(`на ${i.at_km.map((x) => x / 1000).join(', ')} тыс.`);
  return parts.join(' · ');
}
