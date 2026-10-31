import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ACTION_RU, AMBIENT_RU, BUILTIN, HOTSPOT_RU, INTERVAL_RU, NOTE_RU, Profile, RULE_RU, ambientRange, intervalText, profileStats, ru, setVehicle, useVehicle, validateProfile,
} from '../../lib/vehicle';
import { go } from '../../lib/router';
import { Callout, ModHead } from '../../ui/kit';
import { Fact, SrcChip, Val } from '../../ui/src';



/** Цилиндр в масштабе: диаметр и ход из профиля */
function BoreStroke({ bore, stroke }: { bore: number; stroke: number }) {
  const k = 1.6, w = bore * k, h = stroke * k;
  return (
    <svg viewBox={`0 0 ${w + 120} ${h + 70}`} style={{ width: '100%', maxWidth: 260, display: 'block' }} role="img" aria-label={`Диаметр ${bore} мм, ход ${stroke} мм`}>
      <rect x={40} y={20} width={w} height={h + 26} fill="#050912" stroke="#5a6d90" strokeWidth={2} />
      <rect x={42} y={20 + h - 2} width={w - 4} height={26} rx={3} fill="#c7d4e8" />
      <rect x={42} y={22} width={w - 4} height={h - 26} fill="#b9ef6b" opacity=".18" />
      <path d={`M40,${h + 60} H${40 + w}`} stroke="#3de2ff" strokeWidth={1.5} />
      <text x={40 + w / 2} y={h + 56} textAnchor="middle" className="mono" style={{ fontSize: 12, fill: '#3de2ff' }}>⌀ {bore} мм</text>
      <path d={`M${54 + w},22 V${20 + h}`} stroke="#ff8a4c" strokeWidth={1.5} />
      <text x={60 + w} y={24 + h / 2} className="mono" style={{ fontSize: 12, fill: '#ff8a4c' }}>ход {stroke}</text>
    </svg>
  );
}

