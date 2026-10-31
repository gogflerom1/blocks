import { SVGProps } from 'react';

// Линейные иконки 24×24, stroke = currentColor
const S = (p: SVGProps<SVGSVGElement> & { d?: string }) => {
  const { d, children, ...rest } = p;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {d ? <path d={d} /> : children}
    </svg>
  );
};
type P = SVGProps<SVGSVGElement>;

export const Ico = {
  close: (p: P) => <S {...p} d="M6 6l12 12M18 6L6 18" />,
  menu: (p: P) => <S {...p} d="M4 7h16M4 12h16M4 17h10" />,
  back: (p: P) => <S {...p} d="M15 5l-7 7 7 7" />,
  arrow: (p: P) => <S {...p} d="M5 12h14M13 6l6 6-6 6" />,
  play: (p: P) => <S {...p}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></S>,
  pause: (p: P) => <S {...p}><rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" /></S>,
  step: (p: P) => <S {...p}><path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none" /><path d="M18 5v14" /></S>,
  reset: (p: P) => <S {...p} d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />,
  info: (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></S>,
  warn: (p: P) => <S {...p}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5v.3" /></S>,
  stop: (p: P) => <S {...p}><path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" /><path d="M12 8v5M12 16v.3" /></S>,
  check: (p: P) => <S {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
  layers: (p: P) => <S {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></S>,
  explode: (p: P) => <S {...p}><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3" /></S>,
  eye: (p: P) => <S {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></S>,
  bolt: (p: P) => <S {...p} d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  // модули
  engine: (p: P) => <S {...p}><path d="M4 10v6h2l2 3h8v-3h2v2h2v-8h-2v2h-2V8h-4V6h3V4H9v2h3v2H8l-2 2z" /></S>,
  gearbox: (p: P) => <S {...p}><circle cx="6" cy="6" r="1.8" /><circle cx="12" cy="6" r="1.8" /><circle cx="18" cy="6" r="1.8" /><circle cx="6" cy="18" r="1.8" /><circle cx="12" cy="18" r="1.8" /><path d="M6 8v8M12 8v8M18 8v4H6" /></S>,
  suspension: (p: P) => <S {...p}><path d="M12 2v3M8 5h8M9 7l6 2-6 2 6 2-6 2 6 2M8 19h8M12 19v3" /></S>,
  brakes: (p: P) => <S {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" /><path d="M17.5 4.5a10 10 0 0 1 3 6" strokeWidth="3" /></S>,
  electrics: (p: P) => <S {...p}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M7 7V5h3v2M14 7V5h3v2M7 13h3M15.5 11.5v3M14 13h3" /></S>,
  hood: (p: P) => <S {...p}><path d="M3 16l3-6h12l3 6v3H3z" /><path d="M6 10l3-5h6l3 5" /><circle cx="7.5" cy="16.5" r="1" /><circle cx="16.5" cy="16.5" r="1" /></S>,
  fluids: (p: P) => <S {...p} d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  service: (p: P) => <S {...p} d="M14.5 5.5a4 4 0 0 0 4.9 4.9L21 12l-9 9-3-3 9-9 1.5 1.5M10 14L4 20M6.5 4.5L4 7l3 3 2.5-2.5" />,
  diag: (p: P) => <S {...p}><path d="M3 12h4l2-5 4 10 2-5h6" /></S>,
  dash: (p: P) => <S {...p}><path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4-5" /><path d="M7 17h0M17 17h0" /></S>,
  learn: (p: P) => <S {...p}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6" /></S>,
  free: (p: P) => <S {...p}><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></S>,
  tire: (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></S>,
  drive: (p: P) => <S {...p}><rect x="3" y="4" width="4" height="6" rx="1" /><rect x="17" y="4" width="4" height="6" rx="1" /><rect x="3" y="14" width="4" height="6" rx="1" /><rect x="17" y="14" width="4" height="6" rx="1" /><path d="M7 7h10M12 7v10M7 17h10" /></S>,
  car: (p: P) => <S {...p}><path d="M3 15v-3l2-5h14l2 5v3a1 1 0 0 1-1 1h-1M3 15a1 1 0 0 0 1 1h1M8 16h8" /><circle cx="6.5" cy="16.5" r="1.8" /><circle cx="17.5" cy="16.5" r="1.8" /><path d="M5 12h14" /></S>,
  steering: (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.2" /><path d="M3.5 10.5h6.3M14.2 10.5h6.3M12 14.2v6.7" /></S>,
};

export type IcoName = keyof typeof Ico;
