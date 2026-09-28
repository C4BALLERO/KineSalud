import { describe, expect, it } from 'vitest';
import { addDays, clinicDateTime, startOfWeek, toDateKey, weekdayOf } from './time';

describe('fechas del consultorio (America/La_Paz)', () => {
  it('usa el día local de Bolivia, no el de UTC', () => {
    // 02:30 UTC del 28 = 22:30 del 27 en Bolivia.
    expect(toDateKey(new Date('2026-09-28T02:30:00Z'))).toBe('2026-09-27');
  });

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('identifica el día de la semana y el lunes de la semana', () => {
    expect(weekdayOf('2026-09-27')).toBe('sun');
    expect(weekdayOf('2026-09-28')).toBe('mon');
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21');
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28');
  });

  it('construye instantes con el desfase fijo UTC−4', () => {
    expect(clinicDateTime('2026-09-28', '09:30').toISOString()).toBe('2026-09-28T13:30:00.000Z');
  });
});
