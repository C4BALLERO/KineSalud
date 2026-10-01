import type { Timestamp } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { firestoreRemindersGateway } from '../domain/reminders/firestoreRemindersGateway';
import { processDueReminders, syncReminder } from '../domain/reminders/remindersService';
import { STAFF_CHANNELS } from '../notifications/channels';

/** Cada cambio de una cita mantiene su recordatorio (idempotente). */
export const onAppointmentReminder = onDocumentWritten('appointments/{id}', async (event) => {
  const after = event.data?.after;
  const appointment = after?.exists
    ? {
        id: after.id,
        clientId: after.get('clientId') as string,
        clientName: after.get('clientName') as string,
        professionalName: after.get('professionalName') as string,
        serviceName: after.get('serviceName') as string,
        date: after.get('date') as string,
        startAt: (after.get('startAt') as Timestamp).toDate(),
        status: after.get('status'),
      }
    : null;
  await syncReminder(firestoreRemindersGateway, event.params.id, appointment);
});

/** Cola de recordatorios: cada 15 minutos pasa los vencidos a recepción. */
export const processReminders = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'America/La_Paz' },
  async () => {
    const result = await processDueReminders(firestoreRemindersGateway, STAFF_CHANNELS);
    if (result.queued + result.cancelled + result.failed > 0) {
      logger.info('Recordatorios procesados', result);
    }
  },
);
