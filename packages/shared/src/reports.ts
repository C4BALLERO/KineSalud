import { z } from 'zod';
import { APPOINTMENT_STATUSES, type AppointmentStatus, type TreatmentCategory } from './enums';
import { emptyMethodTotals, type Cents, type MethodTotals, type PaymentMethod } from './payments';
import { addDays, startOfWeek, type DateKey } from './time';

/**
 * Reportes. Las citas y los cobros de cada día se resumen en documentos
 * diarios (`dailyStats/{fecha}` y `dailyIncome/{fecha}`) que recalcula un
 * trigger a partir de los datos originales: un reporte de un año lee ~365
 * documentos en lugar de miles de citas.
 */

export type StatusCounts = Record<AppointmentStatus, number>;

export function emptyStatusCounts(): StatusCounts {
  return { PENDIENTE: 0, CONFIRMADA: 0, ATENDIDA: 0, CANCELADA: 0, NO_ASISTIO: 0 };
}

/** Citas de un profesional en un área, en un día. */
export interface StatsCell extends StatusCounts {
  /** Minutos de sesiones atendidas (carga de trabajo). */
  attendedMinutes: number;
}

/** Documento `dailyStats/{YYYY-MM-DD}`: citas del día por profesional y área. */
export interface DailyStatsDoc {
  date: DateKey;
  /** Clave: `professionalId__CATEGORIA` (ver `cellKey`). */
  cells: Record<string, StatsCell>;
  /** Clientes registrados ese día. */
  newClients: number;
}

/** Documento `dailyIncome/{YYYY-MM-DD}` (solo administración). */
export interface DailyIncomeDoc {
  date: DateKey;
  totalCents: Cents;
  count: number;
  byMethod: MethodTotals;
  byProfessional: Record<string, Cents>;
  byCategory: Partial<Record<TreatmentCategory, Cents>>;
}

const SEPARATOR = '__';

export function cellKey(professionalId: string, category: TreatmentCategory): string {
  return `${professionalId}${SEPARATOR}${category}`;
}

export function parseCellKey(key: string): { professionalId: string; category: TreatmentCategory } {
  const at = key.lastIndexOf(SEPARATOR);
  return {
    professionalId: key.slice(0, at),
    category: key.slice(at + SEPARATOR.length) as TreatmentCategory,
  };
}

/* ---------- Agregación (servidor) ---------- */

export function aggregateAppointments(
  appointments: readonly {
    professionalId: string;
    category: TreatmentCategory;
    status: AppointmentStatus;
    startAt: Date;
    endAt: Date;
  }[],
): Record<string, StatsCell> {
  const cells: Record<string, StatsCell> = {};
  for (const a of appointments) {
    const key = cellKey(a.professionalId, a.category);
    const cell = (cells[key] ??= { ...emptyStatusCounts(), attendedMinutes: 0 });
    cell[a.status] += 1;
    if (a.status === 'ATENDIDA') {
      cell.attendedMinutes += Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60_000);
    }
  }
  return cells;
}

export function aggregatePayments(
  date: DateKey,
  payments: readonly {
    status: string;
    method: PaymentMethod;
    amountCents: Cents;
    professionalId: string;
    category: TreatmentCategory;
  }[],
): DailyIncomeDoc {
  const doc: DailyIncomeDoc = {
    date,
    totalCents: 0,
    count: 0,
    byMethod: emptyMethodTotals(),
    byProfessional: {},
    byCategory: {},
  };
  for (const p of payments) {
    if (p.status !== 'VALIDO') continue;
    doc.totalCents += p.amountCents;
    doc.count += 1;
    doc.byMethod[p.method] += p.amountCents;
    doc.byProfessional[p.professionalId] =
      (doc.byProfessional[p.professionalId] ?? 0) + p.amountCents;
    doc.byCategory[p.category] = (doc.byCategory[p.category] ?? 0) + p.amountCents;
  }
  return doc;
}

/* ---------- Resumen de un período (web) ---------- */

export interface ReportFilter {
  professionalId: string | null;
  category: TreatmentCategory | null;
}

