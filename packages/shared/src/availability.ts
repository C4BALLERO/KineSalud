import type { ProfessionalDoc, RoomDoc, ServiceDoc, TimeRange, WeeklySchedule } from './domain';
import { BLOCKING_APPOINTMENT_STATUSES, type AppointmentStatus } from './enums';
import { minutesToTime, timeToMinutes } from './schedule';
import { compatibleRooms } from './settings';
import { dayAvailability, type ProfessionalExceptionDoc } from './staff';
import { weekdayOf, type DateKey } from './time';

/**
 * Algoritmo de disponibilidad (puro). Lo usa la web para ofrecer horarios y
 * Cloud Functions para validar dentro de la transacción: una sola fuente de
 * verdad para "¿se puede agendar aquí?".
 *
 * Todas las horas se manejan en minutos desde la medianoche local del día.
 */

/** Cita ya agendada, reducida a lo que importa para ocupar horario. */
export interface BookedAppointment {
  id: string;
  professionalId: string;
  roomId: string;
  clientId: string;
  status: AppointmentStatus;
  /** Minutos desde la medianoche local. */
  start: number;
  end: number;
  /** Preparación posterior: ocupa al profesional y al espacio, no al cliente. */
  bufferMin: number;
}

export type AvailabilityProfessional = Pick<
  ProfessionalDoc,
  'active' | 'weeklySchedule' | 'serviceIds'
> & { id: string };
export type AvailabilityRoom = Pick<RoomDoc, 'kind' | 'allowedCategories' | 'active'> & {
  id: string;
};
export type AvailabilityService = Pick<
  ServiceDoc,
  'category' | 'roomKinds' | 'durationMin' | 'bufferMin' | 'active'
> & { id: string };

export interface DayContext {
  date: DateKey;
  openingHours: WeeklySchedule;
  slotMinutes: number;
  professionals: readonly AvailabilityProfessional[];
  exceptions: readonly Pick<
    ProfessionalExceptionDoc,
    'professionalId' | 'dateFrom' | 'dateTo' | 'type'
  >[];
  rooms: readonly AvailabilityRoom[];
  /** Citas del día (cualquier estado; se filtran las que ocupan horario). */
  appointments: readonly BookedAppointment[];
  /** Minutos transcurridos del día si la fecha es hoy (no se ofrecen horarios pasados). */
  nowMinutes?: number | null;
}

export interface SlotRequest {
  service: AvailabilityService;
  clientId?: string | null;
  /** Cita que se reprograma: no se cuenta contra sí misma. */
  ignoreAppointmentId?: string | null;
}

export interface Slot {
  start: string;
  end: string;
  professionalId: string;
  roomId: string;
}

export const SLOT_CONFLICTS = {
  SERVICE_INACTIVE: 'El servicio está desactivado.',
  PROFESSIONAL_NOT_FOUND: 'El profesional no existe.',
  PROFESSIONAL_INACTIVE: 'El profesional está inactivo.',
  SERVICE_NOT_OFFERED: 'El profesional no realiza este servicio.',
  PROFESSIONAL_ABSENT:
    'El profesional está ausente ese día (vacaciones, permiso o agenda bloqueada).',
  OUTSIDE_SCHEDULE: 'El horario está fuera de la jornada del profesional o del consultorio.',
  PAST: 'Ese horario ya pasó.',
  PROFESSIONAL_BUSY: 'El profesional ya tiene otra cita en ese horario.',
  NO_ROOM: 'No hay un espacio compatible libre en ese horario.',
  ROOM_BUSY: 'El espacio elegido está ocupado en ese horario.',
  CLIENT_BUSY: 'El cliente ya tiene otra cita en ese horario.',
} as const;
export type SlotConflict = keyof typeof SLOT_CONFLICTS;

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

function blocking(ctx: DayContext, ignoreId: string | null | undefined) {
  return ctx.appointments.filter(
    (a) => a.id !== ignoreId && BLOCKING_APPOINTMENT_STATUSES.includes(a.status),
  );
}

