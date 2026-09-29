import { z } from 'zod';
import type { ActionCheck } from './appointments';
import { optionalText } from './clients';
import type { TreatmentStatus } from './enums';
import { addDays, toDateKey } from './time';

/* ---------- Estados del tratamiento ---------- */

export const TREATMENT_ACTIONS = ['FINALIZAR', 'SUSPENDER', 'REACTIVAR'] as const;
export type TreatmentAction = (typeof TREATMENT_ACTIONS)[number];

export const TREATMENT_ACTION_TARGET: Record<TreatmentAction, TreatmentStatus> = {
  FINALIZAR: 'FINALIZADO',
  SUSPENDER: 'SUSPENDIDO',
  REACTIVAR: 'ACTIVO',
};

export const TREATMENT_ACTION_LABELS: Record<TreatmentAction, string> = {
  FINALIZAR: 'Finalizar tratamiento',
  SUSPENDER: 'Suspender',
  REACTIVAR: 'Reactivar',
};

interface TreatmentState {
  status: TreatmentStatus;
  plannedSessions: number;
  completedSessions: number;
}

const openAppointmentsReason = (count: number, verb: string) =>
  `Tiene ${count} ${count === 1 ? 'cita agendada' : 'citas agendadas'} de este tratamiento. Cancélalas antes de ${verb}lo.`;

/**
 * ¿Se puede aplicar la acción? Un tratamiento con citas por delante no se
 * finaliza ni se suspende: esas citas quedarían sin plan que las respalde.
 */
export function canApplyTreatmentAction(
  t: TreatmentState,
  action: TreatmentAction,
  openAppointments: number,
): ActionCheck {
  switch (action) {
    case 'FINALIZAR':
      if (t.status === 'FINALIZADO')
        return { ok: false, reason: 'El tratamiento ya está finalizado.' };
      if (openAppointments > 0)
        return { ok: false, reason: openAppointmentsReason(openAppointments, 'finalizar') };
      return { ok: true };
    case 'SUSPENDER':
      if (t.status !== 'ACTIVO')
        return { ok: false, reason: 'Solo se suspende un tratamiento activo.' };
      if (openAppointments > 0)
        return { ok: false, reason: openAppointmentsReason(openAppointments, 'suspender') };
      return { ok: true };
    case 'REACTIVAR':
      return t.status === 'ACTIVO'
        ? { ok: false, reason: 'El tratamiento ya está activo.' }
        : { ok: true };
  }
}

/**
 * El motivo es obligatorio al suspender, al finalizar antes de completar las
 * sesiones previstas y al reabrir un tratamiento finalizado.
 */
export function treatmentActionNeedsReason(t: TreatmentState, action: TreatmentAction): boolean {
  if (action === 'SUSPENDER') return true;
  if (action === 'FINALIZAR') return t.completedSessions < t.plannedSessions;
  return t.status === 'FINALIZADO';
}

/** Mínimo de sesiones previstas: las realizadas más las que ya están agendadas. */
export function minPlannedSessions(completedSessions: number, openAppointments: number): number {
  return Math.max(1, completedSessions + openAppointments);
}

/* ---------- Esquemas de los comandos ---------- */

const idSchema = z.string().trim().min(1).max(128);

export const MAX_PLANNED_SESSIONS = 50;

const plannedSessionsSchema = z
  .number({ error: 'Ingresa el número de sesiones.' })
  .int('Usa un número entero.')
  .min(1, 'Mínimo 1 sesión.')
  .max(MAX_PLANNED_SESSIONS, `Máximo ${MAX_PLANNED_SESSIONS} sesiones.`);

const startDateSchema = z
  .string({ error: 'Elige la fecha de inicio.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha de inicio.')
  .refine((d) => {
    const today = toDateKey(new Date());
    return d >= addDays(today, -365) && d <= addDays(today, 90);
  }, 'La fecha de inicio debe estar dentro del último año o de los próximos 3 meses.');

const notesSchema = optionalText(300, 'Máximo 300 caracteres.');

export const createTreatmentInputSchema = z.object({
  clientId: z.string({ error: 'Elige el cliente.' }).trim().min(1, 'Elige el cliente.'),
  serviceId: z.string({ error: 'Elige el servicio.' }).trim().min(1, 'Elige el servicio.'),
  professionalId: z
    .string({ error: 'Elige el profesional.' })
    .trim()
    .min(1, 'Elige el profesional.'),
  startDate: startDateSchema,
  plannedSessions: plannedSessionsSchema,
  /** Nota administrativa (p. ej. "derivado por el Dr. X"); lo clínico va en la Fase 12. */
  notes: notesSchema,
});
export type CreateTreatmentInput = z.input<typeof createTreatmentInputSchema>;

export interface CreateTreatmentResult {
  treatmentId: string;
}

export const updateTreatmentInputSchema = z.object({
  treatmentId: idSchema,
  professionalId: z
    .string({ error: 'Elige el profesional.' })
    .trim()
    .min(1, 'Elige el profesional.'),
  plannedSessions: plannedSessionsSchema,
  notes: notesSchema,
});
export type UpdateTreatmentInput = z.input<typeof updateTreatmentInputSchema>;

export const changeTreatmentStatusInputSchema = z.object({
  treatmentId: idSchema,
  action: z.enum(TREATMENT_ACTIONS),
  reason: optionalText(200, 'Máximo 200 caracteres.'),
});
export type ChangeTreatmentStatusInput = z.input<typeof changeTreatmentStatusInputSchema>;
