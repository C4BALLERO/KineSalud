import type {
  CashSessionDoc,
  ChargeInput,
  ChargeResult,
  CloseCashInput,
  CloseCashResult,
  DateKey,
  IncomeStatsDoc,
  OpenCashInput,
  PaymentDoc,
  VoidPaymentInput,
} from '@kinesalud/shared';
import { emptyMethodTotals } from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { toAgendaAppointment } from '@/features/appointments/api/appointments';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

export type CashSession = Omit<CashSessionDoc<Date>, 'openedAt' | 'closedAt'> & {
  id: string;
  openedAt: Date | null;
  closedAt: Date | null;
};

export type Payment = Omit<PaymentDoc<Date>, 'paidAt' | 'voidedAt'> & {
  id: string;
  paidAt: Date | null;
  voidedAt: Date | null;
};

const toDate = (t: Timestamp | null | undefined) => t?.toDate() ?? null;

function toSession(id: string, d: DocumentData): CashSession {
  const s = d as CashSessionDoc<Timestamp | null>;
  return {
    ...s,
    id,
    totals: { ...emptyMethodTotals(), ...s.totals },
    openedAt: toDate(s.openedAt),
    closedAt: toDate(s.closedAt),
  };
}

export function toPayment(id: string, d: DocumentData): Payment {
  const p = d as PaymentDoc<Timestamp | null>;
  return { ...p, id, paidAt: toDate(p.paidAt), voidedAt: toDate(p.voidedAt) };
}

/** Caja abierta del consultorio (a lo sumo una); `null` si está cerrada. */
export function useOpenSessionId(enabled = true) {
  const state = useLiveDoc(
    enabled ? 'cashRegister/main' : null,
    () => doc(db, 'cashRegister', 'main'),
    (snap) => (snap.get('openSessionId') as string | null | undefined) ?? null,
  );
  // Sin documento todavía: la caja nunca se abrió.
  if (state.status === 'not-found') return { ...state, status: 'success' as const, data: null };
  return state;
}

export function useCashSession(id: string | null) {
  return useLiveDoc(
    id ? `cashSessions/${id}` : null,
    () => doc(db, 'cashSessions', id!),
    (snap) => toSession(snap.id, snap.data()!),
  );
}

/** Últimas cajas (la abierta, si hay, incluida): el historial de cierres. */
export function useRecentSessions(max = 30, enabled = true) {
  return useLiveQuery(
    enabled ? `cashSessions|recent|${max}` : null,
    () => query(collection(db, 'cashSessions'), orderBy('openedAt', 'desc'), limit(max)),
    (d) => toSession(d.id, d.data()),
  );
}

export function useSessionPayments(sessionId: string | null) {
  return useLiveQuery(
    sessionId ? `payments|session|${sessionId}` : null,
    () =>
      query(
        collection(db, 'payments'),
        where('cashSessionId', '==', sessionId),
        orderBy('paidAt', 'desc'),
      ),
    (d) => toPayment(d.id, d.data()),
  );
}

/** Cobros de un día (recepción y administración). */
export function useDayPayments(date: DateKey, enabled = true) {
  return useLiveQuery(
    enabled ? `payments|day|${date}` : null,
    () => query(collection(db, 'payments'), where('date', '==', date), orderBy('paidAt', 'desc')),
    (d) => toPayment(d.id, d.data()),
  );
}

/** Cobros de las sesiones de un profesional entre dos fechas. */
export function useProfessionalPayments(professionalId: string | null, from: DateKey, to: DateKey) {
  return useLiveQuery(
    professionalId ? `payments|professional|${professionalId}|${from}|${to}` : null,
    () =>
      query(
        collection(db, 'payments'),
        where('professionalId', '==', professionalId),
        where('date', '>=', from),
        where('date', '<=', to),
      ),
    (d) => toPayment(d.id, d.data()),
  );
}

export function usePayment(id: string | null) {
  return useLiveDoc(
    id ? `payments/${id}` : null,
    () => doc(db, 'payments', id!),
    (snap) => toPayment(snap.id, snap.data()!),
  );
}

/** Ingresos del mes (`YYYY-MM`), solo administración. */
export function useIncomeStats(month: string, enabled = true) {
  const state = useLiveDoc(
    enabled ? `incomeStats/${month}` : null,
    () => doc(db, 'incomeStats', month),
    (snap) => snap.data() as IncomeStatsDoc,
  );
  // Un mes sin cobros no tiene documento: equivale a ceros.
  if (state.status === 'not-found') {
    return {
      ...state,
      status: 'success' as const,
      data: {
        month,
        totalCents: 0,
        count: 0,
        byMethod: emptyMethodTotals(),
        byDay: {},
        byProfessional: {},
        byCategory: {},
      } satisfies IncomeStatsDoc,
    };
  }
  return state;
}

/* ---------- Citas por cobrar ---------- */

/** Citas del día (se filtran en la UI las que aún se pueden cobrar). */
export function useDayAppointments(date: DateKey, enabled = true) {
  return useLiveQuery(
    enabled ? `appointments|charge|${date}` : null,
    () => query(collection(db, 'appointments'), where('date', '==', date), orderBy('startAt')),
    (d) => toAgendaAppointment(d.id, d.data()),
  );
}

/** Sesiones atendidas de días anteriores que quedaron sin cobrar. */
export function useOverdueCharges(before: DateKey, enabled = true) {
  return useLiveQuery(
    enabled ? `appointments|overdue|${before}` : null,
    () =>
      query(
        collection(db, 'appointments'),
        where('paymentStatus', '==', 'POR_COBRAR'),
        where('status', '==', 'ATENDIDA'),
        where('date', '<', before),
        orderBy('date', 'desc'),
        limit(30),
      ),
    (d) => toAgendaAppointment(d.id, d.data()),
  );
}

/* ---------- Comandos ---------- */

export function useOpenCash() {
  return useMutation({
    mutationFn: (input: OpenCashInput) =>
      callFunction<OpenCashInput, { sessionId: string }>('cash-open', input),
  });
}

export function useCloseCash() {
  return useMutation({
    mutationFn: (input: CloseCashInput) =>
      callFunction<CloseCashInput, CloseCashResult>('cash-close', input),
  });
}

export function useCharge() {
  return useMutation({
    mutationFn: (input: ChargeInput) =>
      callFunction<ChargeInput, ChargeResult>('cash-charge', input),
  });
}

export function useVoidPayment() {
  return useMutation({
    mutationFn: (input: VoidPaymentInput) =>
      callFunction<VoidPaymentInput>('cash-voidPayment', input),
  });
}
