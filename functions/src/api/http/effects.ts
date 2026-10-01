import { toDateKey } from '@kinesalud/shared';
import type { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from '../../core/firebase';
import { firestoreRemindersGateway } from '../../domain/reminders/firestoreRemindersGateway';
import { syncReminder } from '../../domain/reminders/remindersService';
import type { ReminderAppointment } from '../../domain/reminders/remindersGateway';
import { firestoreReportsGateway } from '../../domain/reports/firestoreReportsGateway';
import { recomputeDailyIncome, recomputeDailyStats } from '../../domain/reports/reportsService';

/**
 * Efectos que en el plan Blaze hacen los triggers de Firestore (resúmenes de
 * reportes y recordatorios). En el despliegue gratuito no hay triggers: se
 * ejecutan después de cada comando que los necesita. Son los mismos servicios
 * idempotentes, así que el resultado es idéntico.
 */

/** Comandos que cambian una cita (estado, fecha u hora). */
const APPOINTMENT_COMMANDS = new Set([
  'appointments-create',
  'appointments-reschedule',
  'appointments-changeStatus',
  'appointments-correctStatus',
  'clinical-recordSession',
  'reminders-handle',
]);

type Data = Record<string, unknown> | null | undefined;

function appointmentIdOf(command: string, data: Data, result: Data): string | null {
  const id =
    command === 'appointments-create'
      ? result?.appointmentId
      : command === 'reminders-handle'
        ? data?.reminderId // el recordatorio usa el id de su cita
        : data?.appointmentId;
  return typeof id === 'string' ? id : null;
}

async function readAppointment(id: string): Promise<ReminderAppointment | null> {
  const snap = await db.collection('appointments').doc(id).get();
  if (!snap.exists) return null;
  return {
    id: snap.id,
    clientId: snap.get('clientId'),
    clientName: snap.get('clientName'),
    professionalName: snap.get('professionalName'),
    serviceName: snap.get('serviceName'),
    date: snap.get('date'),
    startAt: (snap.get('startAt') as Timestamp).toDate(),
    status: snap.get('status'),
  };
}

/** Lo que hay que recordar antes del comando (la fecha previa de una cita reprogramada). */
export interface EffectsSnapshot {
  previousDate: string | null;
}

export async function beforeCommand(command: string, data: Data): Promise<EffectsSnapshot> {
  if (command !== 'appointments-reschedule') return { previousDate: null };
  const id = appointmentIdOf(command, data, null);
  const snap = id ? await db.collection('appointments').doc(id).get() : null;
  return { previousDate: (snap?.get('date') as string | undefined) ?? null };
}

export async function afterCommand(
  command: string,
  data: Data,
  result: Data,
  snapshot: EffectsSnapshot,
): Promise<void> {
  try {
    if (APPOINTMENT_COMMANDS.has(command)) {
      const id = appointmentIdOf(command, data, result);
      if (!id) return;
      const appointment = await readAppointment(id);
      const dates = new Set([snapshot.previousDate, appointment?.date].filter(Boolean) as string[]);
      await Promise.all([
        ...[...dates].map((d) => recomputeDailyStats(firestoreReportsGateway, d)),
        syncReminder(firestoreRemindersGateway, id, appointment),
      ]);
    }
    if (command === 'cash-charge' || command === 'cash-voidPayment') {
      const paymentId = command === 'cash-charge' ? result?.paymentId : data?.paymentId;
      if (typeof paymentId !== 'string') return;
      const payment = await db.collection('payments').doc(paymentId).get();
      const date = payment.get('date') as string | undefined;
      if (date) await recomputeDailyIncome(firestoreReportsGateway, date);
    }
    if (command === 'clients-create') {
      await recomputeDailyStats(firestoreReportsGateway, toDateKey(new Date()));
    }
  } catch (err) {
    // El comando ya se guardó: un resumen desfasado se corrige con "Recalcular".
    logger.error(`No se pudieron actualizar los resúmenes después de ${command}`, err);
  }
}