function Viscosity({ p }: { p: Profile }) {
  const rows = p.powertrain.engine?.engine_oil?.viscosity_by_temperature ?? [];
  const T0 = -35, T1 = 40, W = 520;
  const X = (t: number) => 90 + ((Math.max(T0, Math.min(T1, t)) - T0) / (T1 - T0)) * (W - 100);
  return (
    <svg viewBox={`0 0 ${W} ${rows.length * 30 + 34}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Вязкость масла по температуре воздуха">
      {[-30, -20, -10, 0, 10, 20, 30].map((t) => (
        <g key={t}><line x1={X(t)} x2={X(t)} y1={4} y2={rows.length * 30 + 8} stroke="rgba(130,175,255,.12)" /><text x={X(t)} y={rows.length * 30 + 26} textAnchor="middle" className="mono" style={{ fontSize: 10, fill: '#6c7e9c' }}>{t > 0 ? `+${t}` : t}</text></g>
      ))}
      {rows.map((r, i) => {
        const [a, b] = ambientRange(r.ambient);
        return (
          <g key={i}>
            <text x={0} y={i * 30 + 24} className="mono" style={{ fontSize: 12, fill: '#e8eefa', fontWeight: 600 }}>{r.sae.join(', ')}</text>
            <rect x={X(a)} y={i * 30 + 10} width={X(b) - X(a)} height={18} rx={9} fill={i === 0 ? '#3de2ff' : '#5a6d90'} opacity={i === 0 ? 0.9 : 0.55} />
          </g>
        );
      })}
    </svg>
  );
}

function ProfileView({ p }: { p: Profile }) {
  const e = p.powertrain.engine, t = p.powertrain.transmission, oil = e?.engine_oil, st = profileStats(p);
  const ADAPT: [string, string, () => void][] = [
    ['Двигатель → 4 такта', `${e?.code ?? ''}: сжатие ${e?.compression_ratio ?? '—'}, порядок ${e?.firing_order ?? '—'}`, () => go('engine')],
    ['Двигатель → ГРМ', e?.timing_drive ? `привод — ${ru(e.timing_drive)}` : 'нет данных', () => go('engine', 'timing')],
    ['Коробка → Автомат', `${t?.model ?? ''} · ${t?.gears ?? '—'} передач · ${t?.atf_spec ?? ''}`, () => go('gearbox', 'auto')],
    ['Коробка → Привод', `${ru(p.vehicle.drive as string)} привод`, () => go('gearbox', 'drive')],
    ['Подвеска и руль', `${ru(p.chassis?.rear_suspension)}, ${ru(p.chassis?.steering)}`, () => go('chassis')],
    ['Что куда лить', `масло ${oil?.service_fill_l ?? '—'} л при замене, ATF ${t?.atf_spec ?? '—'}`, () => go('fluids')],
    ['ТО', 'регламент Hyundai вместо типовой шкалы', () => go('service')],
    ['Главная 3D', `кузов — ${ru(p.vehicle.body as string)}`, () => go('home')],
  ];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="prof-hero">
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ color: 'var(--green)' }}>Профиль подключён · v{p.profile_version}{p.last_verified ? ` · проверен ${p.last_verified.split('-').reverse().join('.')}` : ''}</span>
          <h2>{p.make} {p.model} {p.generation}</h2>
          <p className="muted" style={{ marginTop: 4 }}>{p.title}</p>
          <div className="prof-tags">
            {[ru(p.vehicle.body as string), `${ru(p.vehicle.drive as string)} привод`, e?.family, t?.model, p.market && `рынок ${p.market}`].filter(Boolean).map((x) => <span key={String(x)} className="tag c">{x}</span>)}
          </div>
        </div>
        <div className="quality" title="Технические поля профиля">
          <div><b style={{ color: 'var(--green)' }}>{st.sourced}</b><span>с источником</span></div>
          <div><b style={{ color: 'var(--amber)' }}>{st.unsourced}</b><span>без источника</span></div>
          <div><b style={{ color: 'var(--ink-3)' }}>{st.empty}</b><span>нет данных</span></div>
        </div>
      </div>

      <div className="grid2">
        <motion.div className="panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <span className="eyebrow">Двигатель</span>
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Fact p={p} path="powertrain.engine.code" label="Код" v={e?.code}>{e?.code} · {e?.family}</Fact>
              <Fact p={p} path="powertrain.engine.displacement_cc" label="Объём" v={e?.displacement_cc} unit="см³" />
              <Fact p={p} path="powertrain.engine.compression_ratio" label="Степень сжатия" v={e?.compression_ratio}>{e?.compression_ratio} : 1</Fact>
              <Fact p={p} path="powertrain.engine.power_hp" label="Мощность" v={e?.power_hp}>{e?.power_hp} л.с. ({e?.power_kw} кВт) при {e?.power_rpm} об/мин</Fact>
              <Fact p={p} path="powertrain.engine.torque_nm" label="Крутящий момент" v={e?.torque_nm}>{e?.torque_nm} Н·м при {e?.torque_rpm} об/мин</Fact>
              <Fact p={p} path="powertrain.engine.valvetrain" label="ГРМ" v={e?.timing_drive}>{e?.valvetrain}, {e?.valves_per_cylinder} клапана на цилиндр, {ru(e?.timing_drive)}</Fact>
              <Fact p={p} path="powertrain.engine.firing_order" label="Порядок работы" v={e?.firing_order} />
              <Fact p={p} path="powertrain.engine.fuel_min_octane_ron" label="Топливо" v={e?.fuel_min_octane_ron}>не ниже АИ-{e?.fuel_min_octane_ron} · {e?.emissions_standard}</Fact>
            </div>
          </div>
          {e?.bore_mm && e?.stroke_mm && (
            <div className="row" style={{ marginTop: 10, flexWrap: 'nowrap', gap: 14 }}>
              <BoreStroke bore={e.bore_mm} stroke={e.stroke_mm} />
              <p className="muted" style={{ fontSize: 13.5 }}>Ход поршня ({e.stroke_mm} мм) больше диаметра цилиндра ({e.bore_mm} мм) — длинноходный мотор: тяговитее на средних оборотах. <SrcChip p={p} path="powertrain.engine.bore_mm" /></p>
            </div>
          )}
        </motion.div>

        <motion.div className="panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <span className="eyebrow">Моторное масло</span>
          <Fact p={p} path="powertrain.engine.engine_oil.service_fill_l" label="При замене с фильтром" v={oil?.service_fill_l} unit="л" />
          <Fact p={p} path="powertrain.engine.engine_oil.system_capacity_l" label="Полный объём системы" v={oil?.system_capacity_l} unit="л" />
          <Fact p={p} path="powertrain.engine.engine_oil.quality" label="Класс качества" v={oil?.quality}>{ru(oil?.quality)}</Fact>
          <Fact p={p} path="powertrain.engine.engine_oil.oil_filter_part_number" label="Масляный фильтр" v={oil?.oil_filter_part_number} />
          <h4>Вязкость по температуре воздуха</h4>
          <Viscosity p={p} />
          <p className="muted" style={{ fontSize: 12.5 }}>{(oil?.viscosity_by_temperature ?? []).map((r) => `${r.sae.join('/')}: ${AMBIENT_RU(r.ambient)}`).join(' · ')} <SrcChip p={p} path="powertrain.engine.engine_oil.viscosity_by_temperature" /></p>
        </motion.div>

        <div className="panel">
          <span className="eyebrow">Коробка передач</span>
          <Fact p={p} path="powertrain.transmission.model" label="Модель" v={t?.model} />
          <Fact p={p} path="powertrain.transmission.type" label="Тип" v={t?.type}>{t?.gears}-ступенчатый {ru(t?.type)}</Fact>
          <Fact p={p} path="powertrain.transmission.selector_positions" label="Селектор" v={t?.selector_positions}>{t?.selector_positions?.join(' · ')}</Fact>
          <Fact p={p} path="powertrain.transmission.atf_spec" label="Жидкость ATF" v={t?.atf_spec} />
          <Fact p={p} path="powertrain.transmission.capacity_l" label="Объём ATF" v={t?.capacity_l} unit="л" />
          {t?.capacity_l == null && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Объём намеренно не заполнен, пока нет источника именно для Solaris HCR 1.4.</p>}
        </div>

        <div className="panel">
          <span className="eyebrow">Ходовая и топливо</span>
          <Fact p={p} path="vehicle.drive" label="Привод" v={p.vehicle.drive}>{ru(p.vehicle.drive as string)}</Fact>
          <Fact p={p} path="chassis.front_suspension" label="Передняя подвеска" v={p.chassis?.front_suspension}>{ru(p.chassis?.front_suspension)}</Fact>
          <Fact p={p} path="chassis.rear_suspension" label="Задняя подвеска" v={p.chassis?.rear_suspension}>{ru(p.chassis?.rear_suspension)}</Fact>
          <Fact p={p} path="chassis.steering" label="Рулевое" v={p.chassis?.steering}>{ru(p.chassis?.steering)}</Fact>
          <Fact p={p} path="chassis.brakes" label="Системы" v={p.chassis?.brakes}>{(['abs', 'esc', 'tcs', 'ebd'] as const).filter((k) => p.chassis?.brakes?.[k]).map((k) => k.toUpperCase()).join(' · ')}</Fact>
          <Fact p={p} path="fuel_system.tank_capacity_l" label="Топливный бак" v={p.fuel_system?.tank_capacity_l} unit="л" />
          {p.chassis?.brakes?.note && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Задние тормоза зависят от комплектации — в приложении не считаем, что они у всех дисковые.</p>}
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ margin: 0 }}>Регламент ТО</span>
            <SrcChip p={p} path="maintenance" />
          </div>
          {(p.maintenance?.intervals ?? []).map((i) => (
            <div key={i.id} className="fact" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <span><b style={{ fontSize: 14 }}>{INTERVAL_RU[i.id] ?? i.name}</b><span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{intervalText(i)}{i.condition ? ` · ${NOTE_RU[i.condition] ?? i.condition}` : ''}</span></span>
              <span className="tag c" style={{ alignSelf: 'center' }}>{ACTION_RU[i.action] ?? i.action}</span>
            </div>
          ))}
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => go('service')}>Открыть на шкале ТО →</button>
        </div>
        <div className="stack">
          <div className="panel">
            <span className="eyebrow">Что подстроилось</span>
            <div className="adapt-list">{ADAPT.map(([a, b, f]) => <button key={a} onClick={f}><b>{a}</b><span style={{ textAlign: 'right' }}>{b}</span></button>)}</div>
          </div>
          {(p.safety_rules ?? []).map((r) => (
            <Callout key={r.id} kind={r.severity === 'danger' ? 'stop' : 'warn'}>{RULE_RU[r.id] ?? r.text} <SrcChip p={p} path={`safety_rules.${r.id}`} /></Callout>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ margin: 0 }}>Под капотом — по руководству по ремонту</span>
            <SrcChip p={p} path="interactive_underhood.hotspots" />
          </div>
          <ol className="check" style={{ marginTop: 10 }}>{(p.interactive_underhood?.hotspots ?? []).map((h) => <li key={h.id}>{HOTSPOT_RU[h.id] ?? h.label}</li>)}</ol>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Номера — позиции на рисунке в источнике. Точные координаты в профиле не заданы, поэтому на схеме приложения узлы стоят в типовых местах.</p>
        </div>
        <div className="panel">
          <span className="eyebrow">Источники профиля</span>
          <div className="stack" style={{ gap: 8 }}>
            {p.sources.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="srcrow">
                <b>{s.title}</b><span>{s.publisher} · {s.id}</span>
              </a>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Поля без значения показываются как «Нет подтверждённых данных» — приложение ничего не подставляет.</p>
        </div>
      </div>
    </div>
  );
}

export function MyCarModule() {
  const v = useVehicle();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = (raw: string) => {
    try {
      const p = JSON.parse(raw) as Profile;
      const e = validateProfile(p);
      if (e) { setErr(e); return; }
      setErr(null);
      setVehicle({ kind: 'custom', data: p });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { setErr('Не получилось прочитать JSON — проверьте запятые и кавычки.'); }
  };
  const onFile = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => { setText(String(r.result)); load(String(r.result)); }; r.readAsText(f); };
  return (
    <>
      <ModHead title="Моя машина" lead="Профиль конкретной машины: приложение подстраивает схемы, жидкости и ТО и показывает источник каждой цифры." />
      {v ? <ProfileView p={v} /> : (
        <div className="panel">
          <h3>Профиль отключён</h3>
          <p className="muted">Все разделы показывают общую информацию.</p>
        </div>
      )}
      <div className="split" style={{ marginTop: 16 }}>
        <div className="panel stack">
          <span className="eyebrow">Готовые профили</span>
          {BUILTIN.map((b) => (
            <div key={b.id} className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}><b>{b.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{b.note}</div></div>
              {v?.id === b.id ? <button className="btn sm" onClick={() => setVehicle(null)}>Отключить</button> : <button className="btn sm primary" onClick={() => setVehicle({ kind: 'builtin', id: b.id })}>Подключить</button>}
            </div>
          ))}
        </div>
        <div className="panel stack">
          <span className="eyebrow">Загрузить свой профиль (JSON по vehicle-profile.schema.json)</span>
          <input type="file" accept="application/json,.json" id="profile-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <textarea id="profile-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="…или вставьте JSON сюда"
            style={{ width: '100%', background: '#050912', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 12, padding: 12, fontFamily: 'var(--f-mono)', fontSize: 12.5 }} />
          <div className="row"><button className="btn primary" onClick={() => load(text)} disabled={!text.trim()}>Проверить и подключить</button></div>
          {err && <Callout kind="warn">{err}</Callout>}
          <p className="muted" style={{ fontSize: 12.5 }}>Без источников в sources и field_sources профиль не принимается.</p>
        </div>
      </div>
      <p className="footer-note"><Val v={null} /> — так выглядит поле, которого нет в профиле.</p>
    </>
  );
}
