import {
  handleReminderInputSchema,
  REMINDER_MAX_ATTEMPTS,
  reminderPlan,
  type ReminderStatus,
} from '@kinesalud/shared';
import { logger } from 'firebase-functions/v2';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requireClinicWide } from '../../core/guards';
import type { NotificationChannel } from '../../notifications/channels';
import type { AppointmentsGateway } from '../appointments/appointmentsGateway';
import { changeAppointmentStatus } from '../appointments/appointmentsService';
import { auditActor } from '../audit';
import type { ReminderAppointment, RemindersGateway } from './remindersGateway';

/** Estados que todavía pueden cambiar con la cita (no resueltos por recepción). */
const LIVE: readonly ReminderStatus[] = ['PROGRAMADO', 'ENVIADO', 'SIN_RESPUESTA'];

/**
 * Mantiene el recordatorio de una cita en línea con ella. Lo llama un trigger
 * en cada cambio de la cita y es idempotente:
 * - cita nueva → recordatorio PROGRAMADO;
 * - reprogramada → se vuelve a programar desde cero;
 * - cerrada (atendida, cancelada, no asistió) o pasada → se anula si seguía vivo;
 * - otros cambios → solo se actualizan los datos copiados.
 */
export async function syncReminder(
  gateway: RemindersGateway,
  appointmentId: string,
  appointment: ReminderAppointment | null,
  now = new Date(),
): Promise<void> {
  const current = await gateway.getReminder(appointmentId);
  if (!appointment) {
    if (current && LIVE.includes(current.status)) {
      await gateway.saveReminder(appointmentId, { status: 'CANCELADO' });
    }
    return;
  }

  const plan = reminderPlan(appointment, await gateway.getLeadHours(), now);
  const mirror = {
    clientName: appointment.clientName,
    professionalName: appointment.professionalName,
    serviceName: appointment.serviceName,
    appointmentDate: appointment.date,
    appointmentStartAt: appointment.startAt,
    appointmentStatus: appointment.status,
  };

  if (plan.action === 'cancel') {
    if (current && LIVE.includes(current.status)) {
      await gateway.saveReminder(appointmentId, { ...mirror, status: 'CANCELADO' });
    } else if (current && current.appointmentStatus !== appointment.status) {
      await gateway.saveReminder(appointmentId, { appointmentStatus: appointment.status });
    }
    return;
  }

  const fresh = {
    ...mirror,
    type: plan.type,
    scheduledFor: plan.scheduledFor,
    status: 'PROGRAMADO' as const,
    attempts: 0,
    lastError: null,
    sentAt: null,
    handledAt: null,
    handledBy: null,
    outcomeNote: null,
  };
  if (!current) {
    const contact = await gateway.getClientContact(appointment.clientId);
    await gateway.saveReminder(appointmentId, {
      ...fresh,
      appointmentId,
      clientId: appointment.clientId,
      clientPhone: contact.phone,
      clientPhoneE164: contact.phoneE164,
      channel: 'IN_APP',
    });
    return;
  }
  const rescheduled = current.appointmentStartAt.getTime() !== appointment.startAt.getTime();
  // Una cita reactivada (corrección administrativa) vuelve a necesitar recordatorio.
  if (rescheduled || current.status === 'CANCELADO') {
    await gateway.saveReminder(appointmentId, fresh);
    return;
  }
  const changed =
    current.appointmentStatus !== appointment.status ||
    current.professionalName !== appointment.professionalName ||
    current.type !== plan.type;
  if (changed) await gateway.saveReminder(appointmentId, { ...mirror, type: plan.type });
}

export interface ProcessResult {
  queued: number;
  cancelled: number;
  failed: number;
}

/**
 * Pasa a la cola de recepción ("Por gestionar") los recordatorios vencidos y
 * avisa al personal por cada canal. Un canal que falla no frena la cola: los
 * recordatorios siguen visibles en la pantalla de Recordatorios.
 */
