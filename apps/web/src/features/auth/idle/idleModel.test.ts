import { describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_MS, idleState, latestActivity } from './idleModel';

describe('idleState', () => {
  const start = 1_000_000;

  it('activa hasta el último minuto, luego aviso con segundos y al final vencida', () => {
    expect(idleState(start, start + 10 * 60_000)).toEqual({ kind: 'active' });
    expect(idleState(start, start + IDLE_TIMEOUT_MS - 45_500)).toEqual({
      kind: 'warning',
      secondsLeft: 46,
    });
    expect(idleState(start, start + IDLE_TIMEOUT_MS)).toEqual({ kind: 'expired' });
  });
});

describe('latestActivity', () => {
  it('usa la actividad más reciente de cualquier pestaña e ignora valores inválidos', () => {
    expect(latestActivity(100, '250')).toBe(250);
    expect(latestActivity(300, '250')).toBe(300);
    expect(latestActivity(300, null)).toBe(300);
    expect(latestActivity(300, 'basura')).toBe(300);
  });
});
