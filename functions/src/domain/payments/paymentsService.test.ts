import { emptyMethodTotals, type IncomeStatsDoc } from '@kinesalud/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type { StoredAppointment } from '../appointments/appointmentsGateway';
import type {
  PaymentsGateway,
  PaymentsTx,
  StoredCashSession,
  StoredPayment,
} from './paymentsGateway';
import { chargeAppointment, closeCash, openCash, voidPayment } from './paymentsService';

class InMemoryCash implements PaymentsGateway {
  openSessionId: string | null = null;
  sessions = new Map<string, StoredCashSession>();
  payments = new Map<string, StoredPayment>();
  appointments = new Map<string, StoredAppointment>();
  servicePrices = new Map<string, number | null>();
  income = new Map<string, Pick<IncomeStatsDoc, 'totalCents' | 'count' | 'byDay'>>();
  events: { appointmentId: string; type: string }[] = [];
  audits: AuditEntry[] = [];
  seq = 0;

  async run<T>(work: (tx: PaymentsTx) => Promise<T>): Promise<T> {
    return work(inMemoryTx(this));
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

function inMemoryTx(self: InMemoryCash): PaymentsTx {
  return {
    async getOpenSessionId() {
      return self.openSessionId;
    },
    async getSession(id) {
      return self.sessions.get(id) ?? null;
    },
    async getAppointment(id) {
      return self.appointments.get(id) ?? null;
    },
    async getServicePrice(id) {
      return self.servicePrices.get(id) ?? null;
    },
    async getPayment(id) {
      return self.payments.get(id) ?? null;
    },
    openSession(doc) {
      const id = `caja-${++self.seq}`;
      self.sessions.set(id, {
        ...doc,
        id,
        status: 'ABIERTA',
        totals: emptyMethodTotals(),
        paymentsCount: 0,
        closedBy: null,
        expectedCashCents: null,
        countedCashCents: null,
        differenceCents: null,
        closingNote: null,
      });
      self.openSessionId = id;
      return id;
    },
    closeSession(id, changes) {
      Object.assign(self.sessions.get(id)!, changes, { status: 'CERRADA' });
      self.openSessionId = null;
    },
    createPayment(doc) {
      const id = `pago-${++self.seq}`;
      self.payments.set(id, {
        ...doc,
        id,
        status: 'VALIDO',
        voidReason: null,
        voidedBy: null,
      });
      return id;
    },
    voidPayment(id, changes) {
      Object.assign(self.payments.get(id)!, changes, { status: 'ANULADO' });
    },
    setAppointmentPayment(id, paymentId) {
      Object.assign(self.appointments.get(id)!, {
        paymentId,
        paymentStatus: paymentId ? 'PAGADA' : 'POR_COBRAR',
      });
    },
    addAppointmentEvent(appointmentId, event) {
      self.events.push({ appointmentId, type: event.type });
    },
    applyIncome(sessionId, delta) {
      const s = self.sessions.get(sessionId)!;
      s.totals[delta.method] += delta.amountCents;
      s.paymentsCount += delta.count;
      const month = delta.date.slice(0, 7);
      const m = self.income.get(month) ?? { totalCents: 0, count: 0, byDay: {} };
      m.totalCents += delta.amountCents;
      m.count += delta.count;
      const day = delta.date.slice(8, 10);
      m.byDay[day] = (m.byDay[day] ?? 0) + delta.amountCents;
      self.income.set(month, m);
    },
  };
}

const recep: Actor = {
  type: 'USER',
  uid: 'u-recep',
  role: 'RECEPCIONISTA',
  name: 'Lucía',
  channel: 'web',
};
const prof: Actor = {
  type: 'USER',
  uid: 'u-prof',
  role: 'PROFESIONAL',
  professionalId: 'diego',
  channel: 'web',
};
const NOW = new Date('2026-09-28T14:00:00Z'); // 10:00 en La Paz

function appointment(over: Partial<StoredAppointment> = {}): StoredAppointment {
  return {
    id: 'cita-1',
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    roomId: 'c1',
    roomName: 'Camilla 1',
    serviceId: 'lumbar',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    treatmentId: null,
    sessionNumber: null,
    date: '2026-09-28',
    startAt: new Date('2026-09-28T13:00:00Z'),
    endAt: new Date('2026-09-28T13:45:00Z'),
    status: 'ATENDIDA',
    source: 'WEB',
    cancelReason: null,
    bufferMin: 0,
    notes: null,
    priceCents: 15000,
    paymentStatus: 'POR_COBRAR',
    paymentId: null,
    createdBy: null,
    ...over,
  };
}

async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).message).toMatch(pattern);
}

