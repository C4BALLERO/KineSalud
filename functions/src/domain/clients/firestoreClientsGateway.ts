import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../core/firebase';
import { DomainError } from '../../core/errors';
import type { ClientsGateway, StoredClient } from './clientsGateway';

const clients = () => db.collection('clients');
const ciIndex = () => db.collection('clientCiIndex');

function duplicateCi(existingClientId: string): DomainError {
  return new DomainError(
    'already-exists',
    'Ya existe un cliente registrado con este número de carnet.',
    {
      field: 'ci',
      clientId: existingClientId,
    },
  );
}

/** Implementación con el Admin SDK. El CI único se garantiza con transacciones. */
export const firestoreClientsGateway: ClientsGateway = {
  async create(fields, createdBy) {
    const ref = clients().doc();
    await db.runTransaction(async (tx) => {
      const indexRef = ciIndex().doc(fields.ci);
      const existing = await tx.get(indexRef);
      if (existing.exists) throw duplicateCi(existing.get('clientId'));
      tx.set(indexRef, { clientId: ref.id });
      tx.set(ref, {
        ...fields,
        status: 'ACTIVO',
        assignedProfessionalIds: [],
        stats: { lastVisitAt: null, activeTreatments: 0, noShowCount: 0 },
        createdAt: FieldValue.serverTimestamp(),
        createdBy,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return ref.id;
  },

  async get(clientId) {
    const snap = await clients().doc(clientId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<StoredClient, 'id'>) };
  },

  async update(clientId, fields, previousCi) {
    await db.runTransaction(async (tx) => {
      if (fields.ci !== previousCi) {
        const newIndexRef = ciIndex().doc(fields.ci);
        const existing = await tx.get(newIndexRef);
        if (existing.exists && existing.get('clientId') !== clientId) {
          throw duplicateCi(existing.get('clientId'));
        }
        tx.delete(ciIndex().doc(previousCi));
        tx.set(newIndexRef, { clientId });
      }
      tx.update(clients().doc(clientId), { ...fields, updatedAt: FieldValue.serverTimestamp() });
    });
  },

  async setStatus(clientId, status) {
    await clients().doc(clientId).update({ status, updatedAt: FieldValue.serverTimestamp() });
  },

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
