import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { go, useRoute } from './lib/router';
import { InfoProvider } from './lib/info';
import { MODULES } from './content/nav';
import { Ico } from './ui/icons';
import { useVehicle } from './lib/vehicle';
import { Home } from './modules/home/Home';
import { EngineModule } from './modules/engine/EngineModule';
import { TransmissionModule } from './modules/transmission/TransmissionModule';
import { SuspensionModule } from './modules/suspension/SuspensionModule';
import { BrakesModule } from './modules/brakes/BrakesModule';
import { ElectricsModule } from './modules/electrics/ElectricsModule';
import { UnderhoodModule } from './modules/underhood/UnderhoodModule';
import { FluidsModule } from './modules/underhood/FluidsModule';
import { MaintenanceModule } from './modules/maintenance/MaintenanceModule';
import { DiagnosticsModule } from './modules/diagnostics/DiagnosticsModule';
import { DashboardModule } from './modules/dashboard/DashboardModule';
import { TiresModule } from './modules/tires/TiresModule';
import { LearnModule } from './modules/learn/LearnModule';
import { FreeModule } from './modules/home/FreeModule';
import { MyCarModule } from './modules/mycar/MyCarModule';

const VIEWS: Record<string, (p: { sub: string }) => JSX.Element> = {
  home: () => <Home />,
  engine: EngineModule,
  gearbox: TransmissionModule,
  chassis: SuspensionModule,
  brakes: BrakesModule,
  electrics: ElectricsModule,
  hood: UnderhoodModule,
  fluids: FluidsModule,
  service: MaintenanceModule,
  diag: DiagnosticsModule,
  dash: DashboardModule,
  tires: TiresModule,
  learn: LearnModule,
  free: FreeModule,
  mycar: MyCarModule,
};

function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8ff0ff" /><stop offset="1" stopColor="#12b4d6" /></linearGradient></defs>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#lg)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="url(#lg)" strokeWidth="1" strokeDasharray="2 2.6" />
      <path d="M16 16 L23 9" stroke="#ff6a3c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.4" fill="#e8eefa" />
    </svg>
  );
}

export function App() {
  const r = useRoute();
  const [nav, setNav] = useState(false);
  const car = useVehicle();
  useEffect(() => { window.scrollTo({ top: 0 }); setNav(false); }, [r.mod]);
  const View = VIEWS[r.mod] ?? VIEWS.home;
  const m = MODULES.find((x) => x.id === r.mod);
  return (
    <InfoProvider>
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => go('home')} aria-label="На главную">
            <Logo />
            <span className="brand-name">Машина<br />изнутри<small>AUTOLAB · v0.1</small></span>
          </button>
          {m && (
            <div className="crumb">
              <span aria-hidden="true">/</span><b>{m.title}</b>
            </div>
          )}
          <span className="spacer" />
          {car && r.mod !== 'mycar' && <button className="car-chip" onClick={() => go('mycar')} title="Профиль машины"><Ico.car width={18} /><span>{car.model} {car.generation} {car.year}</span></button>}
          {r.mod !== 'home' && <button className="iconbtn" onClick={() => (history.length > 1 ? history.back() : go('home'))} aria-label="Назад"><Ico.back /></button>}
          <button className="iconbtn" onClick={() => setNav(true)} aria-label="Все разделы"><Ico.menu /></button>
        </header>
        <main className="page">
          <AnimatePresence mode="wait">
            <motion.div key={r.mod} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <View sub={r.sub} />
            </motion.div>
          </AnimatePresence>
        </main>
        <AnimatePresence>
          {nav && (
            <motion.div className="nav-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && setNav(false)}>
              <div className="nav-inner">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 22, textTransform: 'uppercase' }}>Все разделы</h2>
                  <button className="iconbtn" onClick={() => setNav(false)} aria-label="Закрыть"><Ico.close /></button>
                </div>
                <div className="nav-grid">
                  <button className="tile" onClick={() => { go('home'); setNav(false); }}><span className="ti"><Ico.car /></span><span><span className="tt" style={{ display: 'block' }}>Главная</span><span className="ts" style={{ display: 'block' }}>3D-машина и разборка</span></span></button>
                  {MODULES.map((x, i) => {
                    const I = Ico[x.icon];
                    return (
                      <motion.button key={x.id} className="tile" onClick={() => { go(x.id); setNav(false); }}
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
                        <span className="ti"><I /></span>
                        <span><span className="tt" style={{ display: 'block' }}>{x.title}</span><span className="ts" style={{ display: 'block' }}>{x.sub}</span></span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </InfoProvider>
  );
}
