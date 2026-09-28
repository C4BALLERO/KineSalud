import {
  dayRangesSchema,
  formatRanges,
  rangesWithin,
  WEEKDAYS,
  type TimeRange,
  type WeeklySchedule,
  type Weekday,
} from '@kinesalud/shared';

/** Horario en edición: todos los días presentes (vacío = no atiende). */
export type EditableWeek = Record<Weekday, TimeRange[]>;

export function toEditableWeek(schedule: WeeklySchedule | undefined): EditableWeek {
  return Object.fromEntries(
    WEEKDAYS.map((d) => [d, (schedule?.[d] ?? []).map((r) => ({ ...r }))]),
  ) as EditableWeek;
}

export function sameWeek(a: EditableWeek, b: EditableWeek): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Valida cada día con el esquema compartido y, si hay un horario de
 * referencia (el del consultorio), que los tramos caigan dentro de él.
 */
export function validateWeek(
  week: EditableWeek,
  reference?: WeeklySchedule,
): Partial<Record<Weekday, string>> {
  const errors: Partial<Record<Weekday, string>> = {};
  for (const day of WEEKDAYS) {
    const ranges = week[day];
    if (ranges.length === 0) continue;
    const parsed = dayRangesSchema.safeParse(ranges);
    if (!parsed.success) {
      errors[day] = parsed.error.issues[0]?.message ?? 'Revisa los horarios de este día.';
    } else if (reference && !rangesWithin(parsed.data, reference[day] ?? [])) {
      errors[day] = reference[day]?.length
        ? `Debe estar dentro del horario del consultorio (${formatRanges(reference[day])}).`
        : 'El consultorio no atiende este día.';
    }
  }
  return errors;
}
