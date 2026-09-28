import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '@kinesalud/shared';
import { RequirePermission } from '@/components/access/RequirePermission';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { AppShell } from './AppShell';

function renderShellAs(role: Role, path = '/inicio') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 'inicio', element: <h1>Inicio</h1> },
          {
            path: 'usuarios',
            element: (
              <RequirePermission permission="users.manage">
                <h1>Usuarios</h1>
              </RequirePermission>
            ),
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <TestSessionProvider asRole={role}>
      <RouterProvider router={router} />
    </TestSessionProvider>,
  );
}

/** El sidebar (≥768) y la barra inferior (<768) comparten nombre; jsdom renderiza ambos. */
function sidebarNav() {
  const navs = screen.getAllByRole('navigation', { name: 'Navegación principal' });
  return navs[0]!;
}

describe('AppShell', () => {
  it('incluye un enlace para saltar al contenido', () => {
    renderShellAs('ADMINISTRADOR');
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#contenido',
    );
  });

  it('el ADMINISTRADOR ve Usuarios y Configuración', () => {
    renderShellAs('ADMINISTRADOR');
    const nav = within(sidebarNav());
    expect(nav.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
  });

  it('el PROFESIONAL ve sus secciones con etiquetas propias', () => {
    renderShellAs('PROFESIONAL');
    const nav = within(sidebarNav());
    expect(nav.getByRole('link', { name: 'Mi agenda' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Mis pacientes' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument();
  });

  it('marca el ítem activo con aria-current', () => {
    renderShellAs('RECEPCIONISTA', '/inicio');
    const nav = within(sidebarNav());
    expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  });

  it('muestra "sin permiso" si la RECEPCIONISTA entra a Usuarios por URL', () => {
    renderShellAs('RECEPCIONISTA', '/usuarios');
    expect(
      screen.getByRole('heading', { name: 'No tienes acceso a esta sección' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument();
  });
});