/** Intersección de los tramos del profesional con el horario del consultorio. */
export function workingRanges(
  professional: AvailabilityProfessional,
  ctx: Pick<DayContext, 'date' | 'openingHours' | 'exceptions'>,
): TimeRange[] {
  const own = ctx.exceptions.filter((e) => e.professionalId === professional.id);
  const a = dayAvailability(professional, own, ctx.date);
  if (a.kind !== 'working') return [];
  const opening = ctx.openingHours[weekdayOf(ctx.date)] ?? [];
  const out: TimeRange[] = [];
  for (const r of a.ranges) {
    for (const o of opening) {
      const start = Math.max(timeToMinutes(r.start), timeToMinutes(o.start));
      const end = Math.min(timeToMinutes(r.end), timeToMinutes(o.end));
      if (start < end) out.push({ start: minutesToTime(start), end: minutesToTime(end) });
    }
  }
  return out;
}

/**
 * Comprueba un horario concreto. Devuelve el espacio asignado o el primer
 * conflicto encontrado, en el orden en que conviene explicárselo a quien agenda.
 */
export function checkSlot(
  ctx: DayContext,
  request: SlotRequest & { professionalId: string; start: string; roomId?: string | null },
): { ok: true; roomId: string; end: string } | { ok: false; conflict: SlotConflict } {
  const { service } = request;
  if (!service.active) return { ok: false, conflict: 'SERVICE_INACTIVE' };
  const professional = ctx.professionals.find((p) => p.id === request.professionalId);
  if (!professional) return { ok: false, conflict: 'PROFESSIONAL_NOT_FOUND' };
  if (!professional.active) return { ok: false, conflict: 'PROFESSIONAL_INACTIVE' };
  if (!professional.serviceIds.includes(service.id)) {
    return { ok: false, conflict: 'SERVICE_NOT_OFFERED' };
  }
  const own = ctx.exceptions.filter((e) => e.professionalId === professional.id);
  if (dayAvailability(professional, own, ctx.date).kind === 'absent') {
    return { ok: false, conflict: 'PROFESSIONAL_ABSENT' };
  }

  const start = timeToMinutes(request.start);
  const end = start + service.durationMin;
  const blockEnd = end + service.bufferMin;
  const ranges = workingRanges(professional, ctx);
  const fits = ranges.some((r) => start >= timeToMinutes(r.start) && end <= timeToMinutes(r.end));
  if (!fits) return { ok: false, conflict: 'OUTSIDE_SCHEDULE' };
  if (ctx.nowMinutes != null && start < ctx.nowMinutes) return { ok: false, conflict: 'PAST' };

  const booked = blocking(ctx, request.ignoreAppointmentId);
  const professionalBusy = booked.some(
    (a) =>
      a.professionalId === professional.id &&
      overlaps(start, blockEnd, a.start, a.end + a.bufferMin),
  );
  if (professionalBusy) return { ok: false, conflict: 'PROFESSIONAL_BUSY' };

  if (request.clientId) {
    const clientBusy = booked.some(
      (a) => a.clientId === request.clientId && overlaps(start, end, a.start, a.end),
    );
    if (clientBusy) return { ok: false, conflict: 'CLIENT_BUSY' };
  }

  const roomFree = (roomId: string) =>
    !booked.some(
      (a) => a.roomId === roomId && overlaps(start, blockEnd, a.start, a.end + a.bufferMin),
    );
  const candidates = compatibleRooms(service, ctx.rooms);
  if (request.roomId) {
    if (!candidates.some((r) => r.id === request.roomId)) return { ok: false, conflict: 'NO_ROOM' };
    if (!roomFree(request.roomId)) return { ok: false, conflict: 'ROOM_BUSY' };
    return { ok: true, roomId: request.roomId, end: minutesToTime(end) };
  }
  const room = candidates.find((r) => roomFree(r.id));
  if (!room) return { ok: false, conflict: 'NO_ROOM' };
  return { ok: true, roomId: room.id, end: minutesToTime(end) };
}

