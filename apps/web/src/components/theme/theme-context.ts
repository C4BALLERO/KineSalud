import { createContext, useContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '@/lib/theme';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => undefined,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
