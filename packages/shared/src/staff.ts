import { z } from 'zod';
import { nameSchema, normalizePhone } from './clients';
import type { ProfessionalDoc, TimeRange } from './domain';
import { TREATMENT_CATEGORIES } from './enums';
import { weeklyScheduleSchema } from './schedule';
import { addDays, toDateKey, weekdayOf, type DateKey } from './time';

/* ---------- Profesionales ---------- */

export const PROFESSIONAL_TITLES = ['Lic.', 'Dr.', 'Dra.', 'Mg.', 'Tec.'] as const;
export type ProfessionalTitle = (typeof PROFESSIONAL_TITLES)[number];

export const PROFESSIONAL_TITLE_LABELS: Record<ProfessionalTitle, string> = {
  'Lic.': 'Licenciado/a (Lic.)',
  'Dr.': 'Doctor (Dr.)',
  'Dra.': 'Doctora (Dra.)',
  'Mg.': 'Magíster (Mg.)',
  'Tec.': 'Técnico/a (Tec.)',
};

/** Nombre con el que aparece en la agenda: "Lic. Diego Pérez". */
export function professionalDisplayName(p: {
  title: string | null;
  firstName: string;
  lastName: string;
}): string {
  return [p.title, p.firstName, p.lastName].filter(Boolean).join(' ');
}

const idSchema = z.string().trim().min(1).max(128);

export const professionalInputSchema = z.object({
  title: z.enum(PROFESSIONAL_TITLES).nullable().default(null),
  firstName: nameSchema('Ingresa los nombres.'),
  lastName: nameSchema('Ingresa los apellidos.'),
  phone: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : normalizePhone(v)))
    .pipe(
      z
        .string()
        .regex(/^[2-7]\d{6,7}$/, 'Ingresa un celular de 8 dígitos o un fijo de 7.')
        .nullable(),
    )
    .nullable()
    .default(null),
  categories: z
    .array(z.enum(TREATMENT_CATEGORIES))
    .min(1, 'Elige al menos un área de atención.')
    .transform((v) => [...new Set(v)]),
  specialties: z
    .array(z.string().trim().min(2, 'Cada especialidad debe tener al menos 2 letras.').max(40))
    .max(6, 'Máximo 6 especialidades.')
    .default([]),
  serviceIds: z
    .array(idSchema)
    .max(50)
    .transform((v) => [...new Set(v)])
    .default([]),
});
export type ProfessionalInput = z.input<typeof professionalInputSchema>;
export type ProfessionalData = z.output<typeof professionalInputSchema>;

export const createProfessionalInputSchema = professionalInputSchema;

export const updateProfessionalInputSchema = professionalInputSchema.extend({
  professionalId: idSchema,
});
export type UpdateProfessionalInput = z.input<typeof updateProfessionalInputSchema>;

export const setProfessionalActiveInputSchema = z.object({
  professionalId: idSchema,
  active: z.boolean(),
});
export type SetProfessionalActiveInput = z.input<typeof setProfessionalActiveInputSchema>;

export const setScheduleInputSchema = z.object({
  professionalId: idSchema,
  weeklySchedule: weeklyScheduleSchema,
});
export type SetScheduleInput = z.input<typeof setScheduleInputSchema>;

/** Vincula (uid) o desvincula (null) la cuenta de acceso de un profesional. */
export const linkAccountInputSchema = z.object({
  professionalId: idSchema,
  uid: idSchema.nullable(),
});
export type LinkAccountInput = z.input<typeof linkAccountInputSchema>;

export interface CreateProfessionalResult {
  professionalId: string;
}

/* ---------- Ausencias (vacaciones, permisos, bloqueos) ---------- */

export const EXCEPTION_TYPES = ['VACACIONES', 'PERMISO', 'BLOQUEO'] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  VACACIONES: 'Vacaciones',
  PERMISO: 'Permiso',
  BLOQUEO: 'Agenda bloqueada',
};

