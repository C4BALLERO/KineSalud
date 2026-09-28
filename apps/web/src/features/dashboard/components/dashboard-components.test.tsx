import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppointmentRow } from '@/components/domain/AppointmentRow';
import { UiProviders } from '@/app/providers';
import type { StatusCounts, WeekDaySummary } from '../model';
import { AlertsList } from './AlertsList';
import { DaySummary } from './DaySummary';
import { WeekChart } from './WeekChart';

const zero: StatusCounts = {
  PENDIENTE: 0,
  CONFIRMADA: 0,
  ATENDIDA: 0,
  CANCELADA: 0,
  NO_ASISTIO: 0,
};

function renderInRouter(ui: React.ReactNode) {
  const router = createMemoryRouter([{ path: '/', element: ui }]);
  return render(
    <UiProviders>
      <RouterProvider router={router} />
    </UiProviders>,
  );
}

describe('DaySummary', () => {
  it('muestra el total y cada estado con texto (no solo color)', () => {
    render(
      <DaySummary
        counts={{ ...zero, CONFIRMADA: 8, PENDIENTE: 2 }}
        label="citas hoy"
        emptyHint="—"
      />,
    );
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('confirmada', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('pendiente', { exact: false })).toBeInTheDocument();
  });

  it('sin citas muestra un mensaje en lugar de una leyenda de ceros', () => {
    render(
      <DaySummary counts={zero} label="citas hoy" emptyHint="Hoy ningún profesional atiende." />,
    );
    expect(screen.getByText('Hoy ningún profesional atiende.')).toBeInTheDocument();
    expect(screen.queryByText('confirmada', { exact: false })).not.toBeInTheDocument();
  });
});

describe('WeekChart', () => {
  const days: WeekDaySummary[] = [
    {
      date: '2026-09-28',
      weekday: 'mon',
      label: 'Lunes',
      total: 3,
      counts: { ...zero, ATENDIDA: 2, CONFIRMADA: 1 },
    },
    { date: '2026-09-29', weekday: 'tue', label: 'Martes', total: 0, counts: zero },
  ];

  it('cada barra es un enlace a la agenda con un nombre accesible completo', () => {
    renderInRouter(<WeekChart days={days} today="2026-09-28" />);
    const monday = screen.getByRole('link', {
      name: /Lunes 28: 3 citas \(2 atendida, 1 confirmada\)/,
    });
    expect(monday).toHaveAttribute('href', '/agenda?fecha=2026-09-28');
    expect(screen.getByRole('link', { name: /Martes 29: 0 citas/ })).toBeInTheDocument();
  });
});

describe('AlertsList', () => {
  it('sin alertas lo comunica en positivo', () => {
    renderInRouter(<AlertsList alerts={[]} />);
    expect(screen.getByText('Todo en orden')).toBeInTheDocument();
  });

  it('cada alerta ofrece una acción', () => {
    renderInRouter(
      <AlertsList
        alerts={[
          {
            id: 'x',
            tone: 'warning',
            title: '3 citas sin confirmar para mañana',
            description: 'Confirma con cada cliente.',
            action: { label: 'Ver citas', to: '/agenda?fecha=2026-09-29' },
          },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Ver citas' })).toHaveAttribute(
      'href',
      '/agenda?fecha=2026-09-29',
    );
  });
});

describe('AppointmentRow', () => {
  const base = {
    clientName: 'Carla Rojas',
    professionalName: 'Lic. Diego Pérez',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA' as const,
    roomName: 'Camilla 1',
    sessionNumber: 4,
    startAt: new Date('2026-09-28T09:00:00-04:00'),
    endAt: new Date('2026-09-28T09:45:00-04:00'),
  };

  it('marca la cita en curso', () => {
    render(
      <AppointmentRow
        appointment={{ ...base, status: 'CONFIRMADA' }}
        now={new Date('2026-09-28T09:20:00-04:00')}
      />,
    );
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText(/sesión 4/)).toBeInTheDocument();
  });

  it('puede ocultar el profesional en la vista personal', () => {
    render(
      <AppointmentRow
        appointment={{ ...base, status: 'PENDIENTE' }}
        now={new Date('2026-09-28T08:00:00-04:00')}
        hideProfessional
      />,
    );
    expect(screen.queryByText(/Diego Pérez/)).not.toBeInTheDocument();
  });
});
