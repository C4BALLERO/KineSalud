import type { CommandHandler } from '../../core/callable';
import { requireClinicWide } from '../../core/guards';
import { firestoreRemindersGateway } from '../../domain/reminders/firestoreRemindersGateway';
import { processDueReminders } from '../../domain/reminders/remindersService';
import { STAFF_CHANNELS } from '../../notifications/channels';
import * as appointments from '../callable/appointments';
import * as cash from '../callable/cash';
import * as clients from '../callable/clients';
import * as clinical from '../callable/clinical';
import * as reminders from '../callable/reminders';
import * as reports from '../callable/reports';
import * as settings from '../callable/settings';
import * as staff from '../callable/staff';
import * as treatments from '../callable/treatments';
import * as users from '../callable/users';

const MODULES = {
  appointments,
  cash,
  clients,
  clinical,
  reminders,
  reports,
  settings,
  staff,
  treatments,
  users,
};

function isCommand(value: unknown): value is { run: CommandHandler } {
  return typeof value === 'function' && typeof (value as { run?: unknown }).run === 'function';
}

/**
 * Comandos expuestos por HTTP, con los mismos nombres que las Cloud Functions
 * ("appointments-create", "cash-charge", …). Se arman a partir de los módulos
 * callable: cualquier comando nuevo queda disponible en ambos despliegues.
 */
export const COMMANDS: Record<string, CommandHandler> = Object.fromEntries(
  Object.entries(MODULES).flatMap(([module, exports]) =>
    Object.entries(exports)
      .filter(([, value]) => isCommand(value))
      .map(([name, value]) => [`${module}-${name}`, (value as { run: CommandHandler }).run]),
  ),
);

/**
 * Exclusivo del despliegue gratuito: sin Cloud Scheduler, la web de recepción
 * procesa la cola de recordatorios cada pocos minutos mientras está abierta.
 * Es idempotente: varias pestañas a la vez no duplican nada.
 */
COMMANDS['reminders-tick'] = async (actor) => {
  requireClinicWide(actor, 'reminders.manage');
  return processDueReminders(firestoreRemindersGateway, STAFF_CHANNELS);
};
