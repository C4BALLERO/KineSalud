import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { db } from '../../core/firebase';
import type { ServiceRef, StaffGateway, StoredException, StoredProfessional } from './staffGateway';

const professionals = () => db.collection('professionals');
const exceptions = () => db.collection('professionalExceptions');

function toException(id: string, d: DocumentData): StoredException {
  return {
    id,
    professionalId: d.professionalId,
    dateFrom: d.dateFrom,
    dateTo: d.dateTo,
    type: d.type,
  };
}

/** Implementación con el Admin SDK. */
export const firestoreStaffGateway: StaffGateway = {
  async getProfessional(id) {
    const snap = await professionals().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<StoredProfessional, 'id'>) };
  },

  async createProfessional(doc) {
    const ref = professionals().doc();
    await ref.set({
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  },

  async updateProfessional(id, changes) {
    await professionals()
      .doc(id)
      .update({ ...changes, updatedAt: FieldValue.serverTimestamp() });
  },

  async getServices(ids) {
    if (ids.length === 0) return [];
    const snaps = await db.getAll(...ids.map((id) => db.collection('services').doc(id)));
    return snaps
      .filter((s) => s.exists)
      .map((s): ServiceRef => ({ id: s.id, name: s.get('name'), category: s.get('category') }));
  },

  async getOpeningHours() {
    const snap = await db.collection('settings').doc('clinic').get();
    return snap.exists ? (snap.get('openingHours') ?? null) : null;
  },

  async listExceptions(professionalId, fromDate) {
    const snap = await exceptions()
      .where('professionalId', '==', professionalId)
      .where('dateTo', '>=', fromDate)
      .get();
    return snap.docs.map((d) => toException(d.id, d.data()));
  },

  async getException(id) {
    const snap = await exceptions().doc(id).get();
    return snap.exists ? toException(snap.id, snap.data()!) : null;
  },

  async addException(doc) {
    const ref = await exceptions().add({ ...doc, createdAt: FieldValue.serverTimestamp() });
    return ref.id;
  },

  async deleteException(id) {
    await exceptions().doc(id).delete();
  },

  async countActiveAppointments(professionalId, from, to) {
    const snap = await db
      .collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('date', '>=', from)
      .where('date', '<=', to)
      .where('status', 'in', ['PENDIENTE', 'CONFIRMADA'])
      .count()
      .get();
    return snap.data().count;
  },

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
