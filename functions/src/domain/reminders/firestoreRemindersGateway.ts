import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { db } from '../../core/firebase';
import type { RemindersGateway, StoredReminder } from './remindersGateway';

const reminders = () => db.collection('reminders');
const toDate = (t: unknown) => (t ? (t as Timestamp).toDate() : null);

function toStored(id: string, d: DocumentData): StoredReminder {
  return {
    ...(d as Omit<StoredReminder, 'id'>),
    id,
    appointmentStartAt: toDate(d.appointmentStartAt)!,
    scheduledFor: toDate(d.scheduledFor)!,
    sentAt: toDate(d.sentAt),
    handledAt: toDate(d.handledAt),
    attempts: d.attempts ?? 0,
    lastError: d.lastError ?? null,
    outcomeNote: d.outcomeNote ?? null,
    handledBy: d.handledBy ?? null,
  };
}

/** Fechas de JS a Timestamp (los demás campos se guardan tal cual). */
function toFirestore(changes: Partial<Omit<StoredReminder, 'id'>>): DocumentData {
  const out: DocumentData = { ...changes };
  for (const key of ['appointmentStartAt', 'scheduledFor', 'sentAt', 'handledAt'] as const) {
    const v = changes[key];
    if (v instanceof Date) out[key] = Timestamp.fromDate(v);
  }
  return out;
}

/** Implementación con el Admin SDK. */
export const firestoreRemindersGateway: RemindersGateway = {
  async getReminder(id) {
    const snap = await reminders().doc(id).get();
    return snap.exists ? toStored(snap.id, snap.data()!) : null;
  },

  async saveReminder(id, changes) {
    const ref = reminders().doc(id);
    const exists = (await ref.get()).exists;
    await ref.set(
      {
        ...toFirestore(changes),
        updatedAt: FieldValue.serverTimestamp(),
        ...(exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );
  },

  async getAppointment(id) {
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
  },

  async getClientContact(clientId) {
    const snap = await db.collection('clients').doc(clientId).get();
    return {
      phone: (snap.get('phone') as string | undefined) ?? null,
      phoneE164: (snap.get('phoneE164') as string | undefined) ?? null,
    };
  },

  async getLeadHours() {
    const snap = await db.collection('settings').doc('clinic').get();
    return (snap.get('reminderLeadHours') as number | undefined) ?? 24;
  },

  async listDue(now, max) {
    const snap = await reminders()
      .where('status', '==', 'PROGRAMADO')
      .where('scheduledFor', '<=', Timestamp.fromDate(now))
      .orderBy('scheduledFor')
      .limit(max)
      .get();
    return snap.docs.map((d) => toStored(d.id, d.data()));
  },

  async listFrontDeskUserIds() {
    const snap = await db
      .collection('users')
      .where('role', 'in', ['ADMINISTRADOR', 'RECEPCIONISTA'])
      .where('active', '==', true)
      .get();
    return snap.docs.map((d) => d.id);
  },

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
