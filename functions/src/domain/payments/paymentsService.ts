import {
  chargeInputSchema,
  closeCashInputSchema,
  expectedCash,
  openCashInputSchema,
  PAYMENT_METHOD_LABELS,
  toDateKey,
  voidPaymentInputSchema,
  type CashActor,
  type ChargeResult,
  type CloseCashResult,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requireClinicWide } from '../../core/guards';
import { auditActor } from '../audit';
import type { PaymentsGateway, PaymentsTx } from './paymentsGateway';

const DENIED = 'Solo recepción o administración manejan la caja.';

function cashActor(actor: Actor): CashActor {
  return { uid: actor.uid ?? null, name: actor.name ?? null };
}

function eventActor(actor: Actor) {
  return {
    type: actor.type,
    uid: actor.uid ?? null,
    name: actor.name ?? null,
    channel: actor.channel,
  };
}

async function requireOpenSession(tx: PaymentsTx) {
  const id = await tx.getOpenSessionId();
  const session = id ? await tx.getSession(id) : null;
  if (!session || session.status !== 'ABIERTA') {
    throw new DomainError(
      'failed-precondition',
      'La caja está cerrada. Ábrela para registrar cobros.',
      { reason: 'cash-closed' },
    );
  }
  return session;
}

/* ---------- Caja ---------- */