export interface WorkloadRow extends StatusCounts {
  attendedMinutes: number;
}

export interface StatsSummary {
  totals: WorkloadRow;
  byDay: Map<DateKey, StatusCounts>;
  byCategory: Partial<Record<TreatmentCategory, StatusCounts>>;
  byProfessional: Record<string, WorkloadRow>;
  newClients: number;
}

function addCounts(target: StatusCounts, source: StatusCounts) {
  for (const s of APPOINTMENT_STATUSES) target[s] += source[s] ?? 0;
}

/** Suma los días del período aplicando los filtros de profesional y área. */
export function summarizeStats(days: readonly DailyStatsDoc[], filter: ReportFilter): StatsSummary {
  const summary: StatsSummary = {
    totals: { ...emptyStatusCounts(), attendedMinutes: 0 },
    byDay: new Map(),
    byCategory: {},
    byProfessional: {},
    newClients: 0,
  };
  for (const day of days) {
    summary.newClients += day.newClients ?? 0;
    const dayCounts = emptyStatusCounts();
    for (const [key, cell] of Object.entries(day.cells ?? {})) {
      const { professionalId, category } = parseCellKey(key);
      if (filter.professionalId && professionalId !== filter.professionalId) continue;
      if (filter.category && category !== filter.category) continue;
      addCounts(dayCounts, cell);
      addCounts(summary.totals, cell);
      summary.totals.attendedMinutes += cell.attendedMinutes ?? 0;
      addCounts((summary.byCategory[category] ??= emptyStatusCounts()), cell);
      const pro = (summary.byProfessional[professionalId] ??= {
        ...emptyStatusCounts(),
        attendedMinutes: 0,
      });
      addCounts(pro, cell);
      pro.attendedMinutes += cell.attendedMinutes ?? 0;
    }
    summary.byDay.set(day.date, dayCounts);
  }
  return summary;
}

export function totalAppointments(c: StatusCounts): number {
  return APPOINTMENT_STATUSES.reduce((sum, s) => sum + c[s], 0);
}

/** Asistencia: atendidas sobre las que ya se resolvieron (atendidas + no asistió). */
export function attendanceRate(c: StatusCounts): number | null {
  const resolved = c.ATENDIDA + c.NO_ASISTIO;
  return resolved === 0 ? null : c.ATENDIDA / resolved;
}

export function cancellationRate(c: StatusCounts): number | null {
  const total = totalAppointments(c);
  return total === 0 ? null : c.CANCELADA / total;
}

/* ---------- Períodos ---------- */

export const MAX_REPORT_DAYS = 366;

export type Granularity = 'day' | 'week' | 'month';

export function daysBetween(from: DateKey, to: DateKey): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

/** Hasta un mes, por día; hasta ~4 meses, por semana; más, por mes. */
export function granularityFor(from: DateKey, to: DateKey): Granularity {
  const days = daysBetween(from, to);
  if (days <= 31) return 'day';
  if (days <= 124) return 'week';
  return 'month';
}

/** Clave del grupo al que pertenece un día: el mismo día, su lunes o `YYYY-MM`. */
export function bucketOf(date: DateKey, granularity: Granularity): string {
  if (granularity === 'day') return date;
  if (granularity === 'week') return startOfWeek(date);
  return date.slice(0, 7);
}

/** Grupos del período en orden, incluidos los que no tienen datos. */
export function bucketsBetween(from: DateKey, to: DateKey, granularity: Granularity): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const b = bucketOf(d, granularity);
    if (out.at(-1) !== b) out.push(b);
  }
  return out;
}

/* ---------- Comando de recálculo ---------- */

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida.');

export const rebuildReportsInputSchema = z
  .object({ from: dateKeySchema, to: dateKeySchema })
  .refine((r) => r.from <= r.to, { message: 'El inicio debe ser anterior al fin.', path: ['to'] })
  .refine((r) => daysBetween(r.from, r.to) <= MAX_REPORT_DAYS, {
    message: `El período no puede superar ${MAX_REPORT_DAYS} días.`,
    path: ['to'],
  });
export type RebuildReportsInput = z.input<typeof rebuildReportsInputSchema>;
