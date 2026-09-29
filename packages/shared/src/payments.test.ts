import { describe, expect, it } from 'vitest';
import { canApplyAction } from './appointments';
import {
  canCharge,
  centsToInput,
  changeFor,
  chargeInputSchema,
  expectedCash,
  parseMoney,
  suggestedReceived,
} from './payments';

describe('montos en bolivianos', () => {
  it('interpreta los formatos habituales y devuelve centavos', () => {
    expect(parseMoney('150')).toBe(15000);
    expect(parseMoney('150,5')).toBe(15050);
    expect(parseMoney('150.50')).toBe(15050);
    expect(parseMoney('Bs 1.500,00')).toBe(150000);
    expect(parseMoney('1,500.00')).toBe(150000);
    expect(parseMoney('1.500')).toBe(150000);
    expect(parseMoney(' 0 ')).toBe(0);
  });

  it('rechaza texto que no es un monto', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-20')).toBeNull();
    expect(parseMoney('10,123,4')).toBeNull();
  });

  it('muestra centavos como texto editable', () => {
    expect(centsToInput(15000)).toBe('150');
    expect(centsToInput(15050)).toBe('150,50');
    expect(centsToInput(5)).toBe('0,05');
  });
});

describe('cambio', () => {
  it('sugiere el monto exacto y los redondeos a billetes', () => {
    expect(suggestedReceived(13500)).toEqual([13500, 14000, 15000, 20000]);
    expect(suggestedReceived(20000)).toEqual([20000]);
    expect(suggestedReceived(0)).toEqual([]);
  });

  it('calcula el cambio o indica que no alcanza', () => {
    expect(changeFor(13500, 20000)).toBe(6500);
    expect(changeFor(13500, 13500)).toBe(0);
    expect(changeFor(13500, 10000)).toBeNull();
  });

  it('el efectivo esperado es el monto inicial más lo cobrado en efectivo', () => {
    expect(
      expectedCash({ openingCents: 5000, totals: { EFECTIVO: 30000, QR: 9000, TARJETA: 0 } }),
    ).toBe(35000);
  });
});

describe('reglas de cobro', () => {
  it('se cobra antes o después de la sesión, nunca dos veces ni una cita cancelada', () => {
    expect(canCharge({ status: 'PENDIENTE', paymentStatus: 'POR_COBRAR' })).toBe(true);
    expect(canCharge({ status: 'ATENDIDA' })).toBe(true);
    expect(canCharge({ status: 'ATENDIDA', paymentStatus: 'PAGADA' })).toBe(false);
    expect(canCharge({ status: 'CANCELADA' })).toBe(false);
    expect(canCharge({ status: 'NO_ASISTIO' })).toBe(false);
  });

  it('una cita pagada no se cancela sin anular antes el cobro', () => {
    const appt = {
      status: 'CONFIRMADA' as const,
      startAt: new Date(),
      paymentStatus: 'PAGADA' as const,
    };
    const check = canApplyAction(appt, 'CANCELAR', new Date());
    expect(check.ok).toBe(false);
    expect(!check.ok && check.reason).toMatch(/Anula el cobro/);
  });

  it('el efectivo exige el monto recibido y el descuento su motivo', () => {
    const cash = chargeInputSchema.safeParse({ appointmentId: 'a', method: 'EFECTIVO' });
    expect(cash.success).toBe(false);
    expect(cash.error?.issues[0]?.path).toEqual(['receivedCents']);

    const discount = chargeInputSchema.safeParse({
      appointmentId: 'a',
      method: 'QR',
      discountCents: 100,
    });
    expect(discount.error?.issues[0]?.path).toEqual(['discountReason']);

    const qr = chargeInputSchema.parse({ appointmentId: 'a', method: 'QR', reference: '  ' });
    expect(qr).toMatchObject({ discountCents: 0, receivedCents: null, reference: null });
  });
});
