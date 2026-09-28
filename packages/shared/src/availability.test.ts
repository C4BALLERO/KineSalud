import { describe, expect, it } from 'vitest';
import {
  canApplyAction,
  canReschedule,
  changeAppointmentStatusInputSchema,
  createAppointmentInputSchema,
} from './appointments';
import {
  checkSlot,
  findSlots,
  nearestSlots,
  workingRanges,
  type BookedAppointment,
  type DayContext,
} from './availability';
import { addDays, toDateKey } from './time';

// 2026-09-28 es lunes.
const MONDAY = '2026-09-28';
const morning = [{ start: '08:00', end: '12:00' }];

const lumbar = {
  id: 'srv-lumbar',
  category: 'FISIOTERAPIA' as const,
  roomKinds: ['CAMILLA' as const],
  durationMin: 45,
  bufferMin: 15,
  active: true,
};

function ctx(over: Partial<DayContext> = {}): DayContext {
  return {
    date: MONDAY,
    openingHours: {
      mon: [
        { start: '08:00', end: '12:00' },
        { start: '14:30', end: '18:30' },
      ],
    },
    slotMinutes: 15,
    professionals: [
      { id: 'diego', active: true, serviceIds: ['srv-lumbar'], weeklySchedule: { mon: morning } },
      { id: 'ana', active: true, serviceIds: ['srv-lumbar'], weeklySchedule: { mon: morning } },
    ],
    exceptions: [],
    rooms: [
      { id: 'c1', kind: 'CAMILLA', allowedCategories: ['FISIOTERAPIA'], active: true },
      { id: 'c2', kind: 'CAMILLA', allowedCategories: ['FISIOTERAPIA'], active: true },
    ],
    appointments: [],
    ...over,
  };
}

const booked = (over: Partial<BookedAppointment>): BookedAppointment => ({
  id: 'a1',
  professionalId: 'diego',
  roomId: 'c1',
  clientId: 'cli-1',
  status: 'CONFIRMADA',
  start: 9 * 60,
  end: 9 * 60 + 45,
  bufferMin: 15,
  ...over,
});

describe('checkSlot', () => {
  it('asigna el primer espacio compatible libre', () => {
    expect(checkSlot(ctx(), { service: lumbar, professionalId: 'diego', start: '08:00' })).toEqual({
      ok: true,
      roomId: 'c1',
      end: '08:45',
    });
  });

  it('la preparación ocupa al profesional después de la cita', () => {
    const c = ctx({ appointments: [booked({})] }); // 09:00–09:45 + 15
    const at = (start: string) => checkSlot(c, { service: lumbar, professionalId: 'diego', start });
    expect(at('09:45')).toEqual({ ok: false, conflict: 'PROFESSIONAL_BUSY' });
    expect(at('10:00').ok).toBe(true);
    // Una cita que terminaría (con preparación) justo cuando empieza la otra, cabe.
    expect(at('08:00').ok).toBe(true);
    expect(at('08:15')).toEqual({ ok: false, conflict: 'PROFESSIONAL_BUSY' });
  });

  it('las citas canceladas o de inasistencia no ocupan horario', () => {
    const c = ctx({
      appointments: [booked({ status: 'CANCELADA' }), booked({ id: 'a2', status: 'NO_ASISTIO' })],
    });
    expect(checkSlot(c, { service: lumbar, professionalId: 'diego', start: '09:00' }).ok).toBe(
      true,
    );
  });

  it('usa otro espacio si el primero está ocupado, y falla si no queda ninguno', () => {
    const one = ctx({ appointments: [booked({ professionalId: 'ana' })] });
    expect(
      checkSlot(one, { service: lumbar, professionalId: 'diego', start: '09:00' }),
    ).toMatchObject({
      ok: true,
      roomId: 'c2',
    });
    const both = ctx({
      appointments: [
        booked({ professionalId: 'ana' }),
        booked({ id: 'a2', professionalId: 'x', roomId: 'c2' }),
      ],
    });
    expect(checkSlot(both, { service: lumbar, professionalId: 'diego', start: '09:00' })).toEqual({
      ok: false,
      conflict: 'NO_ROOM',
    });
    expect(
      checkSlot(one, { service: lumbar, professionalId: 'diego', start: '09:00', roomId: 'c1' }),
    ).toEqual({ ok: false, conflict: 'ROOM_BUSY' });
  });

  it('el cliente no puede tener dos citas superpuestas', () => {
    const c = ctx({ appointments: [booked({ professionalId: 'ana', clientId: 'cli-1' })] });
    expect(
      checkSlot(c, { service: lumbar, professionalId: 'diego', start: '09:30', clientId: 'cli-1' }),
    ).toEqual({ ok: false, conflict: 'CLIENT_BUSY' });
    // La preparación no ocupa al cliente.
    expect(
      checkSlot(c, { service: lumbar, professionalId: 'diego', start: '09:45', clientId: 'cli-1' })
        .ok,
    ).toBe(true);
  });

  it('al reprogramar, la cita no choca consigo misma', () => {
    const c = ctx({ appointments: [booked({})] });
    expect(
      checkSlot(c, {
        service: lumbar,
        professionalId: 'diego',
        start: '09:15',
        ignoreAppointmentId: 'a1',
      }).ok,
    ).toBe(true);
  });

  it('respeta jornada, consultorio, ausencias, servicios y horarios pasados', () => {
    const at = (c: DayContext, start: string, professionalId = 'diego') =>
      checkSlot(c, { service: lumbar, professionalId, start });
    expect(at(ctx(), '11:30')).toEqual({ ok: false, conflict: 'OUTSIDE_SCHEDULE' });
    expect(at(ctx(), '07:30')).toEqual({ ok: false, conflict: 'OUTSIDE_SCHEDULE' });
    expect(
      at(
        ctx({
          exceptions: [
            { professionalId: 'diego', dateFrom: MONDAY, dateTo: MONDAY, type: 'PERMISO' },
          ],
        }),
        '09:00',
      ),
    ).toEqual({ ok: false, conflict: 'PROFESSIONAL_ABSENT' });
    expect(at(ctx({ nowMinutes: 10 * 60 }), '09:00')).toEqual({ ok: false, conflict: 'PAST' });
    const noService = ctx({
      professionals: [
        { id: 'diego', active: true, serviceIds: [], weeklySchedule: { mon: morning } },
      ],
    });
    expect(at(noService, '09:00')).toEqual({ ok: false, conflict: 'SERVICE_NOT_OFFERED' });
    expect(at(ctx(), '09:00', 'nadie')).toEqual({ ok: false, conflict: 'PROFESSIONAL_NOT_FOUND' });
    expect(
      checkSlot(ctx(), {
        service: { ...lumbar, active: false },
        professionalId: 'diego',
        start: '09:00',
      }),
    ).toEqual({ ok: false, conflict: 'SERVICE_INACTIVE' });
  });

  it('el horario del profesional se recorta al del consultorio', () => {
    const c = ctx({ openingHours: { mon: [{ start: '09:00', end: '11:00' }] } });
    expect(workingRanges(c.professionals[0]!, c)).toEqual([{ start: '09:00', end: '11:00' }]);
    expect(checkSlot(c, { service: lumbar, professionalId: 'diego', start: '08:30' })).toEqual({
      ok: false,
      conflict: 'OUTSIDE_SCHEDULE',
    });
  });
});

