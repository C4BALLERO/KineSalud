import type { ClientData } from '@kinesalud/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { formatCi, formatPhone } from '@/utils/format';
import { matchesAllTerms, type ClientListItem } from './api/clients';
import { ClientForm } from './components/ClientForm';
import { EMPTY_CLIENT_FORM } from './components/clientFormValues';

const carla: ClientListItem = {
  id: 'cli-01',
  firstName: 'Carla',
  lastName: 'Rojas Vda.',
  fullName: 'Carla Rojas Vda.',
  ci: '3400000',
  ciExt: 'CB',
  phone: '71234567',
  email: null,
  status: 'ACTIVO',
  activeTreatments: 1,
  createdAt: null,
  lastNameLower: 'rojas vda.',
};

describe('búsqueda de clientes', () => {
  it('exige que todos los términos coincidan, sin tildes ni mayúsculas', () => {
    expect(matchesAllTerms(carla, 'carla rojas')).toBe(true);
    expect(matchesAllTerms(carla, 'RÓJAS')).toBe(true);
    expect(matchesAllTerms(carla, 'carla perez')).toBe(false);
  });

  it('encuentra por carnet y teléfono', () => {
    expect(matchesAllTerms(carla, '3400000')).toBe(true);
    expect(matchesAllTerms(carla, '7123-4567')).toBe(true);
  });
});

describe('formatos', () => {
  it('muestra el carnet con su expedición', () => {
    expect(formatCi('3400000', 'CB')).toBe('3400000 CB');
    expect(formatCi('3400000', null)).toBe('3400000');
  });

  it('agrupa celulares y fijos', () => {
    expect(formatPhone('71234567')).toBe('7123 4567');
    expect(formatPhone('4256789')).toBe('425 6789');
  });
});

function renderForm(onSubmit: (data: ClientData) => Promise<void>) {
  const router = createMemoryRouter(
    [
      {
        path: '/clientes/nuevo',
        element: (
          <ClientForm
            defaultValues={EMPTY_CLIENT_FORM}
            submitLabel="Registrar cliente"
            cancelTo="/clientes"
            onSubmit={onSubmit}
          />
        ),
      },
      { path: '/clientes/:id', element: <p>Perfil</p> },
    ],
    { initialEntries: ['/clientes/nuevo'] },
  );
  render(
    <TestSessionProvider asRole="RECEPCIONISTA">
      <RouterProvider router={router} />
    </TestSessionProvider>,
  );
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText(/^Nombres/), 'Carla');
  await userEvent.type(screen.getByLabelText(/^Apellidos/), 'Rojas');
  await userEvent.type(screen.getByLabelText(/^Carnet de identidad/), '3400000-1a');
  await userEvent.type(screen.getByLabelText(/^Teléfono/), '7123 4567');
}

describe('ClientForm', () => {
  it('valida los campos obligatorios sin llamar al servidor', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    expect(await screen.findByText('Ingresa los nombres.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa los apellidos.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa el número de carnet.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa un teléfono.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombres/)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía los datos normalizados', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      firstName: 'Carla',
      lastName: 'Rojas',
      ci: '34000001A',
      ciExt: 'CB',
      phone: '71234567',
      email: null,
      birthDate: null,
    });
  });

  it('marca el carnet duplicado y enlaza al cliente existente', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new AppError(
          'functions/already-exists',
          'Ya existe un cliente registrado con este número de carnet.',
          { field: 'ci', clientId: 'cli-01' },
        ),
      );
    renderForm(onSubmit);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));

    const link = await screen.findByRole('link', { name: 'Ver cliente existente' });
    expect(link).toHaveAttribute('href', '/clientes/cli-01');
    expect(screen.getByLabelText(/^Carnet de identidad/)).toHaveAttribute('aria-invalid', 'true');
  });
});
