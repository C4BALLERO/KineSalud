/**
 * Tema de color. La preferencia es de cada persona en su navegador
 * (localStorage); "system" sigue la configuración del equipo. El atributo
 * `data-theme` de <html> activa los tokens oscuros (styles/tokens.css).
 * public/theme-init.js aplica lo mismo antes del primer pintado: si cambia
 * algo aquí (clave o valores), cambia allá también.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'kinesalud:theme';
const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
/** Color de la barra del navegador en móviles, por tema. */
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#28727a', dark: '#05070c' };

export function parsePreference(value: string | null): ThemePreference {
  return PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

export function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

/** Activa los tokens del tema en <html> y el color de la barra del navegador. */
export function applyTheme(theme: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}
