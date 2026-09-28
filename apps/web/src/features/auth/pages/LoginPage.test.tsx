import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { LoginPage } from './LoginPage';

const signIn = vi.fn();
vi.mock('../api/authApi', () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

function renderLogin() {
  const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
    initialEntries: ['/login'],
  });
  render(
    <TestSessionProvider>
      <RouterProvider router={router} />
    </TestSessionProvider>,
  );
}

describe('LoginPage', () => {
  // Con llaves: si beforeEach devuelve una función, Vitest la ejecuta como teardown.
  beforeEach(() => {
    signIn.mockReset();
  });

  it('los campos tienen label visible y autocompletado correcto', () => {
    renderLogin();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('valida antes de enviar y no llama a Firebase con datos inválidos', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Ingresa un correo electrónico.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('envía correo normalizado y contraseña', async () => {
    signIn.mockResolvedValue(undefined);
    renderLogin();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), ' Admin@KineSalud.test ');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('admin@kinesalud.test', 'secreta123'));
  });

  it('muestra un mensaje que no revela si el correo existe', async () => {
    signIn.mockRejectedValue({ code: 'auth/user-not-found' });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'nadie@kinesalud.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it('permite mostrar la contraseña', async () => {
    renderLogin();
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});
