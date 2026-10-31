import { ReactNode } from 'react';
import { Profile, Source, sourcesFor } from '../lib/vehicle';
import { go } from '../lib/router';
import { Ico } from './icons';

const SHORT: Record<string, string> = {
  manufacturer_owner_manual: 'руководство', manufacturer_maintenance_schedule: 'регламент ТО', manufacturer_spec_sheet: 'комплектации',
  repair_manual: 'рук. по ремонту', service_manual_mirror: 'сервис-мануал',
};

/** Чип источника: у каждого технического значения должен быть источник */
export function SrcChip({ p, path, list }: { p: Profile; path?: string; list?: Source[] }) {
  const src = list ?? (path ? sourcesFor(p, path) : []);
  if (!src.length) return <span className="src none" title="В field_sources профиля нет источника для этого поля">источник не указан</span>;
  return <>{src.map((s) => <a key={s.id} className="src" href={s.url} target="_blank" rel="noreferrer" title={`${s.title}${s.publisher ? ' — ' + s.publisher : ''}`}>{SHORT[s.type] ?? s.type}</a>)}</>;
}

export function Val({ v, unit, children }: { v: unknown; unit?: string; children?: ReactNode }) {
  if (v === null || v === undefined || v === '') return <span className="nodata">Нет подтверждённых данных</span>;
  return <>{children ?? String(v)}{unit ? ` ${unit}` : ''}</>;
}

/** Строка «подпись — значение — источник» */
export function Fact({ p, path, label, v, unit, children }: { p: Profile; path: string; label: string; v: unknown; unit?: string; children?: ReactNode }) {
  return (
    <div className="fact">
      <span className="fact-l">{label}</span>
      <span className="fact-v"><Val v={v} unit={unit}>{children}</Val></span>
      <span className="fact-s">{v === null || v === undefined ? null : <SrcChip p={p} path={path} />}</span>
    </div>
  );
}

/** Плашка «это ваша машина» в начале раздела */
export function MyCarBadge({ p, children }: { p: Profile; children?: ReactNode }) {
  return (
    <div className="mycar-badge">
      <span className="mycar-ic"><Ico.car width={20} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b>Ваш {p.make} {p.model} {p.generation ?? ''} {p.year}</b>
        {children && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{children}</div>}
      </div>
      <button className="btn sm" onClick={() => go('mycar')}>Профиль</button>
    </div>
  );
}
