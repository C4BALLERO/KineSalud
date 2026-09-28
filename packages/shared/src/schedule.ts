import { z } from 'zod';
import type { TimeRange, WeeklySchedule } from './domain';
import { WEEKDAY_LABELS, WEEKDAYS, type Weekday } from './time';

/**
 * Horarios semanales: los usan el consultorio (horario de atención) y cada
 * profesional (horario de trabajo). Las horas son locales "HH:mm".
 */

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Máximo de tramos por día (p. ej. mañana y tarde, con margen). */
export const MAX_RANGES_PER_DAY = 4;

const timeSchema = z
  .string({ error: 'Ingresa la hora.' })
  .regex(TIME_PATTERN, 'Ingresa una hora válida (HH:mm).');

export const timeRangeSchema = z
  .object({ start: timeSchema, end: timeSchema })
  .refine((r) => timeToMinutes(r.start) < timeToMinutes(r.end), {
    message: 'La hora de fin debe ser posterior a la de inicio.',
    path: ['end'],
  });

/** Tramos de un día: ordenados y sin superposiciones. */
export const dayRangesSchema = z
  .array(timeRangeSchema)
  .max(MAX_RANGES_PER_DAY, `Máximo ${MAX_RANGES_PER_DAY} tramos por día.`)
  .transform((ranges) =>
    [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
  )
  .superRefine((ranges, ctx) => {
    for (let i = 1; i < ranges.length; i++) {
      if (timeToMinutes(ranges[i]!.start) < timeToMinutes(ranges[i - 1]!.end)) {
        ctx.addIssue({ code: 'custom', message: 'Los tramos del día no pueden superponerse.' });
        return;
      }
    }
  });

/** Horario semanal; los días sin tramos se omiten al guardar. */
export const weeklyScheduleSchema = z
  .partialRecord(z.enum(WEEKDAYS), dayRangesSchema)
  .transform((schedule) => {
    const out: WeeklySchedule = {};
    for (const day of WEEKDAYS) {
      const ranges = schedule[day];
      if (ranges && ranges.length > 0) out[day] = ranges;
    }
    return out;
  });

/** Días con al menos un tramo. */
export function workingDays(schedule: WeeklySchedule): Weekday[] {
  return WEEKDAYS.filter((d) => (schedule[d]?.length ?? 0) > 0);
}

/** Minutos de trabajo por semana. */
export function weeklyMinutes(schedule: WeeklySchedule): number {
  return WEEKDAYS.reduce(
    (sum, d) =>
      sum +
      (schedule[d] ?? []).reduce((s, r) => s + timeToMinutes(r.end) - timeToMinutes(r.start), 0),
    0,
  );
}

/** ¿Cada tramo de `inner` cabe completo dentro de algún tramo de `outer`? */
export function rangesWithin(inner: readonly TimeRange[], outer: readonly TimeRange[]): boolean {
  return inner.every((r) =>
    outer.some(
      (o) =>
        timeToMinutes(r.start) >= timeToMinutes(o.start) &&
        timeToMinutes(r.end) <= timeToMinutes(o.end),
    ),
  );
}

/** Días en que el horario sale del horario de atención del consultorio. */
export function daysOutsideHours(schedule: WeeklySchedule, opening: WeeklySchedule): Weekday[] {
  return workingDays(schedule).filter((d) => !rangesWithin(schedule[d]!, opening[d] ?? []));
}

/** "08:00–12:00 y 14:30–18:30" */
export function formatRanges(ranges: readonly TimeRange[] | undefined): string {
  if (!ranges || ranges.length === 0) return 'No atiende';
  const parts = ranges.map((r) => `${r.start}–${r.end}`);
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
}

/** "Lunes, Miércoles" para mensajes de validación. */
export function formatWeekdays(days: readonly Weekday[]): string {
  return days.map((d) => WEEKDAY_LABELS[d]).join(', ');
}
