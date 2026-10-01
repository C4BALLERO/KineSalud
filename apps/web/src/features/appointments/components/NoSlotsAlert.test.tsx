import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { NoSlotsAlert } from './NoSlotsAlert';

function renderAs(role: 'ADMINISTRADOR' | 'RECEPCIONISTA', ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <TestSessionProvider asRole={role}>{ui}</TestSessionProvider>
    </MemoryRouter>,
  );
}

describe('NoSlotsAlert', () => {
  it('explica el motivo y enlaza a donde se corrige para la administración', () => {
    renderAs('ADMINISTRADOR', <NoSlotsAlert reason="NO_ROOM" professionalChosen={false} />);
    expect(
      screen.getByText(
        'No hay horarios libres: no hay un espacio activo compatible con este servicio.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración → Espacios' })).toHaveAttribute(
      'href',
      '/configuracion?tab=espacios',
    );
  });

  it('sin permiso para configurar, muestra el camino sin enlace', () => {
    renderAs('RECEPCIONISTA', <NoSlotsAlert reason="NO_ROOM" professionalChosen={false} />);
    expect(screen.queryByRole('link', { name: 'Configuración → Espacios' })).toBeNull();
    expect(screen.getByText(/Configuración → Espacios/)).toBeInTheDocument();
  });

  it('con un profesional elegido, habla de ese profesional', () => {
    renderAs('RECEPCIONISTA', <NoSlotsAlert reason="NOBODY_WORKS" professionalChosen />);
    expect(
      screen.getByText('No hay horarios libres: el profesional elegido no atiende ese día.'),
    ).toBeInTheDocument();
  });
});
