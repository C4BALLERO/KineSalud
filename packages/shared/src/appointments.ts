import { z } from 'zod';
import { TIME_PATTERN } from './schedule';
import type { AppointmentStatus } from './enums';
import type { AppointmentPaymentStatus } from './payments';
import { toDateKey } from './time';

/**
 * Máquina de estados de la cita y esquemas de sus comandos.
 *
 *   PENDIENTE ──confirmar──▶ CONFIRMADA
 *   PENDIENTE | CONFIRMADA ──atender──▶ ATENDIDA        (desde la hora de inicio)
 *   PENDIENTE | CONFIRMADA ──no asistió──▶ NO_ASISTIO   (desde la hora de inicio)
 *   PENDIENTE | CONFIRMADA ──cancelar (motivo)──▶ CANCELADA
 *   PENDIENTE | CONFIRMADA ──reprogramar──▶ PENDIENTE (nuevo horario)
 *
 * Los estados finales (ATENDIDA, NO_ASISTIO, CANCELADA) solo los corrige la
 * administración, indicando un motivo.
 */

export const OPEN_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['PENDIENTE', 'CONFIRMADA'];
export const FINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'ATENDIDA',
  'NO_ASISTIO',
  'CANCELADA',
];

/** Acciones de estado disponibles desde la agenda. */
export const APPOINTMENT_ACTIONS = ['CONFIRMAR', 'ATENDER', 'NO_ASISTIO', 'CANCELAR'] as const;
export type AppointmentAction = (typeof APPOINTMENT_ACTIONS)[number];

export const APPOINTMENT_ACTION_TARGET: Record<AppointmentAction, AppointmentStatus> = {
  CONFIRMAR: 'CONFIRMADA',
  ATENDER: 'ATENDIDA',
  NO_ASISTIO: 'NO_ASISTIO',
  CANCELAR: 'CANCELADA',
};

export const APPOINTMENT_ACTION_LABELS: Record<AppointmentAction, string> = {
  CONFIRMAR: 'Confirmar',
  ATENDER: 'Marcar atendida',
  NO_ASISTIO: 'No asistió',
  CANCELAR: 'Cancelar cita',
};

export type ActionCheck = { ok: true } | { ok: false; reason: string };

/**
 * ¿Se puede aplicar la acción a una cita en este estado y a esta hora?
 * La asistencia solo se registra desde la hora de inicio.
 */
/** Una cita pagada no se cancela: primero se anula el cobro y se devuelve el dinero. */
export const PAID_CANCEL_REASON =
  'La cita ya está pagada. Anula el cobro en Caja (y devuelve el dinero) antes de cancelarla.';

export function canApplyAction(
  appointment: {
    status: AppointmentStatus;
    startAt: Date;
    paymentStatus?: AppointmentPaymentStatus | null;
  },
  action: AppointmentAction,
  now: Date,
): ActionCheck {
  if (!OPEN_APPOINTMENT_STATUSES.includes(appointment.status)) {
    return {
      ok: false,
      reason: 'La cita ya está cerrada; solo la administración puede corregirla.',
    };
  }
  if (action === 'CONFIRMAR' && appointment.status === 'CONFIRMADA') {
    return { ok: false, reason: 'La cita ya está confirmada.' };
  }
  if ((action === 'ATENDER' || action === 'NO_ASISTIO') && now < appointment.startAt) {
    return { ok: false, reason: 'La asistencia se registra desde la hora de inicio de la cita.' };
  }
  if (action === 'CANCELAR' && appointment.paymentStatus === 'PAGADA') {
    return { ok: false, reason: PAID_CANCEL_REASON };
  }
  return { ok: true };
}

export function canReschedule(appointment: { status: AppointmentStatus }): ActionCheck {
  return OPEN_APPOINTMENT_STATUSES.includes(appointment.status)
    ? { ok: true }
    : { ok: false, reason: 'Solo se reprograman citas pendientes o confirmadas.' };
}

/* ---------- Esquemas de los comandos ---------- */