let gw: InMemoryCash;
beforeEach(() => {
  gw = new InMemoryCash();
  gw.appointments.set('cita-1', appointment());
});

describe('apertura de caja', () => {
  it('solo recepción o administración la abren, y una sola a la vez', async () => {
    await rejects(openCash(gw, prof, { openingCents: 0 }), /recepción o administración/);
    const { sessionId } = await openCash(gw, recep, { openingCents: 20000 }, NOW);
    expect(gw.sessions.get(sessionId)).toMatchObject({ date: '2026-09-28', openingCents: 20000 });
    await rejects(openCash(gw, recep, { openingCents: 0 }), /ya está abierta/);
  });
});

describe('cobro de una cita', () => {
  it('exige la caja abierta', async () => {
    const input = { appointmentId: 'cita-1', method: 'QR' };
    await rejects(chargeAppointment(gw, recep, input, NOW), /caja está cerrada/);
  });

  it('en efectivo calcula el cambio y suma a la caja y a los ingresos del mes', async () => {
    const { sessionId } = await openCash(gw, recep, { openingCents: 5000 }, NOW);
    const result = await chargeAppointment(
      gw,
      recep,
      {
        appointmentId: 'cita-1',
        method: 'EFECTIVO',
        receivedCents: 20000,
        discountCents: 1500,
        discountReason: 'Convenio',
      },
      NOW,
    );
    expect(result).toMatchObject({ amountCents: 13500, changeCents: 6500 });
    expect(gw.payments.get(result.paymentId)).toMatchObject({
      listPriceCents: 15000,
      amountCents: 13500,
      receivedCents: 20000,
      changeCents: 6500,
      cashSessionId: sessionId,
      date: '2026-09-28',
      createdBy: { uid: 'u-recep', name: 'Lucía' },
    });
    expect(gw.appointments.get('cita-1')).toMatchObject({
      paymentStatus: 'PAGADA',
      paymentId: result.paymentId,
    });
    expect(gw.sessions.get(sessionId)!.totals.EFECTIVO).toBe(13500);
    expect(gw.income.get('2026-09')).toEqual({
      totalCents: 13500,
      count: 1,
      byDay: { '28': 13500 },
    });
    expect(gw.events).toEqual([{ appointmentId: 'cita-1', type: 'PAGO_REGISTRADO' }]);
  });

  it('rechaza efectivo insuficiente, descuentos mayores al precio y cobros duplicados', async () => {
    await openCash(gw, recep, { openingCents: 0 }, NOW);
    await rejects(
      chargeAppointment(
        gw,
        recep,
        { appointmentId: 'cita-1', method: 'EFECTIVO', receivedCents: 10000 },
        NOW,
      ),
      /menor que el total/,
    );
    await rejects(
      chargeAppointment(
        gw,
        recep,
        { appointmentId: 'cita-1', method: 'QR', discountCents: 20000, discountReason: 'x' },
        NOW,
      ),
      /no puede superar el precio/,
    );
    await rejects(
      chargeAppointment(gw, recep, { appointmentId: 'cita-1', method: 'QR', discountCents: 500 }),
      /motivo del descuento/,
    );
    await chargeAppointment(gw, recep, { appointmentId: 'cita-1', method: 'TARJETA' }, NOW);
    await rejects(
      chargeAppointment(gw, recep, { appointmentId: 'cita-1', method: 'QR' }, NOW),
      /ya está pagada/,
    );
  });

  it('no cobra citas canceladas y usa el precio actual si la cita no lo guardó', async () => {
    await openCash(gw, recep, { openingCents: 0 }, NOW);
    gw.appointments.set('cancelada', appointment({ id: 'cancelada', status: 'CANCELADA' }));
    await rejects(
      chargeAppointment(gw, recep, { appointmentId: 'cancelada', method: 'QR' }, NOW),
      /cancelada/,
    );

    gw.appointments.set('antigua', appointment({ id: 'antigua', priceCents: null }));
    await rejects(
      chargeAppointment(gw, recep, { appointmentId: 'antigua', method: 'QR' }, NOW),
      /no tiene precio/,
    );
    gw.servicePrices.set('lumbar', 12000);
    const r = await chargeAppointment(gw, recep, { appointmentId: 'antigua', method: 'QR' }, NOW);
    expect(r.amountCents).toBe(12000);
    expect(gw.payments.get(r.paymentId)!.receivedCents).toBeNull();
  });

  it('el profesional no cobra', async () => {
    await openCash(gw, recep, { openingCents: 0 }, NOW);
    await rejects(
      chargeAppointment(gw, prof, { appointmentId: 'cita-1', method: 'QR' }, NOW),
      /recepción o administración/,
    );
  });
});

