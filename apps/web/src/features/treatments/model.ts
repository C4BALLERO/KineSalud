import {
  normalizeSearchText,
  remainingSessions,
  type TreatmentCategory,
  type TreatmentStatus,
} from '@kinesalud/shared';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import type { TreatmentItem } from './api/treatments';

/* ---------- Listado ---------- */

export type StatusFilter = TreatmentStatus | 'TODOS';

export interface TreatmentFilters {
  search: string;
  category: TreatmentCategory | null;
  professionalId: string | null;
  /** Solo activos a los que les quedan 2 sesiones o menos. */
  ending: boolean;
}

/** Un tratamiento está "por terminar" cuando le quedan 2 sesiones o menos. */
export function isEnding(
  t: Pick<TreatmentItem, 'status' | 'plannedSessions' | 'completedSessions'>,
) {
  return t.status === 'ACTIVO' && remainingSessions(t) <= 2;
}

export function filterTreatments(
  items: readonly TreatmentItem[],
  f: TreatmentFilters,
): TreatmentItem[] {
  const terms = normalizeSearchText(f.search).split(/\s+/).filter(Boolean);
  return items
    .filter((t) => {
      if (f.category && t.category !== f.category) return false;
      if (f.professionalId && t.professionalId !== f.professionalId) return false;
      if (f.ending && !isEnding(t)) return false;
      if (terms.length > 0) {
        const haystack = normalizeSearchText(`${t.clientName} ${t.serviceName}`);
        if (!terms.every((term) => haystack.includes(term))) return false;
      }
      return true;
    })
    .sort(
      // Los más avanzados primero entre los activos; luego por inicio más reciente.
      (a, b) =>
        remainingSessions(a) - remainingSessions(b) || b.startDate.localeCompare(a.startDate),
    );
}

/* ---------- Línea de tiempo ---------- */

export type TimelineItem =
  | { kind: 'appointment'; appointment: AgendaAppointment }
  /** Sesiones previstas que todavía no tienen cita. */
  | { kind: 'unscheduled'; count: number; from: number };

export interface TreatmentProgress {
  timeline: TimelineItem[];
  /** Citas pendientes o confirmadas. */
  scheduled: number;
  unscheduled: number;
  next: AgendaAppointment | null;
  last: AgendaAppointment | null;
  noShows: number;
}

const OPEN = new Set(['PENDIENTE', 'CONFIRMADA']);

/**
 * Sesiones del tratamiento en orden: las realizadas, las perdidas o canceladas
 * (atenuadas), las agendadas y, al final, cuántas faltan agendar.
 */
export function treatmentProgress(
  t: Pick<TreatmentItem, 'plannedSessions' | 'completedSessions' | 'status'>,
  appointments: readonly AgendaAppointment[],
): TreatmentProgress {
  const sorted = [...appointments].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const upcoming = sorted.filter((a) => OPEN.has(a.status));
  const attended = sorted.filter((a) => a.status === 'ATENDIDA');
  const unscheduled =
    t.status === 'ACTIVO'
      ? Math.max(0, t.plannedSessions - t.completedSessions - upcoming.length)
      : 0;

  const timeline: TimelineItem[] = sorted.map((appointment) => ({
    kind: 'appointment',
    appointment,
  }));
  if (unscheduled > 0) {
    timeline.push({
      kind: 'unscheduled',
      count: unscheduled,
      from: t.completedSessions + upcoming.length + 1,
    });
  }

  return {
    timeline,
    scheduled: upcoming.length,
    unscheduled,
    next: upcoming[0] ?? null,
    last: attended.at(-1) ?? null,
    noShows: sorted.filter((a) => a.status === 'NO_ASISTIO').length,
  };
}