const idSchema = z.string().trim().min(1).max(128);
const dateSchema = z
  .string({ error: 'Elige la fecha.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha.')
  .refine((d) => d >= toDateKey(new Date()), 'No se puede agendar en una fecha pasada.');
const timeSchema = z
  .string({ error: 'Elige el horario.' })
  .regex(TIME_PATTERN, 'Elige el horario.');
const reasonSchema = z
  .string({ error: 'Indica el motivo.' })
  .trim()
  .min(3, 'Indica el motivo.')
  .max(200, 'Máximo 200 caracteres.');

export const createAppointmentInputSchema = z.object({
  clientId: idSchema,
  serviceId: idSchema,
  professionalId: idSchema,
  date: dateSchema,
  start: timeSchema,
  /** Si se omite, el servidor asigna el primer espacio compatible libre. */
  roomId: idSchema.nullable().default(null),
  treatmentId: idSchema.nullable().default(null),
  status: z.enum(['PENDIENTE', 'CONFIRMADA']).default('PENDIENTE'),
  notes: z
    .string()
    .trim()
    .max(300, 'Máximo 300 caracteres.')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
});
export type CreateAppointmentInput = z.input<typeof createAppointmentInputSchema>;

export const rescheduleAppointmentInputSchema = z.object({
  appointmentId: idSchema,
  professionalId: idSchema,
  date: dateSchema,
  start: timeSchema,
  roomId: idSchema.nullable().default(null),
});
export type RescheduleAppointmentInput = z.input<typeof rescheduleAppointmentInputSchema>;

export const changeAppointmentStatusInputSchema = z
  .object({
    appointmentId: idSchema,
    action: z.enum(APPOINTMENT_ACTIONS),
    reason: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres.')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .default(null),
  })
  .refine((v) => v.action !== 'CANCELAR' || (v.reason?.length ?? 0) >= 3, {
    message: 'Indica el motivo de la cancelación.',
    path: ['reason'],
  });
export type ChangeAppointmentStatusInput = z.input<typeof changeAppointmentStatusInputSchema>;

/** Corrección administrativa de un estado (p. ej. marcada "No asistió" por error). */
export const correctAppointmentStatusInputSchema = z.object({
  appointmentId: idSchema,
  status: z.enum(['PENDIENTE', 'CONFIRMADA', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA']),
  reason: reasonSchema,
});
export type CorrectAppointmentStatusInput = z.input<typeof correctAppointmentStatusInputSchema>;

export interface CreateAppointmentResult {
  appointmentId: string;
}

/** Horario alternativo sugerido cuando el elegido ya no está libre. */
export interface SlotAlternative {
  start: string;
  professionalId: string;
  professionalName: string;
}

/**
 * Horarios libres calculados en el servidor (con todas las citas del día). Lo usa
 * el profesional, que no ve las citas de los demás pero comparte los espacios.
 */
export const listSlotsInputSchema = z.object({
  date: dateSchema,
  serviceId: idSchema,
  clientId: idSchema.nullable().default(null),
  professionalId: idSchema.nullable().default(null),
  /** Cita que se reprograma: su horario actual cuenta como libre. */
  ignoreAppointmentId: idSchema.nullable().default(null),
});
export type ListSlotsInput = z.input<typeof listSlotsInputSchema>;

export interface ListSlotsResult {
  slots: { start: string; end: string; professionalId: string; roomId: string }[];
}

/* ---------- Historial de la cita ---------- */

export const APPOINTMENT_EVENT_TYPES = [
  'CREADA',
  'REPROGRAMADA',
  'CONFIRMADA',
  'ATENDIDA',
  'NO_ASISTIO',
  'CANCELADA',
  'CORREGIDA',
  'PAGO_REGISTRADO',
  'PAGO_ANULADO',
] as const;
export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number];

export const APPOINTMENT_EVENT_LABELS: Record<AppointmentEventType, string> = {
  CREADA: 'Cita agendada',
  REPROGRAMADA: 'Reprogramada',
  CONFIRMADA: 'Confirmada',
  ATENDIDA: 'Atendida',
  NO_ASISTIO: 'Marcada como no asistió',
  CANCELADA: 'Cancelada',
  CORREGIDA: 'Estado corregido',
  PAGO_REGISTRADO: 'Pago registrado',
  PAGO_ANULADO: 'Pago anulado',
};

/** Documento `appointments/{id}/events/{id}` (inmutable). */
export interface AppointmentEventDoc<Ts = unknown> {
  type: AppointmentEventType;
  /** Copia del profesional de la cita: permite a las reglas autorizar sin leer la cita. */
  professionalId: string;
  from: {
    status: AppointmentStatus;
    date?: string;
    start?: string;
    professionalName?: string;
  } | null;
  to: {
    status: AppointmentStatus;
    date?: string;
    start?: string;
    professionalName?: string;
  } | null;
  reason: string | null;
  actor: { type: string; uid: string | null; name: string | null; channel: string };
  at: Ts;
}
