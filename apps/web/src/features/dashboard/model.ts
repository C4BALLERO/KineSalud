import {
  addDays,
  remainingSessions,
  weekdayOf,
  WEEKDAY_LABELS,
  worksOn,
  type AppointmentStatus,
  type DateKey,
  type ProfessionalDoc,
  type ProfessionalExceptionDoc,
  type TreatmentCategory,
  type Weekday,
} from '@kinesalud/shared';

/**
 * Lógica pura del dashboard: recibe datos ya leídos y calcula resúmenes,
 * agenda y alertas. Sin dependencias de Firebase, así se prueba en aislamiento.
 */

export interface AppointmentItem {
  id: string;
  date: DateKey;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  clientName: string;
  professionalId: string;
  professionalName: string;
  serviceName: string;
  category: TreatmentCategory;
  roomName: string;
  sessionNumber: number | null;
  /** Ya tiene nota clínica de sesión. */
  sessionRecorded?: boolean;
}

export interface TreatmentItem {
  id: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  category: TreatmentCategory;
  plannedSessions: number;
  completedSessions: number;
}

export type StatusCounts = Record<AppointmentStatus, number>;

const emptyCounts = (): StatusCounts => ({
  PENDIENTE: 0,
  CONFIRMADA: 0,
  ATENDIDA: 0,
  CANCELADA: 0,
  NO_ASISTIO: 0,
});

/** Citas que siguen ocupando la agenda (las canceladas no cuentan). */
export const isScheduled = (a: AppointmentItem) => a.status !== 'CANCELADA';

export function countByStatus(items: AppointmentItem[]): StatusCounts {
  const counts = emptyCounts();
  for (const a of items) counts[a.status] += 1;
  return counts;
}