export async function openCash(
  gateway: PaymentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<{ sessionId: string }> {
  requireClinicWide(actor, 'payments.manage', DENIED);
  const input = parseInput(openCashInputSchema, data);

  const sessionId = await gateway.run(async (tx) => {
    if (await tx.getOpenSessionId()) {
      throw new DomainError('failed-precondition', 'La caja ya está abierta.');
    }
    return tx.openSession({
      date: toDateKey(now),
      openedBy: cashActor(actor),
      openingCents: input.openingCents,
      openingNote: input.note,
    });
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'cash.open',
    entity: 'cashSessions',
    entityId: sessionId,
    meta: { openingCents: input.openingCents },
  });
  return { sessionId };
}

export async function closeCash(
  gateway: PaymentsGateway,
  actor: Actor,
  data: unknown,
): Promise<CloseCashResult> {
  requireClinicWide(actor, 'payments.manage', DENIED);
  const input = parseInput(closeCashInputSchema, data);

  const result = await gateway.run(async (tx) => {
    const openId = await tx.getOpenSessionId();
    if (openId !== input.sessionId) {
      throw new DomainError('failed-precondition', 'Esta caja ya fue cerrada.');
    }
    const session = await tx.getSession(input.sessionId);
    if (!session) throw new DomainError('not-found', 'La caja no existe.');

    const expectedCashCents = expectedCash(session);
    const differenceCents = input.countedCashCents - expectedCashCents;
    if (differenceCents !== 0 && !input.note) {
      throw new DomainError(
        'invalid-argument',
        'El efectivo contado no coincide con el esperado: explica el motivo de la diferencia.',
        { field: 'note' },
      );
    }
    tx.closeSession(session.id, {
      closedBy: cashActor(actor),
      expectedCashCents,
      countedCashCents: input.countedCashCents,
      differenceCents,
      closingNote: input.note,
    });
    return { expectedCashCents, differenceCents };
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'cash.close',
    entity: 'cashSessions',
    entityId: input.sessionId,
    meta: { ...result, countedCashCents: input.countedCashCents },
  });
  return result;
}

/* ---------- Cobros ---------- */

export async function chargeAppointment(
  gateway: PaymentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<ChargeResult> {
  requireClinicWide(actor, 'payments.manage', DENIED);
  const input = parseInput(chargeInputSchema, data);

  const result = await gateway.run(async (tx) => {
    const session = await requireOpenSession(tx);
    const appointment = await tx.getAppointment(input.appointmentId);
    if (!appointment) throw new DomainError('not-found', 'La cita no existe.');
    if (appointment.paymentStatus === 'PAGADA') {
      throw new DomainError('failed-precondition', 'Esta cita ya está pagada.');
    }
    if (appointment.status === 'CANCELADA' || appointment.status === 'NO_ASISTIO') {
      throw new DomainError(
        'failed-precondition',
        'No se cobra una cita cancelada o a la que el cliente no asistió.',
      );
    }

    const listPriceCents =
      appointment.priceCents ?? (await tx.getServicePrice(appointment.serviceId));
    if (listPriceCents === null) {
      throw new DomainError(
        'failed-precondition',
        `El servicio «${appointment.serviceName}» no tiene precio. Pide a la administración que lo configure en Servicios.`,
      );
    }
    if (input.discountCents > listPriceCents) {
      throw new DomainError('invalid-argument', 'El descuento no puede superar el precio.', {
        field: 'discountCents',
      });
    }
    const amountCents = listPriceCents - input.discountCents;

    let receivedCents: number | null = null;
    let changeCents: number | null = null;
    if (input.method === 'EFECTIVO') {
      receivedCents = input.receivedCents!;
      if (receivedCents < amountCents) {
        throw new DomainError(
          'invalid-argument',
          'El monto recibido es menor que el total a cobrar.',
          { field: 'receivedCents' },
        );
      }
      changeCents = receivedCents - amountCents;
    }

    const date = toDateKey(now);
    const paymentId = tx.createPayment({
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      professionalId: appointment.professionalId,
      professionalName: appointment.professionalName,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      category: appointment.category,
      appointmentDate: appointment.date,
      listPriceCents,
      discountCents: input.discountCents,
      discountReason: input.discountCents > 0 ? input.discountReason : null,
      amountCents,
      method: input.method,
      receivedCents,
      changeCents,
      reference: input.method === 'EFECTIVO' ? null : input.reference,
      cashSessionId: session.id,
      date,
      createdBy: cashActor(actor),
    });
    tx.setAppointmentPayment(appointment.id, paymentId);
    tx.addAppointmentEvent(appointment.id, {
      type: 'PAGO_REGISTRADO',
      professionalId: appointment.professionalId,
      from: null,
      to: null,
      reason: PAYMENT_METHOD_LABELS[input.method],
      actor: eventActor(actor),
    });
    tx.applyIncome(session.id, {
      date,
      method: input.method,
      amountCents,
      count: 1,
      professionalId: appointment.professionalId,
      category: appointment.category,
    });
    return { paymentId, amountCents, changeCents };
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'payment.create',
    entity: 'payments',
    entityId: result.paymentId,
    meta: {
      appointmentId: input.appointmentId,
      amountCents: result.amountCents,
      method: input.method,
      discountCents: input.discountCents,
    },
  });
  return result;
}

/**
 * Anula un cobro de la caja abierta (error de registro o devolución). Los de
 * una caja cerrada no se tocan: su arqueo ya quedó firmado.
 */
export async function voidPayment(
  gateway: PaymentsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requireClinicWide(actor, 'payments.manage', DENIED);
  const input = parseInput(voidPaymentInputSchema, data);

  await gateway.run(async (tx) => {
    const payment = await tx.getPayment(input.paymentId);
    if (!payment) throw new DomainError('not-found', 'El cobro no existe.');
    if (payment.status === 'ANULADO') {
      throw new DomainError('failed-precondition', 'El cobro ya fue anulado.');
    }
    const openId = await tx.getOpenSessionId();
    if (payment.cashSessionId !== openId) {
      throw new DomainError(
        'failed-precondition',
        'Solo se anulan cobros de la caja abierta. Este cobro pertenece a una caja ya cerrada.',
      );
    }
    const appointment = await tx.getAppointment(payment.appointmentId);

    tx.voidPayment(payment.id, { voidReason: input.reason, voidedBy: cashActor(actor) });
    if (appointment && appointment.paymentId === payment.id) {
      tx.setAppointmentPayment(appointment.id, null);
      tx.addAppointmentEvent(appointment.id, {
        type: 'PAGO_ANULADO',
        professionalId: appointment.professionalId,
        from: null,
        to: null,
        reason: input.reason,
        actor: eventActor(actor),
      });
    }
    tx.applyIncome(payment.cashSessionId, {
      date: payment.date,
      method: payment.method,
      amountCents: -payment.amountCents,
      count: -1,
      professionalId: payment.professionalId,
      category: payment.category,
    });
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'payment.void',
    entity: 'payments',
    entityId: input.paymentId,
    meta: { reason: input.reason },
  });
}
