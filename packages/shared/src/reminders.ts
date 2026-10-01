import { z } from 'zod';
import type { AppointmentStatus } from './enums';
import { REMINDER_STATUS_OPEN, type ReminderStatus, type ReminderType } from './enums';
import { CLINIC_LOCALE, CLINIC_TIMEZONE, type DateKey } from './time';

/**
 * Recordatorios de citas. Los clientes no tienen la app: el recordatorio se
 * gestiona de forma asistida. Al vencer, entra a la cola "Por gestionar" de
 * recepción, que contacta al cliente (WhatsApp con el mensaje listo, o una
 * llamada) y registra el resultado. El personal recibe un aviso en la app y,
 * si lo activó, una notificación push.
 */

/** Documento `reminders/{appointmentId}`: uno por cita (id determinista, idempotente). */
export interface ReminderDoc<Ts = unknown> {
  appointmentId: string;
  clientId: string;
  clientName: string;
  /** Teléfono para mostrar y su forma internacional (+591…) para WhatsApp. */
  clientPhone: string | null;
  clientPhoneE164: string | null;
  professionalName: string;
  serviceName: string;
  appointmentDate: DateKey;
  appointmentStartAt: Ts;
  /** Copia del estado de la cita: PENDIENTE pide confirmar; CONFIRMADA, solo recordar. */
  appointmentStatus: AppointmentStatus;
  type: ReminderType;
  channel: 'IN_APP';
  scheduledFor: Ts;
  status: ReminderStatus;
  attempts: number;
  lastError: string | null;
  sentAt: Ts | null;
  handledAt: Ts | null;
  handledBy: { uid: string | null; name: string | null } | null;
  outcomeNote: string | null;
  createdAt: Ts;
  updatedAt: Ts;
}

/** Documento `notifications/{id}`: bandeja in-app de una persona del personal. */
export interface NotificationDoc<Ts = unknown> {
  userId: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Ts;
}

export const REMINDER_MAX_ATTEMPTS = 3;

/* ---------- Planificación ---------- */

const CLOSED: readonly AppointmentStatus[] = ['ATENDIDA', 'CANCELADA', 'NO_ASISTIO'];

export type ReminderPlan =
  { action: 'schedule'; scheduledFor: Date; type: ReminderType } | { action: 'cancel' };

/**
 * Qué debe pasar con el recordatorio de una cita: se programa `leadHours`
 * antes del inicio (o ya, si la cita es más próxima) y se anula si la cita se
 * cerró o ya empezó.
 */
export function reminderPlan(
  appointment: { status: AppointmentStatus; startAt: Date },
  leadHours: number,
  now: Date,
): ReminderPlan {
  if (CLOSED.includes(appointment.status) || appointment.startAt <= now)
    return { action: 'cancel' };
  const ideal = new Date(appointment.startAt.getTime() - leadHours * 3_600_000);
  return {
    action: 'schedule',
    scheduledFor: ideal > now ? ideal : now,
    type: appointment.status === 'PENDIENTE' ? 'CONFIRMACION' : 'RECORDATORIO',
  };
}

/** Recordatorios que todavía requieren acción de recepción. */
export function isReminderPending(status: ReminderStatus): boolean {
  return (REMINDER_STATUS_OPEN as readonly string[]).includes(status);
}

/* ---------- Mensaje para el cliente ---------- */

const dayFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Texto del recordatorio, sin datos clínicos (solo servicio, día, hora y profesional). */
export function reminderMessage(
  r: Pick<
    ReminderDoc<Date>,
    'clientName' | 'serviceName' | 'professionalName' | 'appointmentStartAt' | 'type'
  >,
  clinicName: string,
): string {
  const firstName = r.clientName.split(' ')[0] ?? r.clientName;
  const when = `el ${dayFormat.format(r.appointmentStartAt).replace(',', '')} a las ${timeFormat.format(r.appointmentStartAt)}`;
  const ask =
    r.type === 'CONFIRMACION'
      ? '¿Nos confirma su asistencia? Si necesita cambiar el horario, responda este mensaje.'
      : 'Lo esperamos. Si necesita cambiar el horario, responda este mensaje.';
  return `Hola ${firstName}, le recordamos su cita de ${r.serviceName} en ${clinicName} ${when} con ${r.professionalName}. ${ask}`;
}

/** Enlace de WhatsApp con el mensaje ya escrito (wa.me exige el número sin "+"). */
export function whatsappUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/* ---------- Comandos ---------- */

export const REMINDER_OUTCOMES = ['CONFIRMADO', 'SIN_RESPUESTA', 'CANCELADO'] as const;
export type ReminderOutcome = (typeof REMINDER_OUTCOMES)[number];

export const handleReminderInputSchema = z
  .object({
    reminderId: z.string().trim().min(1).max(128),
    outcome: z.enum(REMINDER_OUTCOMES),
    note: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres.')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .default(null),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === 'CANCELADO' && (!v.note || v.note.length < 3)) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Indica el motivo de la cancelación.',
      });
    }
  });
export type HandleReminderInput = z.input<typeof handleReminderInputSchema>;
