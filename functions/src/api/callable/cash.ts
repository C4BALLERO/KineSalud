import { callable } from '../../core/callable';
import { firestorePaymentsGateway } from '../../domain/payments/firestorePaymentsGateway';
import {
  chargeAppointment,
  closeCash,
  openCash,
  voidPayment as voidPaymentCommand,
} from '../../domain/payments/paymentsService';

/** Caja y cobros. Nombres publicados: cash-open, cash-close, cash-charge, cash-voidPayment. */
export const open = callable((actor, data) => openCash(firestorePaymentsGateway, actor, data));
export const close = callable((actor, data) => closeCash(firestorePaymentsGateway, actor, data));
export const charge = callable((actor, data) =>
  chargeAppointment(firestorePaymentsGateway, actor, data),
);
export const voidPayment = callable((actor, data) =>
  voidPaymentCommand(firestorePaymentsGateway, actor, data),
);
