import {
  APPOINTMENT_ACTIONS,
  canApplyAction,
  canReschedule,
  clinicMinutesOf,
  OPEN_APPOINTMENT_STATUSES,
  toDateKey,
  weekdayOf,
  workingRanges,
  timeToMinutes,
  type AppointmentAction,
  type BookedAppointment,
  type ClinicSettingsDoc,
  type DateKey,
  type DayContext,
  type SlotAlternative,
  type TimeRange,
} from '@kinesalud/shared';
import type { RoomItem } from '@/features/settings/api/catalog';
import { toAppError } from '@/lib/errors';
import type { ExceptionItem, ProfessionalItem } from '@/features/staff/api/staff';
import type { AgendaAppointment } from './api/appointments';

export type AgendaView = 'dia' | 'semana';

export function toBooked(a: AgendaAppointment): BookedAppointment {
  return {
    id: a.id,
    professionalId: a.professionalId,
    roomId: a.roomId,
    clientId: a.clientId,
    status: a.status,
    start: clinicMinutesOf(a.startAt),
    end: clinicMinutesOf(a.endAt),
    bufferMin: a.bufferMin,
  };
}

/** Contexto del algoritmo de disponibilidad a partir de los datos de la agenda. */
export function buildDayContext(input: {
  date: DateKey;
  clinic: Pick<ClinicSettingsDoc, 'openingHours' | 'slotMinutes'>;
  professionals: readonly ProfessionalItem[];
  exceptions: readonly ExceptionItem[];
  rooms: readonly RoomItem[];
  appointments: readonly AgendaAppointment[];
  now: Date;
}): DayContext {
  return {
    date: input.date,
    openingHours: input.clinic.openingHours,
    slotMinutes: input.clinic.slotMinutes,
    professionals: input.professionals,
    exceptions: input.exceptions,
    rooms: input.rooms,
    appointments: input.appointments.filter((a) => a.date === input.date).map(toBooked),
    nowMinutes: input.date === toDateKey(input.now) ? clinicMinutesOf(input.now) : null,
  };
}

/* ---------- Geometría de la grilla ---------- */

/** Alto de una hora en la grilla (px). 15 min = 16 px: bloques de 45 min legibles. */
export const HOUR_HEIGHT = 64;

export interface GridBounds {
  /** Minuto del día donde empieza la grilla (hora en punto). */
  start: number;
  end: number;
}

/**
 * Rango visible del día: el horario del consultorio y cualquier cita fuera de
 * él (para no ocultar datos), redondeado a horas completas.
 */
export function gridBounds(
  openingRanges: readonly TimeRange[],
  appointments: readonly AgendaAppointment[],
): GridBounds {
  const starts = openingRanges.map((r) => timeToMinutes(r.start));
  const ends = openingRanges.map((r) => timeToMinutes(r.end));
  for (const a of appointments) {
    starts.push(clinicMinutesOf(a.startAt));
    ends.push(clinicMinutesOf(a.endAt));
  }
  if (starts.length === 0) return { start: 8 * 60, end: 18 * 60 };
  return {
    start: Math.floor(Math.min(...starts) / 60) * 60,
    end: Math.ceil(Math.max(...ends) / 60) * 60,
  };
}

export const minutesToPx = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;

/**
 * Reparte en carriles las citas que se superponen dentro de una columna (p. ej.
 * una cancelada y la que ocupó su lugar), para que ninguna tape a otra.
 */
export function assignLanes<T extends { startAt: Date; endAt: Date }>(
  items: readonly T[],
): { item: T; lane: number; lanes: number }[] {
  const sorted = [...items].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime() || b.endAt.getTime() - a.endAt.getTime(),
  );
  const result: { item: T; lane: number; lanes: number }[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) result.push({ ...c, lanes });
    cluster = [];
  };
  for (const item of sorted) {
    if (item.startAt.getTime() >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    const laneEnds: number[] = [];
    for (const c of cluster) {
      laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -Infinity, c.item.endAt.getTime());
    }
    let lane = laneEnds.findIndex((end) => end <= item.startAt.getTime());
    if (lane === -1) lane = laneEnds.length;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.endAt.getTime());
  }
  flush();
  return result;
}

/** Tramos en que un profesional atiende ese día (ya recortados al consultorio). */
export function professionalRanges(
  professional: ProfessionalItem,
  exceptions: readonly ExceptionItem[],
  clinic: Pick<ClinicSettingsDoc, 'openingHours'>,
  date: DateKey,
): TimeRange[] {
  return workingRanges(professional, { date, openingHours: clinic.openingHours, exceptions });
}

export function openingRangesOn(
  clinic: Pick<ClinicSettingsDoc, 'openingHours'> | null,
  date: DateKey,
): TimeRange[] {
  return clinic?.openingHours[weekdayOf(date)] ?? [];
}

/* ---------- Acciones disponibles para quien mira la cita ---------- */

export interface AppointmentPermissions {
  /** Agendar, reprogramar y cancelar (recepción y administración). */
  manageAll: boolean;
  /** Confirmar: recepción/administración o el profesional de la cita. */
  canConfirm: boolean;
  /** Registrar asistencia: recepción/administración o el profesional de la cita. */
  canMarkAttendance: boolean;
  canCorrect: boolean;
}

export interface ActionState {
  action: AppointmentAction;
  enabled: boolean;
  reason: string | null;
}

/** Acciones de estado visibles para esta persona y cuáles están habilitadas ahora. */
export function availableActions(
  appointment: Pick<AgendaAppointment, 'status' | 'startAt'>,
  permissions: AppointmentPermissions,
  now: Date,
): ActionState[] {
  // Las citas cerradas solo se corrigen (administración), no se operan desde aquí.
  if (!OPEN_APPOINTMENT_STATUSES.includes(appointment.status)) return [];
  return APPOINTMENT_ACTIONS.filter((action) => {
    if (action === 'CANCELAR') return permissions.manageAll;
    if (action === 'CONFIRMAR') return permissions.canConfirm && appointment.status === 'PENDIENTE';
    return permissions.canMarkAttendance;
  }).map((action) => {
    // La asistencia se muestra deshabilitada antes de la hora, con el motivo.
    const check = canApplyAction(appointment, action, now);
    return { action, enabled: check.ok, reason: check.ok ? null : check.reason };
  });
}

export function canRescheduleNow(
  appointment: Pick<AgendaAppointment, 'status'>,
  permissions: AppointmentPermissions,
): boolean {
  return permissions.manageAll && canReschedule(appointment).ok;
}

/** Alternativas que devuelve el servidor cuando el horario elegido ya no está libre. */
export function alternativesOf(err: unknown): SlotAlternative[] {
  const alts = toAppError(err).details?.alternatives;
  return Array.isArray(alts) ? (alts as SlotAlternative[]) : [];
}
