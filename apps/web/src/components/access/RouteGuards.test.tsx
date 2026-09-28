import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '@kinesalud/shared';
import type { SessionContextValue } from '@/features/auth/session';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { ProtectedRoute, PublicOnlyRoute } from './RouteGuards';

function renderAt(path: string, role?: Role, value?: Partial<SessionContextValue>) {
  const router = createMemoryRouter(
    [
      { element: <PublicOnlyRoute />, children: [{ path: '/login', element: <h1>Login</h1> }] },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/inicio', element: <h1>Inicio</h1> },
          { path: '/clientes', element: <h1>Clientes</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestSessionProvider asRole={role} value={value}>
      <RouterProvider router={router} />
    </TestSessionProvider>,
  );
  return router;
}

describe('guardias de ruta', () => {
  it('sin sesión, una ruta privada lleva al login', () => {
    renderAt('/clientes');
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('tras iniciar sesión vuelve a la ruta solicitada originalmente', () => {
    const router = createMemoryRouter(
      [
        { element: <PublicOnlyRoute />, children: [{ path: '/login', element: <h1>Login</h1> }] },
        {
          element: <ProtectedRoute />,
          children: [{ path: '/clientes', element: <h1>Clientes</h1> }],
        },
      ],
      {
        initialEntries: [
          { pathname: '/login', state: { from: { pathname: '/clientes', search: '' } } },
        ],
      },
    );
    render(
      <TestSessionProvider asRole="RECEPCIONISTA">
        <RouterProvider router={router} />
      </TestSessionProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });

  it('con sesión, el login redirige al inicio', () => {
    renderAt('/login', 'ADMINISTRADOR');
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
  });

  it('mientras se resuelve la sesión muestra la pantalla de carga', () => {
    renderAt('/inicio', undefined, { status: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando Kinesalud y Vida');
  });

  it('una cuenta desactivada ve el aviso y no el contenido', () => {
    renderAt('/inicio', undefined, { status: 'blocked', blockedReason: 'inactive' });
    expect(screen.getByRole('heading', { name: 'Tu cuenta está desactivada' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument();
  });
});
