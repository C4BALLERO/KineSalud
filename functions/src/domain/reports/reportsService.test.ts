import {
  cellKey,
  clinicDateTime,
  type DailyIncomeDoc,
  type DailyStatsDoc,
} from '@kinesalud/shared';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type { AppointmentFact, PaymentFact, ReportsGateway } from './reportsGateway';
import { rebuildReports, recomputeDailyIncome, recomputeDailyStats } from './reportsService';

class InMemoryReports implements ReportsGateway {
  appointments = new Map<string, AppointmentFact[]>();
  clientsCreated = new Map<string, number>();
  payments = new Map<string, PaymentFact[]>();
  stats = new Map<string, DailyStatsDoc>();
  income = new Map<string, DailyIncomeDoc>();
  audits: AuditEntry[] = [];

  async appointmentsOn(date: string) {
    return this.appointments.get(date) ?? [];
  }
  async countClientsCreatedOn(date: string) {
    return this.clientsCreated.get(date) ?? 0;
  }
  async paymentsOn(date: string) {
    return this.payments.get(date) ?? [];
  }
  async saveDailyStats(doc: DailyStatsDoc) {
    this.stats.set(doc.date, doc);
  }
  async saveDailyIncome(doc: DailyIncomeDoc) {
    this.income.set(doc.date, doc);
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

const D = '2026-09-28';
const fact = (status: AppointmentFact['status']): AppointmentFact => ({
  professionalId: 'diego',
  category: 'FISIOTERAPIA',
  status,
  startAt: clinicDateTime(D, '09:00'),
  endAt: clinicDateTime(D, '09:45'),
});

describe('resúmenes diarios', () => {
  it('recalcular dos veces da el mismo resultado (seguro ante reintentos del trigger)', async () => {
    const gw = new InMemoryReports();
    gw.appointments.set(D, [fact('ATENDIDA'), fact('CANCELADA')]);
    gw.clientsCreated.set(D, 3);
    await recomputeDailyStats(gw, D);
    await recomputeDailyStats(gw, D);
    expect(gw.stats.get(D)).toEqual({
      date: D,
      newClients: 3,
      cells: {
        [cellKey('diego', 'FISIOTERAPIA')]: {
          PENDIENTE: 0,
          CONFIRMADA: 0,
          ATENDIDA: 1,
          CANCELADA: 1,
          NO_ASISTIO: 0,
          attendedMinutes: 45,
        },
      },
    });
  });

  it('un día sin cobros queda en cero', async () => {
    const gw = new InMemoryReports();
    await recomputeDailyIncome(gw, D);
    expect(gw.income.get(D)).toMatchObject({ totalCents: 0, count: 0 });
  });
});

describe('recálculo de un período', () => {
  const admin: Actor = { type: 'USER', uid: 'a', role: 'ADMINISTRADOR', channel: 'web' };
  const recep: Actor = { type: 'USER', uid: 'r', role: 'RECEPCIONISTA', channel: 'web' };

  it('solo la administración lo ejecuta, y recorre cada día', async () => {
    const gw = new InMemoryReports();
    await expect(rebuildReports(gw, recep, { from: D, to: D })).rejects.toBeInstanceOf(DomainError);
    await expect(
      rebuildReports(gw, admin, { from: '2026-09-28', to: '2026-10-04' }),
    ).resolves.toEqual({
      days: 7,
    });
    expect(gw.stats.size).toBe(7);
    expect(gw.income.size).toBe(7);
    expect(gw.audits[0]?.action).toBe('reports.rebuild');
  });
});
