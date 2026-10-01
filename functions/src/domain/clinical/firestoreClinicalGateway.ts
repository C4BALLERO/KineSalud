import { FieldValue, type DocumentData, type Timestamp } from 'firebase-admin/firestore';
import { db } from '../../core/firebase';
import { bookingTx } from '../appointments/firestoreAppointmentsGateway';
import type { StoredAppointment } from '../appointments/appointmentsGateway';
import type { ClinicalGateway, StoredNote } from './clinicalGateway';

const records = () => db.collection('clinicalRecords');
const notesOf = (clientId: string) => records().doc(clientId).collection('sessionNotes');
const plansOf = (clientId: string) => records().doc(clientId).collection('treatmentPlans');

const toDate = (t: unknown) => (t ? (t as Timestamp).toDate() : null);

function toNote(d: DocumentData): StoredNote {
  return {
    appointmentId: d.appointmentId,
    treatmentId: d.treatmentId ?? null,
    sessionNumber: d.sessionNumber ?? null,
    date: d.date,
    serviceName: d.serviceName,
    professionalId: d.professionalId,
    professionalName: d.professionalName,
    observations: d.observations,
    evolution: d.evolution ?? null,
    recommendations: d.recommendations ?? null,
    painBefore: d.painBefore ?? null,
    painAfter: d.painAfter ?? null,
    createdAt: toDate(d.createdAt),
    createdBy: d.createdBy ?? { uid: null, name: null },
    updatedAt: toDate(d.updatedAt),
  };
}

function toAppointment(id: string, d: DocumentData): StoredAppointment {
  return {
    ...(d as Omit<StoredAppointment, 'id' | 'startAt' | 'endAt'>),
    id,
    startAt: (d.startAt as Timestamp).toDate(),
    endAt: (d.endAt as Timestamp).toDate(),
    bufferMin: d.bufferMin ?? 0,
    notes: d.notes ?? null,
    priceCents: d.priceCents ?? null,
    paymentStatus: d.paymentStatus ?? 'POR_COBRAR',
    paymentId: d.paymentId ?? null,
    sessionRecorded: d.sessionRecorded === true,
    createdBy: d.createdBy ?? null,
  };
}

/** Implementación con el Admin SDK (las reglas niegan todo acceso directo). */
export const firestoreClinicalGateway: ClinicalGateway = {
  async getClient(id) {
    const snap = await db.collection('clients').doc(id).get();
    return snap.exists
      ? { id: snap.id, assignedProfessionalIds: snap.get('assignedProfessionalIds') ?? [] }
      : null;
  },

  async getTreatment(id) {
    const snap = await db.collection('treatments').doc(id).get();
    return snap.exists
      ? { id: snap.id, clientId: snap.get('clientId'), professionalId: snap.get('professionalId') }
      : null;
  },

  async getAppointment(id) {
    const snap = await db.collection('appointments').doc(id).get();
    return snap.exists ? toAppointment(snap.id, snap.data()!) : null;
  },

  async getRecord(clientId) {
    const snap = await records().doc(clientId).get();
    if (!snap.exists) return null;
    return {
      background: snap.get('background') ?? null,
      alerts: snap.get('alerts') ?? null,
      updatedAt: toDate(snap.get('updatedAt')),
      updatedBy: snap.get('updatedBy') ?? { uid: null, name: null },
    };
  },

  async saveRecord(clientId, data) {
    await records()
      .doc(clientId)
      .set({ clientId, ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  },

  async getPlan(clientId, treatmentId) {
    const snap = await plansOf(clientId).doc(treatmentId).get();
    if (!snap.exists) return null;
    return {
      assessment: snap.get('assessment') ?? null,
      goals: snap.get('goals') ?? null,
      indications: snap.get('indications') ?? null,
      updatedAt: toDate(snap.get('updatedAt')),
      updatedBy: snap.get('updatedBy') ?? { uid: null, name: null },
    };
  },

  async savePlan(clientId, treatmentId, data) {
    await plansOf(clientId)
      .doc(treatmentId)
      .set({ treatmentId, ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  },

  async listNotes(clientId, treatmentId) {
    const ref = treatmentId
      ? notesOf(clientId).where('treatmentId', '==', treatmentId)
      : notesOf(clientId);
    const snap = await ref.get();
    return snap.docs.map((d) => toNote(d.data())).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getNote(clientId, appointmentId) {
    const snap = await notesOf(clientId).doc(appointmentId).get();
    return snap.exists ? toNote(snap.data()!) : null;
  },

  async updateNote(clientId, appointmentId, changes) {
    await notesOf(clientId)
      .doc(appointmentId)
      .update({ ...changes, updatedAt: FieldValue.serverTimestamp() });
  },

  runSession: (work) =>
    db.runTransaction((tx) =>
      work({
        ...bookingTx(tx),
        async getNote(clientId, appointmentId) {
          const snap = await tx.get(notesOf(clientId).doc(appointmentId));
          return snap.exists ? toNote(snap.data()!) : null;
        },
        createNote(clientId, note) {
          tx.set(notesOf(clientId).doc(note.appointmentId), {
            ...note,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: null,
          });
        },
      }),
    ),

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
