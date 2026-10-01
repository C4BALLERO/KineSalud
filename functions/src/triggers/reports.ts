import { toDateKey } from '@kinesalud/shared';
import type { Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { firestoreReportsGateway } from '../domain/reports/firestoreReportsGateway';
import { recomputeDailyIncome, recomputeDailyStats } from '../domain/reports/reportsService';

/**
 * Mantienen los resúmenes diarios de los reportes. Cada cambio recalcula el
 * día completo desde los datos originales (idempotente ante reintentos). Una
 * cita reprogramada a otro día actualiza los dos días.
 */
export const onAppointmentWritten = onDocumentWritten('appointments/{id}', async (event) => {
  const dates = new Set<string>();
  const before = event.data?.before.get('date') as string | undefined;
  const after = event.data?.after.get('date') as string | undefined;
  if (before) dates.add(before);
  if (after) dates.add(after);
  await Promise.all([...dates].map((d) => recomputeDailyStats(firestoreReportsGateway, d)));
});

export const onPaymentWritten = onDocumentWritten('payments/{id}', async (event) => {
  const date = (event.data?.after.get('date') ?? event.data?.before.get('date')) as
    string | undefined;
  if (date) await recomputeDailyIncome(firestoreReportsGateway, date);
});

export const onClientCreated = onDocumentCreated('clients/{id}', async (event) => {
  const createdAt = event.data?.get('createdAt') as Timestamp | undefined;
  if (createdAt) await recomputeDailyStats(firestoreReportsGateway, toDateKey(createdAt.toDate()));
});
