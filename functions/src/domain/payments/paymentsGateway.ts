import type {
  AppointmentEventDoc,
  CashSessionDoc,
  Cents,
  PaymentDoc,
  PaymentMethod,
  TreatmentCategory,
} from '@kinesalud/shared';
import type { AuditEntry } from '../audit';
import type { StoredAppointment } from '../appointments/appointmentsGateway';

export type StoredCashSession = Omit<CashSessionDoc<Date>, 'openedAt' | 'closedAt'> & {
  id: string;
};
export type StoredPayment = Omit<PaymentDoc<Date>, 'paidAt' | 'voidedAt'> & { id: string };

export type NewPayment = Omit<
  PaymentDoc,
  'paidAt' | 'voidedAt' | 'status' | 'voidReason' | 'voidedBy'
>;
export type NewCashSession = Pick<
  CashSessionDoc,
  'date' | 'openedBy' | 'openingCents' | 'openingNote'
>;

/** Movimiento de un cobro sobre los acumulados (negativo al anular). */
export interface IncomeDelta {
  date: string;
  method: PaymentMethod;
  amountCents: Cents;
  count: 1 | -1;
  professionalId: string;
  category: TreatmentCategory;
}

/**
 * Operaciones dentro de una transacción. Todas las lecturas van antes de
 * cualquier escritura (requisito de Firestore). `cashRegister/main` se lee en
 * cada comando: así abrir, cobrar y cerrar la caja quedan serializados.
 */
export interface PaymentsTx {
  getOpenSessionId(): Promise<string | null>;
  getSession(id: string): Promise<StoredCashSession | null>;
  getAppointment(id: string): Promise<StoredAppointment | null>;
  /** Precio actual del servicio (para citas agendadas antes de tener precio). */
  getServicePrice(serviceId: string): Promise<Cents | null>;
  getPayment(id: string): Promise<StoredPayment | null>;

  openSession(doc: NewCashSession): string;
  closeSession(
    id: string,
    changes: Pick<
      CashSessionDoc,
      'closedBy' | 'expectedCashCents' | 'countedCashCents' | 'differenceCents' | 'closingNote'
    >,
  ): void;
  createPayment(doc: NewPayment): string;
  voidPayment(id: string, changes: Pick<PaymentDoc, 'voidReason' | 'voidedBy'>): void;
  setAppointmentPayment(appointmentId: string, paymentId: string | null): void;
  addAppointmentEvent(appointmentId: string, event: Omit<AppointmentEventDoc, 'at'>): void;
  /** Suma el cobro a la caja y a los ingresos del mes. */
  applyIncome(sessionId: string, delta: IncomeDelta): void;
}

export interface PaymentsGateway {
  run<T>(work: (tx: PaymentsTx) => Promise<T>): Promise<T>;
  audit(entry: AuditEntry): Promise<void>;
}
