import { describe, expect, it } from 'vitest';
import { remainingSessions, worksOn } from './domain';

describe('worksOn', () => {
  const schedule = { mon: [{ start: '08:00', end: '12:00' }], wed: [] };

  it('es true si el profesional tiene tramos ese día', () => {
    expect(worksOn({ active: true, weeklySchedule: schedule }, '2026-09-28')).toBe(true); // lunes
  });

  it('es false sin tramos o con la lista vacía', () => {
    expect(worksOn({ active: true, weeklySchedule: schedule }, '2026-09-29')).toBe(false); // martes
    expect(worksOn({ active: true, weeklySchedule: schedule }, '2026-09-30')).toBe(false); // miércoles []
  });

  it('un profesional inactivo nunca está disponible', () => {
    expect(worksOn({ active: false, weeklySchedule: schedule }, '2026-09-28')).toBe(false);
  });
});

describe('remainingSessions', () => {
  it('calcula las sesiones restantes sin bajar de cero', () => {
    expect(remainingSessions({ plannedSessions: 10, completedSessions: 8 })).toBe(2);
    expect(remainingSessions({ plannedSessions: 10, completedSessions: 12 })).toBe(0);
  });
});