/** Documento `professionalExceptions/{id}`: días completos en los que no atiende. */
export interface ProfessionalExceptionDoc<Ts = unknown> {
  professionalId: string;
  dateFrom: DateKey;
  dateTo: DateKey;
  type: ExceptionType;
  note: string | null;
  createdAt: Ts;
  createdBy: string | null;
}

/** Duración máxima de una ausencia registrada de una sola vez. */
export const MAX_EXCEPTION_DAYS = 90;

const dateKeySchema = (message: string) =>
  z.string({ error: message }).regex(/^\d{4}-\d{2}-\d{2}$/, message);

export const addExceptionInputSchema = z
  .object({
    professionalId: idSchema,
    type: z.enum(EXCEPTION_TYPES, { error: 'Elige el tipo de ausencia.' }),
    dateFrom: dateKeySchema('Ingresa la fecha de inicio.'),
    dateTo: dateKeySchema('Ingresa la fecha de fin.'),
    note: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres.')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .default(null),
  })
  .refine((v) => v.dateTo >= v.dateFrom, {
    message: 'La fecha de fin no puede ser anterior a la de inicio.',
    path: ['dateTo'],
  })
  .refine((v) => v.dateTo >= toDateKey(new Date()), {
    message: 'La ausencia ya terminó: registra solo ausencias actuales o futuras.',
    path: ['dateTo'],
  })
  .refine((v) => v.dateTo <= addDays(v.dateFrom, MAX_EXCEPTION_DAYS - 1), {
    message: `Registra como máximo ${MAX_EXCEPTION_DAYS} días seguidos.`,
    path: ['dateTo'],
  });
export type AddExceptionInput = z.input<typeof addExceptionInputSchema>;

export interface AddExceptionResult {
  exceptionId: string;
  /** Citas pendientes o confirmadas en esas fechas: hay que reprogramarlas. */
  affectedAppointments: number;
}

export const removeExceptionInputSchema = z.object({ exceptionId: idSchema });
export type RemoveExceptionInput = z.input<typeof removeExceptionInputSchema>;

type ExceptionRange = Pick<ProfessionalExceptionDoc, 'dateFrom' | 'dateTo'>;

export function exceptionCovers(e: ExceptionRange, day: DateKey): boolean {
  return e.dateFrom <= day && day <= e.dateTo;
}

export function exceptionsOverlap(a: ExceptionRange, b: ExceptionRange): boolean {
  return a.dateFrom <= b.dateTo && b.dateFrom <= a.dateTo;
}

/** Días de una ausencia (ambas fechas incluidas). */
export function exceptionDays(e: ExceptionRange): number {
  let days = 1;
  for (let d = e.dateFrom; d < e.dateTo; d = addDays(d, 1)) days++;
  return days;
}

/* ---------- Disponibilidad de un día ---------- */

export type DayAvailability =
  | { kind: 'inactive' }
  | { kind: 'absent'; exception: ExceptionRange & { type: ExceptionType } }
  | { kind: 'off' }
  | { kind: 'working'; ranges: TimeRange[] };

/**
 * Qué pasa con un profesional un día concreto: inactivo, ausente (vacaciones,
 * permiso…), sin horario ese día de la semana, o atendiendo en ciertos tramos.
 */
export function dayAvailability(
  professional: Pick<ProfessionalDoc, 'active' | 'weeklySchedule'>,
  exceptions: readonly (ExceptionRange & { type: ExceptionType })[],
  day: DateKey,
): DayAvailability {
  if (!professional.active) return { kind: 'inactive' };
  const exception = exceptions.find((e) => exceptionCovers(e, day));
  if (exception) return { kind: 'absent', exception };
  const ranges = professional.weeklySchedule[weekdayOf(day)] ?? [];
  return ranges.length > 0 ? { kind: 'working', ranges } : { kind: 'off' };
}
