import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore';
import type { RoomDoc, ServiceDoc } from '@kinesalud/shared';
import { db } from '../../core/firebase';
import type {
  AppointmentsGateway,
  BookingTx,
  NewAppointment,
  StoredAppointment,
} from './appointmentsGateway';

const appointments = () => db.collection('appointments');
const locks = () => db.collection('scheduleLocks');

function toStored(id: string, d: DocumentData): StoredAppointment {
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
    createdBy: d.createdBy ?? null,
  };
}

/** Fechas de JS a Timestamp para guardar. */
function toFirestore(changes: Partial<NewAppointment>): DocumentData {
  const out: DocumentData = { ...changes };
  if (changes.startAt) out.startAt = Timestamp.fromDate(changes.startAt);
  if (changes.endAt) out.endAt = Timestamp.fromDate(changes.endAt);
  return out;
}

function bookingTx(tx: Transaction): BookingTx {
  const lockedDays = new Set<string>();
  let locksWritten = false;

  // Toda escritura actualiza los candados leídos: dos transacciones sobre el
  // mismo día chocan y Firestore reintenta una con los datos de la otra.
  const writeLocks = () => {
    if (locksWritten) return;
    locksWritten = true;
    for (const date of lockedDays) {
      tx.set(
        locks().doc(date),
        { version: FieldValue.increment(1), at: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
  };

  return {
    async lockDay(date) {
      if (lockedDays.has(date)) return;
      lockedDays.add(date);
      await tx.get(locks().doc(date));
    },

    async getClinic() {
      const snap = await tx.get(db.collection('settings').doc('clinic'));
      if (!snap.exists) return null;
      return {
        openingHours: snap.get('openingHours') ?? {},
        slotMinutes: snap.get('slotMinutes') ?? 15,
      };
    },

    async getProfessionals() {
      const snap = await tx.get(db.collection('professionals'));
      return snap.docs.map((d) => ({
        id: d.id,
        displayName: d.get('displayName'),
        active: d.get('active'),
        weeklySchedule: d.get('weeklySchedule') ?? {},
        serviceIds: d.get('serviceIds') ?? [],
      }));
    },

    async getExceptions(date) {
      const snap = await tx.get(
        db.collection('professionalExceptions').where('dateTo', '>=', date),
      );
      return snap.docs
        .map((d) => ({
          professionalId: d.get('professionalId'),
          dateFrom: d.get('dateFrom'),
          dateTo: d.get('dateTo'),
          type: d.get('type'),
        }))
        .filter((e) => e.dateFrom <= date);
    },

    async getRooms() {
      const snap = await tx.get(db.collection('rooms'));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RoomDoc) }));
    },

    async getService(id) {
      const snap = await tx.get(db.collection('services').doc(id));
      return snap.exists ? { id: snap.id, ...(snap.data() as ServiceDoc) } : null;
    },

    async getClient(id) {
      const snap = await tx.get(db.collection('clients').doc(id));
      if (!snap.exists) return null;
      return {
        id: snap.id,
        firstName: snap.get('firstName'),
        lastName: snap.get('lastName'),
        status: snap.get('status'),
      };
    },

    async getTreatment(id) {
      const snap = await tx.get(db.collection('treatments').doc(id));
      if (!snap.exists) return null;
      return {
        id: snap.id,
        clientId: snap.get('clientId'),
        serviceId: snap.get('serviceId'),
        status: snap.get('status'),
        plannedSessions: snap.get('plannedSessions'),
        completedSessions: snap.get('completedSessions'),
      };
    },

    async countOpenTreatmentAppointments(treatmentId) {
      const snap = await tx.get(
        appointments()
          .where('treatmentId', '==', treatmentId)
          .where('status', 'in', ['PENDIENTE', 'CONFIRMADA']),
      );
      return snap.size;
    },

    async getDayAppointments(date) {
      const snap = await tx.get(appointments().where('date', '==', date));
      return snap.docs.map((d) => toStored(d.id, d.data()));
    },

    async getAppointment(id) {
      const snap = await tx.get(appointments().doc(id));
      return snap.exists ? toStored(snap.id, snap.data()!) : null;
    },

    createAppointment(doc) {
      writeLocks();
      const ref = appointments().doc();
      tx.set(ref, {
        ...toFirestore(doc),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    },

    updateAppointment(id, changes) {
      writeLocks();
      tx.update(appointments().doc(id), {
        ...toFirestore(changes),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },

    addEvent(appointmentId, event) {
      writeLocks();
      tx.set(appointments().doc(appointmentId).collection('events').doc(), {
        ...event,
        at: FieldValue.serverTimestamp(),
      });
    },

    updateClient(id, changes) {
      writeLocks();
      const data: DocumentData = {};
      if (changes.addProfessionalId) {
        data.assignedProfessionalIds = FieldValue.arrayUnion(changes.addProfessionalId);
      }
      if (changes.noShowDelta)
        data['stats.noShowCount'] = FieldValue.increment(changes.noShowDelta);
      if (changes.lastVisitAt) data['stats.lastVisitAt'] = Timestamp.fromDate(changes.lastVisitAt);
      if (Object.keys(data).length > 0) tx.update(db.collection('clients').doc(id), data);
    },

    updateTreatment(id, { completedDelta }) {
      writeLocks();
      tx.update(db.collection('treatments').doc(id), {
        completedSessions: FieldValue.increment(completedDelta),
        ...(completedDelta > 0 ? { lastSessionAt: FieldValue.serverTimestamp() } : {}),
      });
    },
  };
}

/** Implementación con el Admin SDK: cada comando corre en una transacción. */
export const firestoreAppointmentsGateway: AppointmentsGateway = {
  run: (work) => db.runTransaction((tx) => work(bookingTx(tx))),

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
