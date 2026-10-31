import { Fragment, useState } from 'react';
import { PROFILE_TEMPLATE, VehicleProfile, setVehicle, useVehicle, validateProfile } from '../../lib/vehicle';
import { go } from '../../lib/router';
import { Callout, ModHead } from '../../ui/kit';

const ADAPTS = [
  ['Расположение узлов', 'схема «Под капотом» и «Что куда лить»'],
  ['Тип двигателя и коробки', 'нужные вкладки и анимации'],
  ['Объёмы жидкостей', 'сколько масла, антифриза, ATF'],
  ['Спецификации', 'вязкость и допуск масла, тип антифриза, DOT'],
  ['Интервалы ТО', 'подставляются в шкалу ТО'],
  ['Предохранители', 'где блоки и что за что отвечает'],
  ['Ремень или цепь ГРМ', 'и встречаются ли клапаны с поршнями'],
  ['Особенности', 'известные слабые места и советы'],
];

export function MyCarModule() {
  const v = useVehicle();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tpl = JSON.stringify(PROFILE_TEMPLATE, null, 2);
  const load = (raw: string) => {
    try {
      const p = JSON.parse(raw) as VehicleProfile;
      const e = validateProfile(p);
      if (e) { setErr(e); return; }
      setErr(null); setVehicle(p);
    } catch { setErr('Не получилось прочитать JSON — проверьте запятые и кавычки.'); }
  };
  const onFile = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => { setText(String(r.result)); load(String(r.result)); }; r.readAsText(f); };
  const copy = async () => { try { await navigator.clipboard.writeText(tpl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } };

  return (
    <>
      <ModHead title="Моя машина" lead="Выберите конкретную модель — и приложение подстроит схемы, жидкости и интервалы под неё." />
      <div className="split wide-aside">
        <div className="stack">
          {v ? (
            <div className="panel">
              <span className="eyebrow" style={{ color: 'var(--green)' }}>Профиль подключён</span>
              <h3 style={{ fontSize: 22 }}>{v.make} {v.model} {v.year}</h3>
              <dl className="kv" style={{ marginTop: 8 }}>
                <dt>Двигатель</dt><dd>{v.engine}</dd>
                <dt>Коробка</dt><dd>{v.gearbox}</dd>
                {v.timing && <><dt>ГРМ</dt><dd>{v.timing === 'belt' ? 'ремень' : 'цепь'}</dd></>}
                {v.fluids && Object.entries(v.fluids).map(([k, f]) => f && f.spec ? <Fragment key={k}><dt>{k}</dt><dd>{f.spec}{f.capacityL ? ` · ${f.capacityL} л` : ''}</dd></Fragment> : null)}
                <dt>Источники</dt><dd>{v.sources.map((s) => `${s.title}${s.page ? `, с. ${s.page}` : ''}`).join('; ')}</dd>
              </dl>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={() => go('service')}>Открыть ТО по профилю</button>
                <button className="btn" onClick={() => setVehicle(null)}>Отключить</button>
              </div>
            </div>
          ) : (
            <div className="panel">
              <span className="eyebrow">Например: Hyundai Solaris 2018 1.4 AT</span>
              <h3 style={{ fontSize: 19 }}>Данных конкретных моделей пока нет — и это намеренно</h3>
              <p className="muted">Мы не выдумываем объёмы, допуски и интервалы. Профиль машины загружается из файла, составленного по руководству по эксплуатации или сервисной документации, и обязательно содержит ссылку на источник. Без источника профиль не примется.</p>
            </div>
          )}
          <div className="panel">
            <span className="eyebrow">Что подстроится под вашу машину</span>
            <div className="cardgrid">{ADAPTS.map(([a, b]) => <div key={a}><h4>{a}</h4><p>{b}</p></div>)}</div>
          </div>
          <div className="panel stack">
            <span className="eyebrow">Загрузить профиль (JSON)</span>
            <input type="file" accept="application/json,.json" id="profile-file" onChange={(e) => onFile(e.target.files?.[0])} />
            <textarea id="profile-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="…или вставьте JSON сюда"
              style={{ width: '100%', background: '#050912', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 12, padding: 12, fontFamily: 'var(--f-mono)', fontSize: 12.5 }} />
            <div className="row"><button className="btn primary" onClick={() => load(text)} disabled={!text.trim()}>Проверить и подключить</button></div>
            {err && <Callout kind="warn">{err}</Callout>}
          </div>
        </div>
        <div className="stack">
          <div className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="eyebrow" style={{ margin: 0 }}>Шаблон профиля</span>
              <button className="btn sm" onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</button>
            </div>
            <pre className="scroll-x" style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-2)', fontFamily: 'var(--f-mono)', maxHeight: 420 }}>{tpl}</pre>
          </div>
          <Callout kind="info">Поле <b>sources</b> обязательно: название документа и страница. Пустые поля — значит «нет данных», приложение покажет общую информацию.</Callout>
        </div>
      </div>
    </>
  );
}
