import { describe, expect, it } from 'vitest';
import { applyTheme, parsePreference, resolveTheme } from './theme';

describe('tema', () => {
  it('acepta solo preferencias conocidas; lo demás sigue al sistema', () => {
    expect(parsePreference('dark')).toBe('dark');
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference(null)).toBe('system');
    expect(parsePreference('azul')).toBe('system');
  });

  it('"system" sigue al equipo; claro y oscuro lo ignoran', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('activa los tokens en <html> y el color de la barra del navegador', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#28727A" />';
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#05070c',
    );
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
