import { clinicDateTime } from '@kinesalud/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import type { TreatmentItem } from './api/treatments';
import { TreatmentStatusDialog } from './components/TreatmentDialogs';
import { TreatmentTimeline } from './components/TreatmentTimeline';
import { filterTreatments, isEnding, treatmentProgress } from './model';

vi.mock('./api/treatments', () => ({
  useChangeTreatmentStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTreatment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function treatment(over: Partial<TreatmentItem> = {}): TreatmentItem {
  return {
    id: 't1',
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    serviceId: 'lumbar',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    startDate: '2026-09-01',
    plannedSessions: 10,
    completedSessions: 4,
    status: 'ACTIVO',
    statusReason: null,
    statusChangedAt: null,
    notes: null,
    createdBy: null,
    createdAt: null,
    ...over,
  };
}

function appt(id: string, day: string, over: Partial<AgendaAppointment> = {}): AgendaAppointment {
  return {
    id,
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    roomId: 'c1',
    roomName: 'Camilla 1',
    serviceId: 'lumbar',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    treatmentId: 't1',
    sessionNumber: null,
    date: day,
    startAt: clinicDateTime(day, '09:00'),
    endAt: clinicDateTime(day, '09:45'),
    status: 'ATENDIDA',
    cancelReason: null,
    bufferMin: 15,
    notes: null,
    priceCents: 15000,
    paymentStatus: 'PAGADA',
    paymentId: null,
    sessionRecorded: false,
    createdBy: null,
    ...over,
  };
}

describe('listado de tratamientos', () => {
  const items = [
    treatment({ id: 'a', completedSessions: 9 }),
    treatment({
      id: 'b',
      clientName: 'Luis Mamani',
      serviceName: 'Drenaje linfático',
      category: 'ESTETICA',
      completedSessions: 1,
    }),
    treatment({ id: 'c', clientName: 'José Ríos', status: 'SUSPENDIDO', completedSessions: 9 }),
  ];

  it('busca sin tildes por cliente o servicio y filtra por área', () => {
    const f = { category: null, professionalId: null, ending: false };
    expect(filterTreatments(items, { ...f, search: 'jose' }).map((t) => t.id)).toEqual(['c']);
    expect(filterTreatments(items, { ...f, search: 'drenaje' }).map((t) => t.id)).toEqual(['b']);
    expect(
      filterTreatments(items, { ...f, search: '', category: 'ESTETICA' }).map((t) => t.id),
    ).toEqual(['b']);
  });

  it('"por terminar" son los activos con 2 sesiones o menos pendientes', () => {
    expect(isEnding(items[0]!)).toBe(true);
    expect(isEnding(items[2]!)).toBe(false);
    expect(
      filterTreatments(items, { search: '', category: null, professionalId: null, ending: true }),
    ).toHaveLength(1);
  });
});

describe('progreso del tratamiento', () => {
  const list = [
    appt('s5', '2026-09-20', { status: 'PENDIENTE', sessionNumber: 5 }),
    appt('s4', '2026-09-10', { sessionNumber: 4 }),
    appt('x', '2026-09-12', { status: 'NO_ASISTIO' }),
    appt('s6', '2026-09-25', { status: 'CONFIRMADA', sessionNumber: 6 }),
  ];

  it('ordena las sesiones y cuenta las que faltan agendar', () => {
    const p = treatmentProgress(treatment(), list);
    expect(p.timeline.map((i) => (i.kind === 'appointment' ? i.appointment.id : 'faltan'))).toEqual(
      ['s4', 'x', 's5', 's6', 'faltan'],
    );
    expect(p.scheduled).toBe(2);
    expect(p.unscheduled).toBe(4);
    expect(p.next?.id).toBe('s5');
    expect(p.last?.id).toBe('s4');
    expect(p.noShows).toBe(1);
  });

  it('un tratamiento suspendido no muestra sesiones por agendar', () => {
    expect(treatmentProgress(treatment({ status: 'SUSPENDIDO' }), list).unscheduled).toBe(0);
  });

  it('la línea de tiempo nombra cada sesión con su estado y ofrece agendar las que faltan', () => {
    const p = treatmentProgress(treatment(), list);
    render(
      <MemoryRouter>
        <TreatmentTimeline items={p.timeline} scheduleHref="/agenda/nueva" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sesión 4')).toBeInTheDocument();
    expect(screen.getByText('No asistió')).toBeInTheDocument();
    expect(screen.getByText('Faltan agendar 4 sesiones (de la 7 a la 10)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agendar' })).toHaveAttribute('href', '/agenda/nueva');
  });
});

describe('cambio de estado', () => {
  it('explica por qué no se puede finalizar con citas agendadas', () => {
    render(
      <TestSessionProvider asRole="RECEPCIONISTA">
        <TreatmentStatusDialog
          treatment={treatment()}
          action="FINALIZAR"
          openAppointments={2}
          onClose={() => {}}
        />
      </TestSessionProvider>,
    );
    expect(
      screen.getByRole('dialog', { name: 'No se puede finalizar todavía' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tiene 2 citas agendadas/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar tratamiento' })).not.toBeInTheDocument();
  });

  it('al finalizar antes de completar pide el motivo', () => {
    render(
      <TestSessionProvider asRole="RECEPCIONISTA">
        <TreatmentStatusDialog
          treatment={treatment()}
          action="FINALIZAR"
          openAppointments={0}
          onClose={() => {}}
        />
      </TestSessionProvider>,
    );
    expect(screen.getByText(/Se realizaron 4 de 10 sesiones/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Motivo/ })).toBeRequired();
  });
});
