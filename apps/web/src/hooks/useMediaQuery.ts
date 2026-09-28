import { useSyncExternalStore } from 'react';

/** Suscripción a una media query CSS (p. ej. `(min-width: 80rem)`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Breakpoints del Design System (coinciden con Tailwind). */
export const BREAKPOINTS = {
  md: '(min-width: 48rem)', // 768 — tablet
  lg: '(min-width: 64rem)', // 1024 — laptop
  xl: '(min-width: 80rem)', // 1280 — desktop con sidebar completo
} as const;
