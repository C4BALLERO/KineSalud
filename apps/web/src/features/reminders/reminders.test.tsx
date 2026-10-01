import { clinicDateTime } from '@kinesalud/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAlerts } from '@/features/dashboard/model';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import type { ReminderItem } from './api/reminders';
import { ReminderRow } from './components/ReminderRow';

const mutateAsync = vi.fn();
vi.mock('./api/reminders', () => ({
  useHandleReminder: () => ({ mutateAsync, isPending: false }),
}));

function reminder(over: Partial<ReminderItem> = {}): ReminderItem {
  return {
    id: 'cita-1',
    appointmentId: 'cita-1',
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    clientPhone: '71234567',
    clientPhoneE164: '+59171234567',
    professionalName: 'Lic. Diego Pérez',
    serviceName: 'Fisioterapia lumbar',
    appointmentDate: '2026-09-30',
    appointmentStartAt: clinicDateTime('2026-09-30', '09:30'),
    appointmentStatus: 'PENDIENTE',
    type: 'CONFIRMACION',
    channel: 'IN_APP',
    scheduledFor: clinicDateTime('2026-09-29', '09:30'),
    status: 'ENVIADO',
    attempts: 1,
    lastError: null,
    sentAt: null,
    handledAt: null,
    handledBy: null,
    outcomeNote: null,
    ...over,
  };
}

function renderRow(r = reminder()) {
  render(
    <MemoryRouter>
      <TestSessionProvider asRole="RECEPCIONISTA">
        <ReminderRow reminder={r} clinicName="Kinesalud y Vida" actionable />
      </TestSessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

describe('gestión de un recordatorio', () => {
  it('ofrece WhatsApp con el mensaje ya escrito y la llamada', () => {
    renderRow();
    const whatsapp = screen.getByRole('link', { name: /Escribir por WhatsApp a Carla Rojas/ });
    expect(whatsapp).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/59171234567\?text=Hola%20Carla/),
    );
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Llamar a Carla Rojas' })).toHaveAttribute(
      'href',
      'tel:+59171234567',
    );
    expect(screen.getByText('Pedir confirmación')).toBeInTheDocument();
  });

  it('"Confirmó" registra el resultado', async () => {
    renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmó' }));
    expect(mutateAsync).toHaveBeenCalledWith({
      reminderId: 'cita-1',
      outcome: 'CONFIRMADO',
      note: null,
    });
  });

  it('"Canceló" pide el motivo antes de cancelar la cita', async () => {
    renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Canceló' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar cita' }));
    expect(screen.getByText('Indica el motivo de la cancelación.')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole('textbox', { name: /Motivo/ }), 'Viaja ese día');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar cita' }));
    expect(mutateAsync).toHaveBeenCalledWith({
      reminderId: 'cita-1',
      outcome: 'CANCELADO',
      note: 'Viaja ese día',
    });
  });

  it('sin teléfono no muestra WhatsApp; una cita confirmada solo se avisa', () => {
    renderRow(reminder({ clientPhoneE164: null, type: 'RECORDATORIO' }));
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avisado' })).toBeInTheDocument();
  });
});

describe('aviso en el inicio', () => {
  it('recepción ve cuántos recordatorios hay por gestionar', () => {
    const alerts = buildAlerts({
      appointments: [],
      treatments: [],
      today: '2026-09-28',
      now: new Date('2026-09-28T12:00:00Z'),
      formatDay: (d) => d,
      pendingReminders: 3,
    });
    expect(alerts[0]).toMatchObject({
      id: 'reminders',
      title: '3 recordatorios por gestionar',
      action: { to: '/recordatorios' },
    });
  });
});
