import { callable } from '../../core/callable';
import { requirePermission } from '../../core/guards';
import { firestoreAppointmentsGateway } from '../../domain/appointments/firestoreAppointmentsGateway';
import { firestoreRemindersGateway } from '../../domain/reminders/firestoreRemindersGateway';
import { handleReminder, processDueReminders } from '../../domain/reminders/remindersService';
import { STAFF_CHANNELS } from '../../notifications/channels';

/**
 * Recordatorios. Nombres publicados: reminders-handle (recepción y
 * administración) y reminders-runNow (administración: procesa la cola sin
 * esperar la próxima ejecución programada; útil también en el emulador, que
 * no ejecuta tareas programadas).
 */
export const handle = callable((actor, data) =>
  handleReminder(firestoreRemindersGateway, firestoreAppointmentsGateway, actor, data),
);

export const runNow = callable(async (actor) => {
  requirePermission(actor, 'settings.manage');
  return processDueReminders(firestoreRemindersGateway, STAFF_CHANNELS);
});
