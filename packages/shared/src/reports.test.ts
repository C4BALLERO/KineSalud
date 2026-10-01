import { describe, expect, it } from 'vitest';
import {
  aggregateAppointments,
  aggregatePayments,
  attendanceRate,
  bucketsBetween,
  cancellationRate,
  cellKey,
  granularityFor,
  parseCellKey,
  rebuildReportsInputSchema,
  summarizeStats,
  type DailyStatsDoc,
} from './reports';
import { clinicDateTime } from './time';

const D = '2026-09-28';
const appt = (
  professionalId: string,
  status: 'ATENDIDA' | 'CANCELADA' | 'NO_ASISTIO',
  min = 45,
) => ({
  professionalId,
  category: 'FISIOTERAPIA' as const,
  status,
  startAt: clinicDateTime(D, '09:00'),
  endAt: new Date(clinicDateTime(D, '09:00').getTime() + min * 60_000),
});

describe('agregación diaria', () => {
  it('cuenta citas por profesional y área, y los minutos atendidos', () => {
    const cells = aggregateAppointments([
      appt('diego', 'ATENDIDA'),
      appt('diego', 'ATENDIDA', 60),
      appt('diego', 'CANCELADA'),
      appt('ana', 'NO_ASISTIO'),
    ]);
    expect(cells[cellKey('diego', 'FISIOTERAPIA')]).toMatchObject({
      ATENDIDA: 2,
      CANCELADA: 1,
      attendedMinutes: 105,
    });
    expect(cells[cellKey('ana', 'FISIOTERAPIA')]?.NO_ASISTIO).toBe(1);
  });

  it('las claves de celda admiten ids con guiones bajos', () => {
    expect(parseCellKey(cellKey('prof_a_b', 'ESTETICA'))).toEqual({
      professionalId: 'prof_a_b',
      category: 'ESTETICA',
    });
  });

  it('los ingresos ignoran los cobros anulados', () => {
    const doc = aggregatePayments(D, [
      {
        status: 'VALIDO',
        method: 'EFECTIVO',
        amountCents: 15000,
        professionalId: 'diego',
        category: 'FISIOTERAPIA',
      },
      {
        status: 'VALIDO',
        method: 'QR',
        amountCents: 9000,
        professionalId: 'ana',
        category: 'ESTETICA',
      },
      {
        status: 'ANULADO',
        method: 'QR',
        amountCents: 9000,
        professionalId: 'ana',
        category: 'ESTETICA',
      },
    ]);
    expect(doc).toMatchObject({
      totalCents: 24000,
      count: 2,
      byMethod: { EFECTIVO: 15000, QR: 9000, TARJETA: 0 },
      byProfessional: { diego: 15000, ana: 9000 },
    });
  });
});

describe('resumen de un período', () => {
  const days: DailyStatsDoc[] = [
    {
      date: D,
      newClients: 2,
      cells: {
        [cellKey('diego', 'FISIOTERAPIA')]: {
          PENDIENTE: 0,
          CONFIRMADA: 0,
          ATENDIDA: 3,
          CANCELADA: 1,
          NO_ASISTIO: 1,
          attendedMinutes: 135,
        },
        [cellKey('carla', 'ESTETICA')]: {
          PENDIENTE: 1,
          CONFIRMADA: 0,
          ATENDIDA: 2,
          CANCELADA: 0,
          NO_ASISTIO: 0,
          attendedMinutes: 120,
        },
      },
    },
  ];

  it('suma todo y filtra por profesional o por área', () => {
    const all = summarizeStats(days, { professionalId: null, category: null });
    expect(all.totals).toMatchObject({ ATENDIDA: 5, CANCELADA: 1, attendedMinutes: 255 });
    expect(all.newClients).toBe(2);
    expect(Object.keys(all.byProfessional)).toEqual(['diego', 'carla']);

    const est = summarizeStats(days, { professionalId: null, category: 'ESTETICA' });
    expect(est.totals.ATENDIDA).toBe(2);
    expect(est.byDay.get(D)?.PENDIENTE).toBe(1);

    const diego = summarizeStats(days, { professionalId: 'diego', category: null });
    expect(diego.byCategory.ESTETICA).toBeUndefined();
  });

  it('calcula asistencia y cancelación sin dividir por cero', () => {
    const t = summarizeStats(days, { professionalId: null, category: null }).totals;
    expect(attendanceRate(t)).toBeCloseTo(5 / 6);
    expect(cancellationRate(t)).toBeCloseTo(1 / 8);
    expect(
      attendanceRate({ PENDIENTE: 1, CONFIRMADA: 0, ATENDIDA: 0, CANCELADA: 0, NO_ASISTIO: 0 }),
    ).toBeNull();
  });
});

describe('períodos', () => {
  it('agrupa por día, semana o mes según la extensión', () => {
    expect(granularityFor('2026-09-01', '2026-09-30')).toBe('day');
    expect(granularityFor('2026-07-01', '2026-09-30')).toBe('week');
    expect(granularityFor('2026-01-01', '2026-09-30')).toBe('month');
    expect(bucketsBetween('2026-09-28', '2026-10-06', 'week')).toEqual([
      '2026-09-28',
      '2026-10-05',
    ]);
    expect(bucketsBetween('2026-08-30', '2026-10-02', 'month')).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('el recálculo acepta hasta un año', () => {
    expect(
      rebuildReportsInputSchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success,
    ).toBe(true);
    expect(
      rebuildReportsInputSchema.safeParse({ from: '2025-01-01', to: '2026-12-31' }).success,
    ).toBe(false);
    expect(
      rebuildReportsInputSchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success,
    ).toBe(false);
  });
});