describe('cierre de caja', () => {
  it('compara el efectivo contado con el esperado y exige explicar la diferencia', async () => {
    const { sessionId } = await openCash(gw, recep, { openingCents: 5000 }, NOW);
    await chargeAppointment(
      gw,
      recep,
      { appointmentId: 'cita-1', method: 'EFECTIVO', receivedCents: 15000 },
      NOW,
    );
    await rejects(
      closeCash(gw, recep, { sessionId, countedCashCents: 19000 }),
      /explica el motivo/,
    );
    const result = await closeCash(gw, recep, {
      sessionId,
      countedCashCents: 19000,
      note: 'Faltan Bs 10 de sencillo',
    });
    expect(result).toEqual({ expectedCashCents: 20000, differenceCents: -1000 });
    expect(gw.sessions.get(sessionId)).toMatchObject({
      status: 'CERRADA',
      countedCashCents: 19000,
    });
    await rejects(closeCash(gw, recep, { sessionId, countedCashCents: 0 }), /ya fue cerrada/);
  });

  it('sin diferencia no pide nota', async () => {
    const { sessionId } = await openCash(gw, recep, { openingCents: 5000 }, NOW);
    await expect(closeCash(gw, recep, { sessionId, countedCashCents: 5000 })).resolves.toEqual({
      expectedCashCents: 5000,
      differenceCents: 0,
    });
  });
});

describe('anulación de cobros', () => {
  it('revierte el cobro de la caja abierta y la cita vuelve a "por cobrar"', async () => {
    const { sessionId } = await openCash(gw, recep, { openingCents: 0 }, NOW);
    const { paymentId } = await chargeAppointment(
      gw,
      recep,
      { appointmentId: 'cita-1', method: 'QR' },
      NOW,
    );
    await rejects(voidPayment(gw, recep, { paymentId, reason: 'x' }), /mínimo 5/);
    await voidPayment(gw, recep, { paymentId, reason: 'Medio de pago equivocado' });

    expect(gw.payments.get(paymentId)).toMatchObject({ status: 'ANULADO' });
    expect(gw.appointments.get('cita-1')).toMatchObject({
      paymentStatus: 'POR_COBRAR',
      paymentId: null,
    });
    expect(gw.sessions.get(sessionId)).toMatchObject({ totals: { QR: 0 }, paymentsCount: 0 });
    expect(gw.income.get('2026-09')).toMatchObject({ totalCents: 0, count: 0 });
    await rejects(voidPayment(gw, recep, { paymentId, reason: 'Otra vez' }), /ya fue anulado/);
  });

  it('no anula cobros de una caja cerrada', async () => {
    const { sessionId } = await openCash(gw, recep, { openingCents: 0 }, NOW);
    const { paymentId } = await chargeAppointment(
      gw,
      recep,
      { appointmentId: 'cita-1', method: 'QR' },
      NOW,
    );
    await closeCash(gw, recep, { sessionId, countedCashCents: 0 });
    await rejects(
      voidPayment(gw, recep, { paymentId, reason: 'Devolución al cliente' }),
      /caja ya cerrada/,
    );
  });
});
