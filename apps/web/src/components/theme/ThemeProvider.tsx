import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyTheme,
  DARK_QUERY,
  parsePreference,
  readPreference,
  resolveTheme,
  systemPrefersDark,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';
import { ThemeContext } from './theme-context';

/**
 * Única fuente del tema en la aplicación: aplica la preferencia y sigue los
 * cambios del sistema (en "system") y de otras pestañas.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => applyTheme(resolved), [resolved]);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia(DARK_QUERY);
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) setPreferenceState(parsePreference(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: el tema vale solo para esta visita.
    }
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
