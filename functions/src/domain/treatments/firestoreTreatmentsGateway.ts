import { FieldValue, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import type { ServiceDoc } from '@kinesalud/shared';
import { db } from '../../core/firebase';
import type { StoredTreatment, TreatmentsGateway, TreatmentsTx } from './treatmentsGateway';

const treatments = () => db.collection('treatments');

function toStored(id: string, d: DocumentData): StoredTreatment {
  return {
    id,
    clientId: d.clientId,
    clientName: d.clientName,
    professionalId: d.professionalId,
    professionalName: d.professionalName,
    serviceId: d.serviceId,
    serviceName: d.serviceName,
    category: d.category,
    startDate: d.startDate,
    plannedSessions: d.plannedSessions,
    completedSessions: d.completedSessions ?? 0,
    status: d.status,
    statusReason: d.statusReason ?? null,
    notes: d.notes ?? null,
    createdBy: d.createdBy ?? null,
  };
}

function treatmentsTx(tx: Transaction): TreatmentsTx {
  return {
    async getClient(id) {
      const snap = await tx.get(db.collection('clients').doc(id));
      if (!snap.exists) return null;
      return {
        id: snap.id,
        firstName: snap.get('firstName'),
        lastName: snap.get('lastName'),
        status: snap.get('status'),
        assignedProfessionalIds: snap.get('assignedProfessionalIds') ?? [],
      };
    },

    async getService(id) {
      const snap = await tx.get(db.collection('services').doc(id));
      return snap.exists ? { id: snap.id, ...(snap.data() as ServiceDoc) } : null;
    },

    async getProfessional(id) {
      const snap = await tx.get(db.collection('professionals').doc(id));
      if (!snap.exists) return null;
      return {
        id: snap.id,
        displayName: snap.get('displayName'),
        active: snap.get('active') === true,
        serviceIds: snap.get('serviceIds') ?? [],
      };
    },

    async getTreatment(id) {
      const snap = await tx.get(treatments().doc(id));
      return snap.exists ? toStored(snap.id, snap.data()!) : null;
    },

    async getClientTreatments(clientId) {
      const snap = await tx.get(treatments().where('clientId', '==', clientId));
      return snap.docs.map((d) => toStored(d.id, d.data()));
    },

    async countOpenAppointments(treatmentId) {
      const snap = await tx.get(
        db
          .collection('appointments')
          .where('treatmentId', '==', treatmentId)
          .where('status', 'in', ['PENDIENTE', 'CONFIRMADA']),
      );
      return snap.size;
    },

    createTreatment(doc) {
      const ref = treatments().doc();
      tx.set(ref, {
        ...doc,
        statusChangedAt: null,
        nextAppointmentAt: null,
        lastSessionAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    },

    updateTreatment(id, { statusChanged, ...changes }) {
      tx.update(treatments().doc(id), {
        ...changes,
        ...(statusChanged ? { statusChangedAt: FieldValue.serverTimestamp() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },

    updateClient(id, { addProfessionalId, activeDelta }) {
      const data: DocumentData = {};
      if (addProfessionalId)
        data.assignedProfessionalIds = FieldValue.arrayUnion(addProfessionalId);
      if (activeDelta) data['stats.activeTreatments'] = FieldValue.increment(activeDelta);
      if (Object.keys(data).length > 0) tx.update(db.collection('clients').doc(id), data);
    },
  };
}

/** Implementación con el Admin SDK: cada comando corre en una transacción. */
export const firestoreTreatmentsGateway: TreatmentsGateway = {
  run: (work) => db.runTransaction((tx) => work(treatmentsTx(tx))),

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
