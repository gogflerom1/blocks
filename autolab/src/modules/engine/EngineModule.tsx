import { useSubTab } from '../../lib/router';
import { ModHead, Tabs } from '../../ui/kit';
import { FourStroke } from './FourStroke';
import { PetrolDiesel } from './PetrolDiesel';
import { Turbo } from './Turbo';
import { Timing } from './Timing';
import { OilSystem } from './OilSystem';
import { Cooling } from './Cooling';

const TABS = [
  { id: 'cycle', label: '4 такта' },
  { id: 'fuel', label: 'Бензин vs дизель' },
  { id: 'turbo', label: 'Турбина' },
  { id: 'timing', label: 'ГРМ' },
  { id: 'oil', label: 'Масло' },
  { id: 'cooling', label: 'Охлаждение' },
] as const;
type T = (typeof TABS)[number]['id'];

export function EngineModule({ sub }: { sub: string }) {
  const [tab, setTab] = useSubTab<T>('engine', TABS.map((t) => t.id), sub);
  return (
    <>
      <ModHead title="Двигатель" lead="Как топливо превращается во вращение. Всё анимировано — ставьте на паузу и нажимайте на детали." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'cycle' && <FourStroke />}
      {tab === 'fuel' && <PetrolDiesel />}
      {tab === 'turbo' && <Turbo />}
      {tab === 'timing' && <Timing />}
      {tab === 'oil' && <OilSystem />}
      {tab === 'cooling' && <Cooling />}
    </>
  );
}