describe('findSlots', () => {
  it('ofrece inicios alineados a la grilla que caben en la jornada', () => {
    const slots = findSlots(ctx(), { service: lumbar, professionalId: 'diego' });
    expect(slots[0]).toEqual({
      start: '08:00',
      end: '08:45',
      professionalId: 'diego',
      roomId: 'c1',
    });
    expect(slots.at(-1)?.start).toBe('11:15');
    expect(slots).toHaveLength(14); // 08:00 … 11:15 cada 15 min
  });

  it('descuenta la ocupación y combina profesionales', () => {
    const c = ctx({ appointments: [booked({})] });
    const diego = findSlots(c, { service: lumbar, professionalId: 'diego' }).map((s) => s.start);
    expect(diego).not.toContain('08:30');
    expect(diego).not.toContain('09:30');
    expect(diego).toContain('10:00');
    const all = findSlots(c, { service: lumbar });
    expect(all.filter((s) => s.start === '09:00').map((s) => s.professionalId)).toEqual(['ana']);
  });

  it('sugiere las alternativas más cercanas en orden horario', () => {
    const slots = findSlots(ctx({ appointments: [booked({})] }), {
      service: lumbar,
      professionalId: 'diego',
    });
    expect(nearestSlots(slots, '09:00').map((s) => s.start)).toEqual(['08:00', '10:00', '10:15']);
  });
});

describe('estados de la cita', () => {
  const start = new Date('2026-09-28T09:00:00-04:00');
  const before = new Date('2026-09-28T08:00:00-04:00');
  const after = new Date('2026-09-28T09:10:00-04:00');

  it('la asistencia se registra desde la hora de inicio', () => {
    expect(canApplyAction({ status: 'PENDIENTE', startAt: start }, 'ATENDER', before).ok).toBe(
      false,
    );
    expect(canApplyAction({ status: 'PENDIENTE', startAt: start }, 'ATENDER', after).ok).toBe(true);
    expect(canApplyAction({ status: 'CONFIRMADA', startAt: start }, 'NO_ASISTIO', after).ok).toBe(
      true,
    );
    expect(canApplyAction({ status: 'PENDIENTE', startAt: start }, 'CONFIRMAR', before).ok).toBe(
      true,
    );
  });

  it('los estados finales no cambian desde la agenda', () => {
    for (const status of ['ATENDIDA', 'NO_ASISTIO', 'CANCELADA'] as const) {
      expect(canApplyAction({ status, startAt: start }, 'CANCELAR', after).ok).toBe(false);
      expect(canReschedule({ status }).ok).toBe(false);
    }
    expect(canApplyAction({ status: 'CONFIRMADA', startAt: start }, 'CONFIRMAR', before).ok).toBe(
      false,
    );
  });

  it('cancelar exige motivo y no se agenda en fechas pasadas', () => {
    const cancel = changeAppointmentStatusInputSchema.safeParse({
      appointmentId: 'a',
      action: 'CANCELAR',
    });
    expect(cancel.error?.issues[0]?.message).toBe('Indica el motivo de la cancelación.');
    const today = toDateKey(new Date());
    const base = { clientId: 'c', serviceId: 's', professionalId: 'p', start: '09:00' };
    expect(
      createAppointmentInputSchema.safeParse({ ...base, date: addDays(today, -1) }).success,
    ).toBe(false);
    expect(createAppointmentInputSchema.parse({ ...base, date: today })).toMatchObject({
      status: 'PENDIENTE',
      roomId: null,
      notes: null,
    });
  });
});
