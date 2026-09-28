import { describe, expect, it } from 'vitest';
import {
  availableToday,
  buildAlerts,
  countByStatus,
  isUnregistered,
  nextDayWithAppointments,
  weekSummary,
  type AppointmentItem,
  type TreatmentItem,
} from './model';

const base: Omit<AppointmentItem, 'id' | 'date' | 'startAt' | 'endAt' | 'status'> = {
  clientName: 'Carla Rojas',
  professionalId: 'prof-diego',
  professionalName: 'Lic. Diego Pérez',
  serviceName: 'Fisioterapia lumbar',
  category: 'FISIOTERAPIA',
  roomName: 'Camilla 1',
  sessionNumber: null,
};

function apt(
  id: string,
  date: string,
  time: string,
  status: AppointmentItem['status'],
): AppointmentItem {
  const startAt = new Date(`${date}T${time}:00-04:00`);
  return { ...base, id, date, startAt, endAt: new Date(startAt.getTime() + 45 * 60_000), status };
}

const treatment = (id: string, planned: number, done: number): TreatmentItem => ({
  id,
  clientName: 'X',
  professionalName: 'Y',
  serviceName: 'Z',
  category: 'REHABILITACION',
  plannedSessions: planned,
  completedSessions: done,
});

describe('countByStatus', () => {
  it('cuenta cada estado', () => {
    const c = countByStatus([
      apt('1', '2026-09-28', '08:00', 'PENDIENTE'),
      apt('2', '2026-09-28', '09:00', 'PENDIENTE'),
      apt('3', '2026-09-28', '10:00', 'CANCELADA'),
    ]);
    expect(c).toMatchObject({ PENDIENTE: 2, CANCELADA: 1, ATENDIDA: 0 });
  });
});

describe('nextDayWithAppointments', () => {
  it('omite días que solo tienen citas canceladas', () => {
    const items = [
      apt('1', '2026-09-28', '08:00', 'CANCELADA'),
      apt('2', '2026-09-29', '08:00', 'PENDIENTE'),
    ];
    expect(nextDayWithAppointments(items, '2026-09-27')).toBe('2026-09-29');
  });

  it('devuelve null si no hay citas próximas', () => {
    expect(nextDayWithAppointments([], '2026-09-27')).toBeNull();
  });
});

describe('isUnregistered', () => {
  const now = new Date('2026-09-28T12:00:00-04:00');
  it('una cita confirmada cuyo horario terminó está sin registrar', () => {
    expect(isUnregistered(apt('1', '2026-09-28', '09:00', 'CONFIRMADA'), now)).toBe(true);
  });
  it('una cita atendida o futura no lo está', () => {
    expect(isUnregistered(apt('1', '2026-09-28', '09:00', 'ATENDIDA'), now)).toBe(false);
    expect(isUnregistered(apt('2', '2026-09-28', '15:00', 'PENDIENTE'), now)).toBe(false);
  });
});

describe('weekSummary', () => {
  it('resume de lunes a sábado sin contar canceladas en el total', () => {
    const week = weekSummary(
      [apt('1', '2026-09-28', '08:00', 'ATENDIDA'), apt('2', '2026-09-28', '09:00', 'CANCELADA')],
      '2026-09-28',
    );
    expect(week).toHaveLength(6);
    expect(week[0]).toMatchObject({ label: 'Lunes', total: 1 });
    expect(week[0]?.counts.CANCELADA).toBe(1);
    expect(week[5]?.label).toBe('Sábado');
  });
});

describe('buildAlerts', () => {
  const formatDay = (d: string) => `el día ${d}`;

  it('genera alertas solo cuando hay algo que hacer, por urgencia', () => {
    const alerts = buildAlerts({
      appointments: [
        apt('1', '2026-09-28', '08:00', 'CONFIRMADA'), // ya terminó, sin registrar
        apt('2', '2026-09-29', '09:00', 'PENDIENTE'),
        apt('3', '2026-09-29', '10:00', 'PENDIENTE'),
      ],
      treatments: [treatment('t1', 10, 9), treatment('t2', 10, 3)],
      today: '2026-09-28',
      now: new Date('2026-09-28T12:00:00-04:00'),
      formatDay,
    });
    expect(alerts.map((a) => a.id)).toEqual([
      'unregistered',
      'pending-next-day',
      'treatments-ending',
    ]);
    expect(alerts[1]?.title).toBe('2 citas sin confirmar el día 2026-09-29');
    expect(alerts[2]?.title).toBe('1 tratamiento termina en su próxima sesión');
  });

  it('sin pendientes no genera alertas', () => {
    expect(
      buildAlerts({
        appointments: [],
        treatments: [],
        today: '2026-09-28',
        now: new Date(),
        formatDay,
      }),
    ).toEqual([]);
  });
});

describe('availableToday', () => {
  it('cuenta profesionales activos que trabajan ese día', () => {
    const r = availableToday(
      [
        { active: true, weeklySchedule: { mon: [{ start: '08:00', end: '12:00' }] } },
        { active: true, weeklySchedule: { tue: [{ start: '08:00', end: '12:00' }] } },
        { active: false, weeklySchedule: { mon: [{ start: '08:00', end: '12:00' }] } },
      ],
      '2026-09-28',
    );
    expect(r).toEqual({ available: 1, total: 2 });
  });

  it('descuenta a quien está de vacaciones o con permiso', () => {
    const r = availableToday(
      [
        { id: 'p1', active: true, weeklySchedule: { mon: [{ start: '08:00', end: '12:00' }] } },
        { id: 'p2', active: true, weeklySchedule: { mon: [{ start: '08:00', end: '12:00' }] } },
      ],
      '2026-09-28',
      [{ professionalId: 'p2', dateFrom: '2026-09-25', dateTo: '2026-10-02', type: 'VACACIONES' }],
    );
    expect(r).toEqual({ available: 1, total: 2 });
  });
});
