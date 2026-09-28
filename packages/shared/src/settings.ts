import { z } from 'zod';
import type { RoomDoc, ServiceDoc, WeeklySchedule } from './domain';
import { ROOM_KINDS, TREATMENT_CATEGORIES } from './enums';
import { weeklyScheduleSchema, workingDays } from './schedule';

/** Documento `settings/clinic`. */
export interface ClinicSettingsDoc {
  name: string;
  timezone: string;
  /** Intervalo de la grilla de la agenda y de los horarios sugeridos. */
  slotMinutes: number;
  /** Anticipación con la que se programa el recordatorio de cada cita. */
  reminderLeadHours: number;
  openingHours: WeeklySchedule;
}

export const SLOT_MINUTES_OPTIONS = [10, 15, 20, 30] as const;
export const REMINDER_LEAD_OPTIONS = [2, 12, 24, 48] as const;

const idSchema = z.string().trim().min(1).max(128);

export const clinicSettingsInputSchema = z.object({
  name: z
    .string({ error: 'Ingresa el nombre del consultorio.' })
    .trim()
    .min(2, 'Ingresa el nombre del consultorio.')
    .max(80, 'Máximo 80 caracteres.'),
  slotMinutes: z
    .number()
    .int()
    .refine((v) => (SLOT_MINUTES_OPTIONS as readonly number[]).includes(v), 'Intervalo no válido.'),
  reminderLeadHours: z
    .number()
    .int()
    .refine(
      (v) => (REMINDER_LEAD_OPTIONS as readonly number[]).includes(v),
      'Anticipación no válida.',
    ),
  openingHours: weeklyScheduleSchema.refine(
    (s) => workingDays(s).length > 0,
    'El consultorio debe atender al menos un día.',
  ),
});
export type ClinicSettingsInput = z.input<typeof clinicSettingsInputSchema>;

export interface UpdateClinicResult {
  /** Profesionales cuyo horario queda fuera del nuevo horario de atención. */
  professionalsOutside: string[];
}

/* ---------- Espacios ---------- */

export const roomInputSchema = z.object({
  roomId: idSchema.nullable().default(null),
  name: z
    .string({ error: 'Ingresa el nombre del espacio.' })
    .trim()
    .min(2, 'Ingresa el nombre del espacio.')
    .max(40, 'Máximo 40 caracteres.'),
  kind: z.enum(ROOM_KINDS, { error: 'Elige el tipo de espacio.' }),
  allowedCategories: z
    .array(z.enum(TREATMENT_CATEGORIES))
    .min(1, 'Elige al menos un área que pueda usar este espacio.')
    .transform((v) => [...new Set(v)]),
});
export type RoomInput = z.input<typeof roomInputSchema>;

/* ---------- Servicios ---------- */

export const serviceInputSchema = z.object({
  serviceId: idSchema.nullable().default(null),
  name: z
    .string({ error: 'Ingresa el nombre del servicio.' })
    .trim()
    .min(3, 'Ingresa el nombre del servicio.')
    .max(60, 'Máximo 60 caracteres.'),
  category: z.enum(TREATMENT_CATEGORIES, { error: 'Elige el área del servicio.' }),
  durationMin: z
    .number({ error: 'Ingresa la duración.' })
    .int('Usa minutos enteros.')
    .min(15, 'Mínimo 15 minutos.')
    .max(240, 'Máximo 240 minutos.')
    .refine((v) => v % 5 === 0, 'Usa múltiplos de 5 minutos.'),
  bufferMin: z
    .number({ error: 'Ingresa el tiempo de preparación (0 si no hace falta).' })
    .int('Usa minutos enteros.')
    .min(0, 'No puede ser negativo.')
    .max(60, 'Máximo 60 minutos.')
    .refine((v) => v % 5 === 0, 'Usa múltiplos de 5 minutos.'),
  defaultSessions: z
    .number({ error: 'Ingresa el número de sesiones.' })
    .int('Usa un número entero.')
    .min(1, 'Mínimo 1 sesión.')
    .max(50, 'Máximo 50 sesiones.'),
  roomKinds: z
    .array(z.enum(ROOM_KINDS))
    .min(1, 'Elige al menos un tipo de espacio.')
    .transform((v) => [...new Set(v)]),
});
export type ServiceInput = z.input<typeof serviceInputSchema>;

export interface SaveCatalogResult {
  id: string;
}

export const setCatalogActiveInputSchema = z.object({ id: idSchema, active: z.boolean() });
export type SetCatalogActiveInput = z.input<typeof setCatalogActiveInputSchema>;

/**
 * Espacios activos donde puede hacerse un servicio: del tipo requerido y
 * habilitados para su área. Sin ninguno, el servicio no se puede agendar.
 */
export function compatibleRooms<R extends Pick<RoomDoc, 'kind' | 'allowedCategories' | 'active'>>(
  service: Pick<ServiceDoc, 'category' | 'roomKinds'>,
  rooms: readonly R[],
): R[] {
  return rooms.filter(
    (r) =>
      r.active &&
      service.roomKinds.includes(r.kind) &&
      r.allowedCategories.includes(service.category),
  );
}
