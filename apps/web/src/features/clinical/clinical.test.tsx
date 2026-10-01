import type { SessionNoteView } from '@kinesalud/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { buildAlerts, type AppointmentItem } from '@/features/dashboard/model';
import { PainChart } from './components/PainChart';
import { PainScaleInput } from './components/PainScaleInput';
import { PainBadge, SessionNoteCard } from './components/SessionNoteCard';

function note(over: Partial<SessionNoteView> = {}): SessionNoteView {
  return {
    appointmentId: 'a1',
    treatmentId: 't1',
    sessionNumber: 4,
    date: '2026-09-28',
    serviceName: 'Fisioterapia lumbar',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    observations: 'Movilización lumbar y TENS.',
    evolution: 'Menos rigidez.',
    recommendations: null,
    painBefore: 7,
    painAfter: 4,
    createdAt: '2026-09-28T14:00:00.000Z',
    createdBy: { uid: 'u-diego', name: 'Lic. Diego Pérez' },
    updatedAt: null,
    ...over,
  };
}

describe('escala de dolor', () => {
  it('ofrece 0 a 10 con su nivel en el nombre accesible y permite no registrar', async () => {
    const onChange = vi.fn();
    render(<PainScaleInput label="Dolor al llegar (EVA)" value={null} onChange={onChange} />);
    expect(screen.getByRole('group', { name: /Dolor al llegar/ })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(12);
    await userEvent.click(screen.getByRole('radio', { name: '7, Intenso' }));
    expect(onChange).toHaveBeenCalledWith(7);
    expect(screen.getByRole('radio', { name: 'Sin registrar' })).toBeChecked();
  });
});

describe('nota de sesión', () => {
  it('muestra la variación del dolor con texto y flecha, no solo color', () => {
    render(<PainBadge note={{ painBefore: 7, painAfter: 4 }} />);
    expect(screen.getByText(/EVA 7 → 4/)).toBeInTheDocument();
  });

  it('lista solo los campos completados y enlaza a la edición', () => {
    render(
      <MemoryRouter>
        <SessionNoteCard note={note()} editable />
      </MemoryRouter>,
    );
    expect(screen.getByText('Observaciones')).toBeInTheDocument();
    expect(screen.getByText('Evolución')).toBeInTheDocument();
    expect(screen.queryByText('Recomendaciones')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver o editar' })).toHaveAttribute(
      'href',
      '/citas/a1/sesion',
    );
  });
});

describe('gráfico de evolución', () => {
  it('pide al menos dos sesiones con dolor registrado', () => {
    render(<PainChart notes={[note()]} />);
    expect(screen.getByText(/al menos dos sesiones/)).toBeInTheDocument();
  });

  it('resume la evolución y ofrece una tabla equivalente', () => {
    render(
      <PainChart
        notes={[
          note({
            appointmentId: 'b',
            sessionNumber: 5,
            date: '2026-09-30',
            painBefore: 5,
            painAfter: 3,
          }),
          note(),
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Dolor de 7 a 3 en 2 sesiones' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Escala de dolor por sesión' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Leyenda' })).toHaveTextContent('Antes de la sesión');
  });
});

describe('aviso de sesiones sin registrar', () => {
  const appt = (over: Partial<AppointmentItem>): AppointmentItem => ({
    id: 'x',
    date: '2026-09-28',
    startAt: new Date('2026-09-28T13:00:00Z'),
    endAt: new Date('2026-09-28T13:45:00Z'),
    status: 'ATENDIDA',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    roomName: 'Camilla 1',
    sessionNumber: 4,
    sessionRecorded: false,
    ...over,
  });

  it('avisa al profesional de sus sesiones atendidas sin nota', () => {
    const alerts = buildAlerts({
      appointments: [
        appt({ id: 'a1' }),
        appt({ id: 'a2', sessionRecorded: true }),
        appt({ id: 'a3', professionalId: 'carla' }),
      ],
      treatments: [],
      today: '2026-09-28',
      now: new Date('2026-09-28T20:00:00Z'),
      formatDay: (d) => d,
      recordsFor: 'diego',
    });
    expect(alerts[0]).toMatchObject({
      id: 'sessions-to-record',
      title: '1 sesión atendida sin registrar',
      action: { to: '/citas/a1/sesion' },
    });
  });
});
