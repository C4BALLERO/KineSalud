import type { Timestamp } from 'firebase-admin/firestore';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { emptyMethodTotals, monthKeyOf } from '@kinesalud/shared';
import { db } from '../../core/firebase';
import type { StoredAppointment } from '../appointments/appointmentsGateway';
import type {
  PaymentsGateway,
  PaymentsTx,
  StoredCashSession,
  StoredPayment,
} from './paymentsGateway';

const register = () => db.collection('cashRegister').doc('main');
const sessions = () => db.collection('cashSessions');
const payments = () => db.collection('payments');
const appointments = () => db.collection('appointments');

function paymentsTx(tx: Transaction): PaymentsTx {
  return {
    async getOpenSessionId() {
      const snap = await tx.get(register());
      return (snap.get('openSessionId') as string | null | undefined) ?? null;
    },

    async getSession(id) {
      const snap = await tx.get(sessions().doc(id));
      if (!snap.exists) return null;
      const { openedAt: _o, closedAt: _c, ...rest } = snap.data()!;
      return { ...(rest as Omit<StoredCashSession, 'id'>), id: snap.id };
    },

    async getAppointment(id) {
      const snap = await tx.get(appointments().doc(id));
      if (!snap.exists) return null;
      const d = snap.data()!;
      return {
        ...(d as Omit<StoredAppointment, 'id' | 'startAt' | 'endAt'>),
        id: snap.id,
        startAt: (d.startAt as Timestamp).toDate(),
        endAt: (d.endAt as Timestamp).toDate(),
        priceCents: d.priceCents ?? null,
        paymentStatus: d.paymentStatus ?? 'POR_COBRAR',
        paymentId: d.paymentId ?? null,
        sessionRecorded: d.sessionRecorded === true,
      };
    },

    async getServicePrice(serviceId) {
      const snap = await tx.get(db.collection('services').doc(serviceId));
      return (snap.get('priceCents') as number | null | undefined) ?? null;
    },

    async getPayment(id) {
      const snap = await tx.get(payments().doc(id));
      if (!snap.exists) return null;
      const { paidAt: _p, voidedAt: _v, ...rest } = snap.data()!;
      return { ...(rest as Omit<StoredPayment, 'id'>), id: snap.id };
    },

    openSession(doc) {
      const ref = sessions().doc();
      tx.set(ref, {
        ...doc,
        status: 'ABIERTA',
        openedAt: FieldValue.serverTimestamp(),
        totals: emptyMethodTotals(),
        paymentsCount: 0,
        closedAt: null,
        closedBy: null,
        expectedCashCents: null,
        countedCashCents: null,
        differenceCents: null,
        closingNote: null,
      });
      tx.set(register(), { openSessionId: ref.id }, { merge: true });
      return ref.id;
    },

    closeSession(id, changes) {
      tx.update(sessions().doc(id), {
        ...changes,
        status: 'CERRADA',
        closedAt: FieldValue.serverTimestamp(),
      });
      tx.set(register(), { openSessionId: null }, { merge: true });
    },

    createPayment(doc) {
      const ref = payments().doc();
      tx.set(ref, {
        ...doc,
        status: 'VALIDO',
        paidAt: FieldValue.serverTimestamp(),
        voidReason: null,
        voidedAt: null,
        voidedBy: null,
      });
      return ref.id;
    },

    voidPayment(id, changes) {
      tx.update(payments().doc(id), {
        ...changes,
        status: 'ANULADO',
        voidedAt: FieldValue.serverTimestamp(),
      });
    },

    setAppointmentPayment(appointmentId, paymentId) {
      tx.update(appointments().doc(appointmentId), {
        paymentStatus: paymentId ? 'PAGADA' : 'POR_COBRAR',
        paymentId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    },

    addAppointmentEvent(appointmentId, event) {
      tx.set(appointments().doc(appointmentId).collection('events').doc(), {
        ...event,
        at: FieldValue.serverTimestamp(),
      });
    },

    applyIncome(sessionId, delta) {
      const inc = FieldValue.increment;
      tx.update(sessions().doc(sessionId), {
        [`totals.${delta.method}`]: inc(delta.amountCents),
        paymentsCount: inc(delta.count),
      });
      // set con merge fusiona los mapas anidados: cada cobro solo suma a sus claves.
      const month = monthKeyOf(delta.date);
      tx.set(
        db.collection('incomeStats').doc(month),
        {
          month,
          totalCents: inc(delta.amountCents),
          count: inc(delta.count),
          byMethod: { [delta.method]: inc(delta.amountCents) },
          byDay: { [delta.date.slice(8, 10)]: inc(delta.amountCents) },
          byProfessional: { [delta.professionalId]: inc(delta.amountCents) },
          byCategory: { [delta.category]: inc(delta.amountCents) },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    },
  };
}

/** Implementación con el Admin SDK: cada comando corre en una transacción. */
export const firestorePaymentsGateway: PaymentsGateway = {
  run: (work) => db.runTransaction((tx) => work(paymentsTx(tx))),

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
