import { clinicDateTime } from '@kinesalud/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { PaymentDialog } from './components/PaymentDialog';
import { differenceView, incomeByDay, sumPayments } from './model';

const charge = vi.fn();
let openSessionId: string | null = 'caja-1';

vi.mock('./api/cash', () => ({
  useOpenSessionId: () => ({ status: 'success', data: openSessionId, retry: () => {} }),
  useCharge: () => ({ mutateAsync: charge, isPending: false }),
}));

const DAY = '2026-09-28';
/**
 * Intl separa "Bs" del monto con un espacio que no se corta: los nombres
 * accesibles lo conservan; getByText y toHaveTextContent lo normalizan.
 */
const bs = (amount: string) => `Bs${String.fromCharCode(0xa0)}${amount}`;

function appt(over: Partial<AgendaAppointment> = {}): AgendaAppointment {
  return {
    id: 'a1',
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
    date: DAY,
    startAt: clinicDateTime(DAY, '09:00'),
    endAt: clinicDateTime(DAY, '09:45'),
    status: 'ATENDIDA',
    cancelReason: null,
    bufferMin: 0,
    notes: null,
    priceCents: 13500,
    paymentStatus: 'POR_COBRAR',
    paymentId: null,
    sessionRecorded: false,
    createdBy: null,
    ...over,
  };
}

function renderDialog(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <TestSessionProvider asRole="RECEPCIONISTA">
        <PaymentDialog appointment={appt()} onClose={onClose} />
      </TestSessionProvider>
    </MemoryRouter>,
  );
  return onClose;
}

beforeEach(() => {
  charge.mockReset();
  openSessionId = 'caja-1';
});

describe('cobro de una sesión', () => {
  it('calcula el cambio a devolver mientras se escribe el monto recibido', async () => {
    renderDialog();
    expect(screen.getByText('Total a cobrar').nextElementSibling).toHaveTextContent('Bs 135,00');
    await userEvent.type(screen.getByLabelText(/Monto recibido/), '200');
    expect(screen.getByText('Cambio a devolver').parentElement).toHaveTextContent('Bs 65,00');
    await userEvent.click(screen.getByRole('button', { name: 'Exacto' }));
    expect(screen.getByLabelText(/Monto recibido/)).toHaveValue('135');
  });

  it('no deja cobrar si el efectivo no alcanza y envía el cobro cuando sí', async () => {
    charge.mockResolvedValue({ paymentId: 'p1', amountCents: 13500, changeCents: 1500 });
    const onClose = renderDialog();
    await userEvent.type(screen.getByLabelText(/Monto recibido/), '100');
    await userEvent.click(screen.getByRole('button', { name: `Cobrar ${bs('135,00')}` }));
    expect(screen.getByText('No alcanza: faltan Bs 35,00.')).toBeInTheDocument();
    expect(charge).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/Monto recibido/));
    await userEvent.type(screen.getByLabelText(/Monto recibido/), '150');
    await userEvent.click(screen.getByRole('button', { name: `Cobrar ${bs('135,00')}` }));
    expect(charge).toHaveBeenCalledWith({
      appointmentId: 'a1',
      method: 'EFECTIVO',
      discountCents: 0,
      discountReason: null,
      receivedCents: 15000,
      reference: null,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('con descuento exige el motivo y cobra el total rebajado por QR', async () => {
    charge.mockResolvedValue({ paymentId: 'p1', amountCents: 12000, changeCents: null });
    renderDialog();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Aplicar descuento' }));
    await userEvent.type(screen.getByLabelText(/^Descuento/), '15');
    await userEvent.click(screen.getByRole('radio', { name: 'QR' }));
    await userEvent.click(screen.getByRole('button', { name: `Cobrar ${bs('120,00')}` }));
    expect(screen.getByText('Indica el motivo del descuento.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^Motivo/), 'Convenio');
    await userEvent.click(screen.getByRole('button', { name: `Cobrar ${bs('120,00')}` }));
    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'QR',
        discountCents: 1500,
        discountReason: 'Convenio',
        receivedCents: null,
      }),
    );
  });

  it('con la caja cerrada avisa y no permite cobrar', () => {
    openSessionId = null;
    renderDialog();
    expect(screen.getByText('La caja está cerrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cobrar ${bs('135,00')}` })).toBeDisabled();
  });
});

describe('modelo de caja', () => {
  it('suma solo los cobros válidos, por medio de pago', () => {
    const sums = sumPayments([
      { status: 'VALIDO', method: 'EFECTIVO', amountCents: 15000 },
      { status: 'VALIDO', method: 'QR', amountCents: 9000 },
      { status: 'ANULADO', method: 'EFECTIVO', amountCents: 5000 },
    ]);
    expect(sums).toEqual({
      total: 24000,
      count: 2,
      byMethod: { EFECTIVO: 15000, QR: 9000, TARJETA: 0 },
    });
  });

  it('describe la diferencia del arqueo', () => {
    expect(differenceView(0)).toEqual({ tone: 'success', label: 'Cuadra' });
    expect(differenceView(1000).label).toBe(`Sobran ${bs('10,00')}`);
    expect(differenceView(-550)).toEqual({ tone: 'danger', label: `Faltan ${bs('5,50')}` });
  });

  it('arma los días del mes hasta hoy', () => {
    const days = incomeByDay('2026-09', { '02': 5000 }, '2026-09-03');
    expect(days).toEqual([
      { date: '2026-09-01', cents: 0 },
      { date: '2026-09-02', cents: 5000 },
      { date: '2026-09-03', cents: 0 },
    ]);
    expect(incomeByDay('2026-02', {}, '2026-09-03')).toHaveLength(28);
  });
});
