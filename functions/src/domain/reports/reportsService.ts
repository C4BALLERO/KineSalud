import {
  addDays,
  aggregateAppointments,
  aggregatePayments,
  rebuildReportsInputSchema,
  type DateKey,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { parseInput, requirePermission } from '../../core/guards';
import { auditActor } from '../audit';
import type { ReportsGateway } from './reportsGateway';

/**
 * Recalcula el resumen de citas de un día desde las citas originales. Es
 * idempotente: si un trigger se ejecuta dos veces, el resultado es el mismo.
 */
export async function recomputeDailyStats(gateway: ReportsGateway, date: DateKey): Promise<void> {
  const [appointments, newClients] = await Promise.all([
    gateway.appointmentsOn(date),
    gateway.countClientsCreatedOn(date),
  ]);
  await gateway.saveDailyStats({ date, cells: aggregateAppointments(appointments), newClients });
}

export async function recomputeDailyIncome(gateway: ReportsGateway, date: DateKey): Promise<void> {
  await gateway.saveDailyIncome(aggregatePayments(date, await gateway.paymentsOn(date)));
}

/**
 * Recalcula un período completo (administración). Sirve para datos cargados
 * antes de activar los reportes o para reparar un resumen.
 */
export async function rebuildReports(
  gateway: ReportsGateway,
  actor: Actor,
  data: unknown,
): Promise<{ days: number }> {
  requirePermission(actor, 'settings.manage');
  const { from, to } = parseInput(rebuildReportsInputSchema, data);
  let days = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    await Promise.all([recomputeDailyStats(gateway, d), recomputeDailyIncome(gateway, d)]);
    days += 1;
  }
  await gateway.audit({
    actor: auditActor(actor),
    action: 'reports.rebuild',
    entity: 'dailyStats',
    entityId: `${from}_${to}`,
  });
  return { days };
}
