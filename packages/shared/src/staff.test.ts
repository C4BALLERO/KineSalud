import { describe, expect, it } from 'vitest';
import { worksOn } from './domain';
import {
  daysOutsideHours,
  formatRanges,
  rangesWithin,
  weeklyMinutes,
  weeklyScheduleSchema,
} from './schedule';
import { compatibleRooms, serviceInputSchema } from './settings';
import {
  addExceptionInputSchema,
  dayAvailability,
  exceptionDays,
  exceptionsOverlap,
  professionalDisplayName,
  professionalInputSchema,
} from './staff';
import { addDays, toDateKey } from './time';

const morning = [{ start: '08:00', end: '12:00' }];

describe('horario semanal', () => {
  it('ordena los tramos y omite los días vacíos', () => {
    const parsed = weeklyScheduleSchema.parse({
      mon: [
        { start: '14:30', end: '18:30' },
        { start: '08:00', end: '12:00' },
      ],
      tue: [],
    });
    expect(parsed).toEqual({
      mon: [
        { start: '08:00', end: '12:00' },
        { start: '14:30', end: '18:30' },
      ],
    });
  });

  it('rechaza tramos invertidos o superpuestos', () => {
    expect(
      weeklyScheduleSchema.safeParse({ mon: [{ start: '12:00', end: '08:00' }] }).success,
    ).toBe(false);
    const overlap = weeklyScheduleSchema.safeParse({
      mon: [
        { start: '08:00', end: '12:00' },
        { start: '11:00', end: '13:00' },
      ],
    });
    expect(overlap.success).toBe(false);
    expect(overlap.error?.issues[0]?.message).toBe('Los tramos del día no pueden superponerse.');
  });

  it('acepta tramos contiguos', () => {
    const r = weeklyScheduleSchema.safeParse({
      mon: [
        { start: '08:00', end: '10:00' },
        { start: '10:00', end: '12:00' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('detecta días fuera del horario del consultorio', () => {
    const opening = { mon: morning, tue: morning };
    expect(rangesWithin([{ start: '09:00', end: '11:00' }], morning)).toBe(true);
    expect(
      daysOutsideHours(
        { mon: [{ start: '07:00', end: '11:00' }], tue: morning, sat: morning },
        opening,
      ),
    ).toEqual(['mon', 'sat']);
  });

  it('suma horas y formatea tramos', () => {
    expect(weeklyMinutes({ mon: morning, tue: morning })).toBe(480);
    expect(formatRanges(undefined)).toBe('No atiende');
    expect(
      formatRanges([
        { start: '08:00', end: '12:00' },
        { start: '14:30', end: '18:30' },
      ]),
    ).toBe('08:00–12:00 y 14:30–18:30');
  });
});

describe('profesionales', () => {
  it('normaliza la ficha', () => {
    const data = professionalInputSchema.parse({
      title: 'Lic.',
      firstName: ' Diego ',
      lastName: 'Pérez',
      phone: '+591 7123-4567',
      categories: ['FISIOTERAPIA', 'FISIOTERAPIA'],
      specialties: ['Deportiva'],
      serviceIds: ['a', 'a', 'b'],
    });
    expect(data).toMatchObject({
      firstName: 'Diego',
      phone: '71234567',
      categories: ['FISIOTERAPIA'],
      serviceIds: ['a', 'b'],
    });
    expect(professionalDisplayName(data)).toBe('Lic. Diego Pérez');
  });

  it('exige al menos un área y acepta teléfono vacío', () => {
    const r = professionalInputSchema.safeParse({
      firstName: 'Ana',
      lastName: 'Rojas',
      phone: '',
      categories: [],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Elige al menos un área de atención.');
    const ok = professionalInputSchema.parse({
      firstName: 'Ana',
      lastName: 'Rojas',
      phone: '',
      categories: ['ESTETICA'],
    });
    expect(ok.phone).toBeNull();
    expect(professionalDisplayName(ok)).toBe('Ana Rojas');
  });
});

describe('ausencias', () => {
  const today = toDateKey(new Date());
  const base = { professionalId: 'p1', type: 'VACACIONES' as const };

  it('valida el rango de fechas', () => {
    const inverted = addExceptionInputSchema.safeParse({
      ...base,
      dateFrom: addDays(today, 5),
      dateTo: addDays(today, 2),
    });
    expect(inverted.error?.issues[0]?.message).toBe(
      'La fecha de fin no puede ser anterior a la de inicio.',
    );
    const past = addExceptionInputSchema.safeParse({
      ...base,
      dateFrom: addDays(today, -10),
      dateTo: addDays(today, -1),
    });
    expect(past.success).toBe(false);
    const tooLong = addExceptionInputSchema.safeParse({
      ...base,
      dateFrom: today,
      dateTo: addDays(today, 90),
    });
    expect(tooLong.success).toBe(false);
    expect(
      addExceptionInputSchema.safeParse({ ...base, dateFrom: today, dateTo: addDays(today, 89) })
        .success,
    ).toBe(true);
  });

  it('calcula días y superposiciones', () => {
    const a = { dateFrom: '2026-10-05', dateTo: '2026-10-09' };
    expect(exceptionDays(a)).toBe(5);
    expect(exceptionsOverlap(a, { dateFrom: '2026-10-09', dateTo: '2026-10-12' })).toBe(true);
    expect(exceptionsOverlap(a, { dateFrom: '2026-10-10', dateTo: '2026-10-12' })).toBe(false);
  });

  it('la disponibilidad del día considera estado, ausencias y horario', () => {
    const pro = { active: true, weeklySchedule: { mon: morning } };
    const vac = [{ dateFrom: '2026-10-05', dateTo: '2026-10-09', type: 'VACACIONES' as const }];
    expect(dayAvailability(pro, [], '2026-10-05')).toEqual({ kind: 'working', ranges: morning });
    expect(dayAvailability(pro, vac, '2026-10-05').kind).toBe('absent');
    expect(dayAvailability(pro, [], '2026-10-06').kind).toBe('off');
    expect(dayAvailability({ ...pro, active: false }, [], '2026-10-05').kind).toBe('inactive');
    expect(worksOn(pro, '2026-10-05', vac)).toBe(false);
    expect(worksOn(pro, '2026-10-12', vac)).toBe(true);
  });
});

describe('servicios y espacios', () => {
  it('valida duraciones en múltiplos de 5', () => {
    const r = serviceInputSchema.safeParse({
      name: 'Masaje',
      category: 'ESTETICA',
      durationMin: 42,
      bufferMin: 0,
      defaultSessions: 1,
      roomKinds: ['CABINA_ESTETICA'],
    });
    expect(r.error?.issues[0]?.message).toBe('Usa múltiplos de 5 minutos.');
  });

  it('encuentra espacios compatibles por tipo, área y estado', () => {
    const rooms = [
      {
        id: 'c1',
        kind: 'CAMILLA' as const,
        allowedCategories: ['FISIOTERAPIA' as const],
        active: true,
      },
      {
        id: 'c2',
        kind: 'CAMILLA' as const,
        allowedCategories: ['FISIOTERAPIA' as const],
        active: false,
      },
      {
        id: 'g',
        kind: 'GIMNASIO' as const,
        allowedCategories: ['REHABILITACION' as const],
        active: true,
      },
    ];
    const ids = (s: Parameters<typeof compatibleRooms>[0]) =>
      compatibleRooms(s, rooms).map((r) => r.id);
    expect(ids({ category: 'FISIOTERAPIA', roomKinds: ['CAMILLA'] })).toEqual(['c1']);
    expect(ids({ category: 'ESTETICA', roomKinds: ['CAMILLA'] })).toEqual([]);
  });
});
