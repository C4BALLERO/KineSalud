import { z } from 'zod';
import { optionalText } from './clients';
import type { AppointmentStatus, TreatmentCategory } from './enums';
import type { DateKey } from './time';

/**
 * Cobros y caja. Los montos se guardan en **centavos** (enteros) para evitar
 * errores de redondeo: Bs 150,50 = 15050.
 */
export type Cents = number;

export const CURRENCY = 'BOB';
/** Tope de un monto (Bs 100 000): evita errores de tipeo como 15000000. */
export const MAX_AMOUNT_CENTS = 10_000_000;

export const PAYMENT_METHODS = ['EFECTIVO', 'QR', 'TARJETA'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  QR: 'QR / transferencia',
  TARJETA: 'Tarjeta',
};

/** Estado de pago de una cita. */
export const APPOINTMENT_PAYMENT_STATUSES = ['POR_COBRAR', 'PAGADA'] as const;
export type AppointmentPaymentStatus = (typeof APPOINTMENT_PAYMENT_STATUSES)[number];

export const APPOINTMENT_PAYMENT_STATUS_LABELS: Record<AppointmentPaymentStatus, string> = {
  POR_COBRAR: 'Por cobrar',
  PAGADA: 'Pagada',
};

export const PAYMENT_STATUSES = ['VALIDO', 'ANULADO'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CASH_SESSION_STATUSES = ['ABIERTA', 'CERRADA'] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export type MethodTotals = Record<PaymentMethod, Cents>;

export function emptyMethodTotals(): MethodTotals {
  return { EFECTIVO: 0, QR: 0, TARJETA: 0 };
}

/** Quién hizo una operación de caja (copia desnormalizada para el historial). */
export interface CashActor {
  uid: string | null;
  name: string | null;
}

/** Documento `payments/{id}`: un cobro de una cita. */
export interface PaymentDoc<Ts = unknown> {
  appointmentId: string;
  clientId: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  category: TreatmentCategory;
  appointmentDate: DateKey;
  /** Precio de lista de la cita al momento de cobrar. */
  listPriceCents: Cents;
  discountCents: Cents;
  discountReason: string | null;
  /** Lo que efectivamente se cobró: precio − descuento. */
  amountCents: Cents;
  method: PaymentMethod;
  /** Solo efectivo: lo que entregó el cliente y el cambio devuelto. */
  receivedCents: Cents | null;
  changeCents: Cents | null;
  /** QR o tarjeta: número de operación o comprobante (opcional). */
  reference: string | null;
  cashSessionId: string;
  /** Día del consultorio en que se cobró (clave de los reportes). */
  date: DateKey;
  paidAt: Ts;
  createdBy: CashActor;
  status: PaymentStatus;
  voidReason: string | null;
  voidedAt: Ts | null;
  voidedBy: CashActor | null;
}

/** Documento `cashSessions/{id}`: una apertura y cierre de la caja del consultorio. */
export interface CashSessionDoc<Ts = unknown> {
  status: CashSessionStatus;
  /** Día del consultorio en que se abrió. */
  date: DateKey;
  openedAt: Ts;
  openedBy: CashActor;
  openingCents: Cents;
  openingNote: string | null;
  /** Cobros válidos de esta caja, por medio de pago. */
  totals: MethodTotals;
  paymentsCount: number;
  closedAt: Ts | null;
  closedBy: CashActor | null;
  /** Efectivo esperado al cerrar: monto inicial + cobros en efectivo. */
  expectedCashCents: Cents | null;
  countedCashCents: Cents | null;
  /** Contado − esperado: positivo = sobrante, negativo = faltante. */
  differenceCents: Cents | null;
  closingNote: string | null;
}

/** Documento `cashRegister/main`: qué caja está abierta (a lo sumo una). */
export interface CashRegisterDoc {
  openSessionId: string | null;
}

/** Documento `incomeStats/{YYYY-MM}`: ingresos del mes, mantenidos en cada cobro. */
export interface IncomeStatsDoc {
  month: string;
  totalCents: Cents;
  count: number;
  byMethod: MethodTotals;
  /** Clave: día del mes con dos dígitos ("07"). */
  byDay: Record<string, Cents>;
  byProfessional: Record<string, Cents>;
  byCategory: Partial<Record<TreatmentCategory, Cents>>;
}

export function monthKeyOf(date: DateKey): string {
  return date.slice(0, 7);
}

export function expectedCash(session: Pick<CashSessionDoc, 'openingCents' | 'totals'>): Cents {
  return session.openingCents + session.totals.EFECTIVO;
}

export function totalOf(totals: MethodTotals): Cents {
  return totals.EFECTIVO + totals.QR + totals.TARJETA;
}

/* ---------- Montos ---------- */

/**
 * Interpreta un monto escrito en bolivianos: "150", "150,5", "150.50",
 * "Bs 1.500,00" o "1,500.00". Devuelve centavos, o null si no es válido.
 */
export function parseMoney(text: string): Cents | null {
  const s = text.replace(/bs\.?/i, '').replace(/\s/g, '');
  const cents = (int: string, dec = '') => Number(int) * 100 + Number(dec.padEnd(2, '0'));
  // Con separador de miles: 1.500 · 1,500 · 1.500,50 · 1,500.50
  const grouped = /^(\d{1,3}(?:([.,])\d{3})+)(?:([.,])(\d{1,2}))?$/.exec(s);
  if (grouped && grouped[3] !== grouped[2]) {
    return cents(grouped[1]!.replace(/[.,]/g, ''), grouped[4]);
  }
  const plain = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  return plain ? cents(plain[1]!, plain[2]) : null;
}

/** Centavos como texto editable: 15050 → "150,50"; 15000 → "150". */
export function centsToInput(cents: Cents): string {
  const int = Math.floor(cents / 100);
  const dec = cents % 100;
  return dec === 0 ? String(int) : `${int},${String(dec).padStart(2, '0')}`;
}

/** Billetes en circulación en Bolivia, en centavos. */
const BILLS: Cents[] = [1000, 2000, 5000, 10000, 20000];

/**
 * Montos que probablemente entregue el cliente: el exacto y los primeros
 * redondeos a billetes por encima (p. ej. 135 → 135, 140, 150, 200).
 */
export function suggestedReceived(amount: Cents, max = 4): Cents[] {
  if (amount <= 0) return [];
  const out = new Set<Cents>([amount]);
  for (const bill of BILLS) {
    out.add(Math.ceil(amount / bill) * bill);
  }
  return [...out].sort((a, b) => a - b).slice(0, max);
}

/** Cambio a devolver, o null si lo recibido no alcanza. */
export function changeFor(amount: Cents, received: Cents): Cents | null {
  return received >= amount ? received - amount : null;
}

/* ---------- Estado de pago de la cita ---------- */

const CHARGEABLE: readonly AppointmentStatus[] = ['PENDIENTE', 'CONFIRMADA', 'ATENDIDA'];

/** Se cobra antes o después de la sesión; nunca una cita cancelada, perdida o ya pagada. */
export function canCharge(appointment: {
  status: AppointmentStatus;
  paymentStatus?: AppointmentPaymentStatus | null;
}): boolean {
  return CHARGEABLE.includes(appointment.status) && appointment.paymentStatus !== 'PAGADA';
}

/* ---------- Esquemas de los comandos ---------- */

const idSchema = z.string().trim().min(1).max(128);

export const centsSchema = (message: string) =>
  z
    .number({ error: message })
    .int(message)
    .min(0, 'No puede ser negativo.')
    .max(MAX_AMOUNT_CENTS, 'El monto es demasiado alto.');

export const chargeInputSchema = z
  .object({
    appointmentId: idSchema,
    method: z.enum(PAYMENT_METHODS, { error: 'Elige el medio de pago.' }),
    discountCents: centsSchema('Ingresa un descuento válido.').default(0),
    discountReason: optionalText(120, 'Máximo 120 caracteres.'),
    receivedCents: centsSchema('Ingresa el monto recibido.').nullable().default(null),
    reference: optionalText(40, 'Máximo 40 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.discountCents > 0 && !v.discountReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountReason'],
        message: 'Indica el motivo del descuento.',
      });
    }
    if (v.method === 'EFECTIVO' && v.receivedCents === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedCents'],
        message: 'Ingresa el monto que entregó el cliente.',
      });
    }
  });
export type ChargeInput = z.input<typeof chargeInputSchema>;

export interface ChargeResult {
  paymentId: string;
  amountCents: Cents;
  changeCents: Cents | null;
}

export const openCashInputSchema = z.object({
  openingCents: centsSchema('Ingresa el monto inicial (0 si la caja empieza vacía).'),
  note: optionalText(200, 'Máximo 200 caracteres.'),
});
export type OpenCashInput = z.input<typeof openCashInputSchema>;

export const closeCashInputSchema = z.object({
  sessionId: idSchema,
  countedCashCents: centsSchema('Ingresa el efectivo contado.'),
  note: optionalText(300, 'Máximo 300 caracteres.'),
});
export type CloseCashInput = z.input<typeof closeCashInputSchema>;

export interface CloseCashResult {
  expectedCashCents: Cents;
  differenceCents: Cents;
}

export const voidPaymentInputSchema = z.object({
  paymentId: idSchema,
  reason: z
    .string({ error: 'Indica el motivo de la anulación.' })
    .trim()
    .min(5, 'Describe el motivo (mínimo 5 caracteres).')
    .max(200, 'Máximo 200 caracteres.'),
});
export type VoidPaymentInput = z.input<typeof voidPaymentInputSchema>;
