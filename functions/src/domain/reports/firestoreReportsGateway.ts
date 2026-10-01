import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { addDays, clinicDateTime } from '@kinesalud/shared';
import { db } from '../../core/firebase';
import type { ReportsGateway } from './reportsGateway';

/** Implementación con el Admin SDK. */
export const firestoreReportsGateway: ReportsGateway = {
  async appointmentsOn(date) {
    const snap = await db.collection('appointments').where('date', '==', date).get();
    return snap.docs.map((d) => ({
      professionalId: d.get('professionalId'),
      category: d.get('category'),
      status: d.get('status'),
      startAt: (d.get('startAt') as Timestamp).toDate(),
      endAt: (d.get('endAt') as Timestamp).toDate(),
    }));
  },

  async countClientsCreatedOn(date) {
    const snap = await db
      .collection('clients')
      .where('createdAt', '>=', Timestamp.fromDate(clinicDateTime(date, '00:00')))
      .where('createdAt', '<', Timestamp.fromDate(clinicDateTime(addDays(date, 1), '00:00')))
      .count()
      .get();
    return snap.data().count;
  },

  async paymentsOn(date) {
    const snap = await db.collection('payments').where('date', '==', date).get();
    return snap.docs.map((d) => ({
      status: d.get('status'),
      method: d.get('method'),
      amountCents: d.get('amountCents'),
      professionalId: d.get('professionalId'),
      category: d.get('category'),
    }));
  },

  async saveDailyStats(doc) {
    await db
      .collection('dailyStats')
      .doc(doc.date)
      .set({ ...doc, updatedAt: FieldValue.serverTimestamp() });
  },

  async saveDailyIncome(doc) {
    await db
      .collection('dailyIncome')
      .doc(doc.date)
      .set({ ...doc, updatedAt: FieldValue.serverTimestamp() });
  },

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