/**
 * Horarios libres del día para un servicio, por profesional. Los inicios se
 * alinean a la grilla del consultorio (`slotMinutes`) dentro de cada tramo.
 */
export function findSlots(
  ctx: DayContext,
  request: SlotRequest & { professionalId?: string | null },
): Slot[] {
  if (!request.service.active) return [];
  const slots: Slot[] = [];
  const professionals = ctx.professionals.filter(
    (p) =>
      (!request.professionalId || p.id === request.professionalId) &&
      p.active &&
      p.serviceIds.includes(request.service.id),
  );
  for (const p of professionals) {
    for (const range of workingRanges(p, ctx)) {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);
      // Primer inicio alineado a la grilla dentro del tramo.
      let t = Math.ceil(rangeStart / ctx.slotMinutes) * ctx.slotMinutes;
      for (; t + request.service.durationMin <= rangeEnd; t += ctx.slotMinutes) {
        const start = minutesToTime(t);
        const result = checkSlot(ctx, { ...request, professionalId: p.id, start });
        if (result.ok)
          slots.push({ start, end: result.end, professionalId: p.id, roomId: result.roomId });
      }
    }
  }
  return slots.sort(
    (a, b) => a.start.localeCompare(b.start) || a.professionalId.localeCompare(b.professionalId),
  );
}

/** Los `limit` horarios libres más cercanos a una hora (para sugerir alternativas). */
export const NO_SLOTS_REASONS = {
  SERVICE_INACTIVE: 'El servicio está desactivado.',
  NO_PROFESSIONAL: 'Ningún profesional activo realiza este servicio.',
  NO_ROOM: 'No hay un espacio activo compatible con este servicio.',
  CLINIC_CLOSED: 'El consultorio no atiende ese día.',
  NOBODY_WORKS: 'Nadie que realice este servicio atiende ese día.',
  FULLY_BOOKED: 'Todos los horarios de ese día están ocupados o ya pasaron.',
} as const;
export type NoSlotsReason = keyof typeof NO_SLOTS_REASONS;

/**
 * Por qué `findSlots` no devolvió horarios: el primer motivo que conviene
 * corregir, del más estructural (catálogo) al más circunstancial (agenda llena).
 */
export function explainNoSlots(
  ctx: DayContext,
  request: SlotRequest & { professionalId?: string | null },
): NoSlotsReason {
  const { service } = request;
  if (!service.active) return 'SERVICE_INACTIVE';
  const professionals = ctx.professionals.filter(
    (p) =>
      (!request.professionalId || p.id === request.professionalId) &&
      p.active &&
      p.serviceIds.includes(service.id),
  );
  if (professionals.length === 0) return 'NO_PROFESSIONAL';
  if (compatibleRooms(service, ctx.rooms).length === 0) return 'NO_ROOM';
  if ((ctx.openingHours[weekdayOf(ctx.date)] ?? []).length === 0) return 'CLINIC_CLOSED';
  const someoneFits = professionals.some((p) =>
    workingRanges(p, ctx).some(
      (r) => timeToMinutes(r.end) - timeToMinutes(r.start) >= service.durationMin,
    ),
  );
  return someoneFits ? 'FULLY_BOOKED' : 'NOBODY_WORKS';
}

export function nearestSlots(slots: readonly Slot[], around: string, limit = 3): Slot[] {
  const target = timeToMinutes(around);
  return [...slots]
    .sort(
      (a, b) =>
        Math.abs(timeToMinutes(a.start) - target) - Math.abs(timeToMinutes(b.start) - target) ||
        a.start.localeCompare(b.start),
    )
    .slice(0, limit)
    .sort((a, b) => a.start.localeCompare(b.start));
}
