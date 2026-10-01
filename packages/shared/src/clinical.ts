import { z } from 'zod';
import type { ActionCheck } from './appointments';
import type { AppointmentStatus } from './enums';
import type { DateKey } from './time';

/**
 * Seguimiento clínico. Todo vive en `clinicalRecords/{clientId}` y sus
 * subcolecciones, con lectura y escritura **denegadas** desde la web: se
 * accede solo por Cloud Functions, que verifican el permiso `clinical.*` y
 * registran cada acceso en la auditoría. La recepción nunca lo ve.
 */

/** Documento `clinicalRecords/{clientId}`: antecedentes del paciente. */
export interface ClinicalRecordDoc<Ts = unknown> {
  clientId: string;
  /** Antecedentes: patologías, cirugías, medicación, hábitos. */
  background: string | null;
  /** Alergias, contraindicaciones y precauciones (se muestran destacadas). */
  alerts: string | null;
  updatedAt: Ts;
  updatedBy: { uid: string | null; name: string | null };
}

/** Documento `clinicalRecords/{clientId}/treatmentPlans/{treatmentId}`. */
export interface TreatmentPlanDoc<Ts = unknown> {
  treatmentId: string;
  /** Motivo de consulta y evaluación inicial. */
  assessment: string | null;
  goals: string | null;
  indications: string | null;
  updatedAt: Ts;
  updatedBy: { uid: string | null; name: string | null };
}

/** Documento `clinicalRecords/{clientId}/sessionNotes/{appointmentId}`: una nota por cita. */
export interface SessionNoteDoc<Ts = unknown> {
  appointmentId: string;
  treatmentId: string | null;
  sessionNumber: number | null;
  date: DateKey;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  observations: string;
  evolution: string | null;
  recommendations: string | null;
  /** Escala visual analógica del dolor (0 = sin dolor, 10 = máximo). */
  painBefore: number | null;
  painAfter: number | null;
  createdAt: Ts;
  createdBy: { uid: string | null; name: string | null };
  updatedAt: Ts | null;
}

/* ---------- Escala de dolor (EVA) ---------- */

export const PAIN_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function painLabel(value: number): string {
  if (value === 0) return 'Sin dolor';
  if (value <= 3) return 'Leve';
  if (value <= 6) return 'Moderado';
  if (value <= 9) return 'Intenso';
  return 'Máximo';
}

/** Cambio de dolor en la sesión: negativo = mejoró. */
export function painChange(note: Pick<SessionNoteDoc, 'painBefore' | 'painAfter'>): number | null {
  return note.painBefore === null || note.painAfter === null
    ? null
    : note.painAfter - note.painBefore;
}

/* ---------- Reglas ---------- */

/**
 * Se registra la sesión de una cita desde su hora de inicio, si no se canceló
 * ni se marcó la inasistencia. Si estaba pendiente o confirmada, registrarla
 * la marca como atendida en la misma operación.
 */
export function canRecordSession(
  appointment: { status: AppointmentStatus; startAt: Date },
  now: Date,
): ActionCheck {
  if (appointment.status === 'CANCELADA' || appointment.status === 'NO_ASISTIO') {
    return { ok: false, reason: 'La cita está cancelada o el cliente no asistió.' };
  }
  if (appointment.status !== 'ATENDIDA' && now < appointment.startAt) {
    return { ok: false, reason: 'La sesión se registra desde la hora de inicio de la cita.' };
  }
  return { ok: true };
}

/** El autor y la administración editan una nota; nadie la borra. */
export const NOTE_EDIT_WINDOW_DAYS = 7;

export function canEditNote(
  note: { createdAt: Date | null; createdBy: { uid: string | null } },
  actor: { uid: string; isAdmin: boolean },
  now: Date,
): ActionCheck {
  if (actor.isAdmin) return { ok: true };
  if (note.createdBy.uid !== actor.uid) {
    return {
      ok: false,
      reason: 'Solo quien registró la nota (o la administración) puede editarla.',
    };
  }
  const limit = (note.createdAt?.getTime() ?? 0) + NOTE_EDIT_WINDOW_DAYS * 86_400_000;
  if (now.getTime() > limit) {
    return {
      ok: false,
      reason: `Las notas se editan durante ${NOTE_EDIT_WINDOW_DAYS} días. Pide a la administración que la corrija.`,
    };
  }
  return { ok: true };
}

/* ---------- Esquemas ---------- */

const idSchema = z.string().trim().min(1).max(128);

const clinicalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null);

const painSchema = z
  .number()
  .int()
  .min(0, 'Elige un valor entre 0 y 10.')
  .max(10, 'Elige un valor entre 0 y 10.')
  .nullable()
  .default(null);

export const saveClinicalRecordInputSchema = z.object({
  clientId: idSchema,
  background: clinicalText(3000),
  alerts: clinicalText(1000),
});
export type SaveClinicalRecordInput = z.input<typeof saveClinicalRecordInputSchema>;

export const saveTreatmentPlanInputSchema = z.object({
  treatmentId: idSchema,
  assessment: clinicalText(3000),
  goals: clinicalText(2000),
  indications: clinicalText(2000),
});
export type SaveTreatmentPlanInput = z.input<typeof saveTreatmentPlanInputSchema>;

export const sessionNoteInputSchema = z.object({
  appointmentId: idSchema,
  observations: z
    .string({ error: 'Describe lo realizado en la sesión.' })
    .trim()
    .min(3, 'Describe lo realizado en la sesión.')
    .max(3000, 'Máximo 3000 caracteres.'),
  evolution: clinicalText(2000),
  recommendations: clinicalText(2000),
  painBefore: painSchema,
  painAfter: painSchema,
});
export type SessionNoteInput = z.input<typeof sessionNoteInputSchema>;

export interface RecordSessionResult {
  /** La cita pasó a ATENDIDA con este registro. */
  markedAttended: boolean;
  /** Sesiones realizadas del tratamiento tras el registro (si tiene). */
  completedSessions: number | null;
  plannedSessions: number | null;
}

export const clientClinicalInputSchema = z.object({ clientId: idSchema });
export const treatmentClinicalInputSchema = z.object({ treatmentId: idSchema });
export const appointmentClinicalInputSchema = z.object({ appointmentId: idSchema });

/* ---------- Respuestas de lectura (las fechas viajan como ISO) ---------- */

export type ClinicalActor = { uid: string | null; name: string | null };

export interface ClinicalRecordView {
  background: string | null;
  alerts: string | null;
  updatedAt: string | null;
  updatedBy: ClinicalActor | null;
}

export interface TreatmentPlanView {
  assessment: string | null;
  goals: string | null;
  indications: string | null;
  updatedAt: string | null;
  updatedBy: ClinicalActor | null;
}

export type SessionNoteView = Omit<SessionNoteDoc, 'createdAt' | 'updatedAt'> & {
  createdAt: string | null;
  updatedAt: string | null;
};

export interface ClientClinicalView {
  record: ClinicalRecordView | null;
  notes: SessionNoteView[];
}

export interface TreatmentClinicalView {
  plan: TreatmentPlanView | null;
  notes: SessionNoteView[];
  /** Alertas del paciente, para tenerlas a la vista al tratarlo. */
  alerts: string | null;
}