export async function processDueReminders(
  gateway: RemindersGateway,
  channels: NotificationChannel[],
  now = new Date(),
): Promise<ProcessResult> {
  const due = await gateway.listDue(now, 200);
  const result: ProcessResult = { queued: 0, cancelled: 0, failed: 0 };
  const lead = due.length > 0 ? await gateway.getLeadHours() : 24;

  for (const reminder of due) {
    try {
      const appointment = await gateway.getAppointment(reminder.appointmentId);
      const plan = appointment
        ? reminderPlan(appointment, lead, now)
        : { action: 'cancel' as const };
      if (plan.action === 'cancel') {
        await gateway.saveReminder(reminder.id, { status: 'CANCELADO' });
        result.cancelled += 1;
        continue;
      }
      await gateway.saveReminder(reminder.id, {
        status: 'ENVIADO',
        type: plan.type,
        appointmentStatus: appointment!.status,
        sentAt: now,
        attempts: reminder.attempts + 1,
        lastError: null,
      });
      result.queued += 1;
    } catch (err) {
      const attempts = reminder.attempts + 1;
      await gateway.saveReminder(reminder.id, {
        attempts,
        lastError: err instanceof Error ? err.message : String(err),
        ...(attempts >= REMINDER_MAX_ATTEMPTS ? { status: 'FALLIDO' as const } : {}),
      });
      result.failed += 1;
    }
  }

  if (result.queued > 0) {
    const userIds = await gateway.listFrontDeskUserIds();
    const message = {
      userIds,
      title:
        result.queued === 1
          ? '1 recordatorio para gestionar'
          : `${result.queued} recordatorios para gestionar`,
      body: 'Contacta a los clientes de las próximas citas para confirmarlas.',
      link: '/recordatorios',
    };
    for (const channel of channels) {
      try {
        await channel.send(message);
      } catch (err) {
        logger.warn(`No se pudo avisar por ${channel.name}`, err);
      }
    }
  }
  return result;
}

/**
 * Recepción registra el resultado del contacto con el cliente. Confirmar o
 * cancelar actualizan la cita con las mismas reglas de la agenda (una cita
 * pagada no se cancela sin anular antes el cobro).
 */
export async function handleReminder(
  gateway: RemindersGateway,
  appointments: AppointmentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<void> {
  requireClinicWide(
    actor,
    'reminders.manage',
    'Solo recepción o administración gestionan recordatorios.',
  );
  const input = parseInput(handleReminderInputSchema, data);
  const reminder = await gateway.getReminder(input.reminderId);
  if (!reminder) throw new DomainError('not-found', 'El recordatorio no existe.');
  if (!LIVE.includes(reminder.status)) {
    throw new DomainError('failed-precondition', 'Este recordatorio ya fue resuelto.');
  }

  // Se decide con el estado actual de la cita, no con la copia del recordatorio.
  const appointment = await gateway.getAppointment(reminder.appointmentId);
  if (!appointment) throw new DomainError('not-found', 'La cita ya no existe.');
  if (
    input.outcome !== 'SIN_RESPUESTA' &&
    !['PENDIENTE', 'CONFIRMADA'].includes(appointment.status)
  ) {
    throw new DomainError('failed-precondition', 'La cita ya no está pendiente ni confirmada.');
  }

  if (input.outcome === 'CONFIRMADO' && appointment.status === 'PENDIENTE') {
    await changeAppointmentStatus(
      appointments,
      actor,
      { appointmentId: reminder.appointmentId, action: 'CONFIRMAR' },
      now,
    );
  }
  if (input.outcome === 'CANCELADO') {
    await changeAppointmentStatus(
      appointments,
      actor,
      { appointmentId: reminder.appointmentId, action: 'CANCELAR', reason: input.note },
      now,
    );
  }

  await gateway.saveReminder(reminder.id, {
    status: input.outcome,
    handledAt: now,
    handledBy: { uid: actor.uid ?? null, name: actor.name ?? null },
    outcomeNote: input.note,
  });
  await gateway.audit({
    actor: auditActor(actor),
    action: `reminder.${input.outcome.toLowerCase()}`,
    entity: 'reminders',
    entityId: reminder.id,
  });
}