export function appointmentsOn(items: AppointmentItem[], day: DateKey): AppointmentItem[] {
  return items
    .filter((a) => a.date === day)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Primer día desde `from` (incluido) que tiene citas programadas. */
export function nextDayWithAppointments(items: AppointmentItem[], from: DateKey): DateKey | null {
  const days = [
    ...new Set(items.filter((a) => a.date >= from && isScheduled(a)).map((a) => a.date)),
  ];
  return days.sort()[0] ?? null;
}

/** Cita cuyo horario ya terminó y sigue sin registrar asistencia. */
export function isUnregistered(a: AppointmentItem, now: Date): boolean {
  return (
    (a.status === 'PENDIENTE' || a.status === 'CONFIRMADA') && a.endAt.getTime() < now.getTime()
  );
}

export interface WeekDaySummary {
  date: DateKey;
  weekday: Weekday;
  label: string;
  /** Citas programadas (sin canceladas). */
  total: number;
  counts: StatusCounts;
}

/** Resumen de lunes a sábado de la semana que empieza en `monday`. */
export function weekSummary(items: AppointmentItem[], monday: DateKey): WeekDaySummary[] {
  return Array.from({ length: 6 }, (_, i) => {
    const date = addDays(monday, i);
    const dayItems = items.filter((a) => a.date === date);
    const weekday = weekdayOf(date);
    return {
      date,
      weekday,
      label: WEEKDAY_LABELS[weekday],
      total: dayItems.filter(isScheduled).length,
      counts: countByStatus(dayItems),
    };
  });
}

export type AlertTone = 'warning' | 'info' | 'danger';

export interface DashboardAlert {
  id: string;
  tone: AlertTone;
  title: string;
  description: string;
  action: { label: string; to: string };
}

interface AlertInput {
  appointments: AppointmentItem[];
  treatments: TreatmentItem[];
  today: DateKey;
  now: Date;
  /** Etiqueta legible del próximo día hábil, p. ej. "el lunes 28". */
  formatDay: (day: DateKey) => string;
  /** Ficha del profesional de la sesión: avisa de sus sesiones atendidas sin nota. */
  recordsFor?: string | null;
  /** Recordatorios en la cola de recepción (solo para quien los gestiona). */
  pendingReminders?: number;
}

/** Alertas accionables, ordenadas por urgencia. Solo aparecen si hay algo que hacer. */
export function buildAlerts({
  appointments,
  treatments,
  today,
  now,
  formatDay,
  recordsFor = null,
  pendingReminders = 0,
}: AlertInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (pendingReminders > 0) {
    alerts.push({
      id: 'reminders',
      tone: 'warning',
      title: `${pendingReminders} ${pendingReminders === 1 ? 'recordatorio' : 'recordatorios'} por gestionar`,
      description: 'Contacta a cada cliente para confirmar o recordar su cita.',
      action: { label: 'Gestionar', to: '/recordatorios' },
    });
  }

  if (recordsFor) {
    const toRecord = appointments.filter(
      (a) =>
        a.professionalId === recordsFor &&
        a.status === 'ATENDIDA' &&
        a.date <= today &&
        a.sessionRecorded === false,
    );
    if (toRecord.length > 0) {
      alerts.push({
        id: 'sessions-to-record',
        tone: 'warning',
        title: `${toRecord.length} ${toRecord.length === 1 ? 'sesión atendida' : 'sesiones atendidas'} sin registrar`,
        description: 'Completa la nota clínica: observaciones, evolución y dolor.',
        action:
          toRecord.length === 1
            ? { label: 'Registrar', to: `/citas/${toRecord[0]!.id}/sesion` }
            : { label: 'Ver citas', to: `/agenda?fecha=${toRecord[0]!.date}` },
      });
    }
  }

  const unregistered = appointments.filter((a) => a.date === today && isUnregistered(a, now));
  if (unregistered.length > 0) {
    alerts.push({
      id: 'unregistered',
      tone: 'danger',
      title: `${unregistered.length} ${unregistered.length === 1 ? 'cita de hoy' : 'citas de hoy'} sin registrar asistencia`,
      description: 'El horario ya terminó. Marca si la persona asistió o no.',
      action: { label: 'Revisar', to: `/agenda?fecha=${today}` },
    });
  }

  const nextDay = nextDayWithAppointments(appointments, addDays(today, 1));
  if (nextDay) {
    const pending = appointments.filter((a) => a.date === nextDay && a.status === 'PENDIENTE');
    if (pending.length > 0) {
      alerts.push({
        id: 'pending-next-day',
        tone: 'warning',
        title: `${pending.length} ${pending.length === 1 ? 'cita' : 'citas'} sin confirmar ${formatDay(nextDay)}`,
        description: 'Confirma con cada cliente para reducir inasistencias.',
        action: { label: 'Ver citas', to: `/agenda?fecha=${nextDay}` },
      });
    }
  }

  const ending = treatments.filter((t) => remainingSessions(t) <= 1);
  if (ending.length > 0) {
    alerts.push({
      id: 'treatments-ending',
      tone: 'info',
      title: `${ending.length} ${ending.length === 1 ? 'tratamiento termina' : 'tratamientos terminan'} en su próxima sesión`,
      description: 'Revisa la evolución y decide si se finaliza o se extiende el plan.',
      action: { label: 'Ver tratamientos', to: '/tratamientos' },
    });
  }

  return alerts;
}

/** Profesionales activos que atienden hoy según su horario semanal y sus ausencias. */
export function availableToday(
  professionals: (Pick<ProfessionalDoc, 'active' | 'weeklySchedule'> & { id?: string })[],
  today: DateKey,
  exceptions: readonly Pick<
    ProfessionalExceptionDoc,
    'professionalId' | 'dateFrom' | 'dateTo' | 'type'
  >[] = [],
) {
  const active = professionals.filter((p) => p.active);
  const available = active.filter((p) =>
    worksOn(
      p,
      today,
      exceptions.filter((e) => e.professionalId === p.id),
    ),
  );
  return { available: available.length, total: active.length };
}
