import type { Permission } from '@kinesalud/shared';
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RequirePermission } from '@/components/access/RequirePermission';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/access/RouteGuards';
import { AppShell } from '@/components/layout/AppShell';
import { AuthActionPage } from '@/features/auth/pages/AuthActionPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AppLoadingPage } from '@/pages/AppLoadingPage';
import { ModulePlaceholder } from '@/pages/ModulePlaceholder';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

/** Ruta cargada bajo demanda y protegida por permiso. */
function guarded(permission: Permission, load: () => Promise<ComponentType>) {
  return async () => {
    const Page = await load();
    return {
      element: (
        <RequirePermission permission={permission}>
          <Page />
        </RequirePermission>
      ),
    };
  };
}

/**
 * Rutas de la aplicación. Cada módulo reemplaza su ModulePlaceholder en la
 * fase correspondiente. Las guardias de permiso protegen la UI; Firestore
 * Rules y Cloud Functions son la barrera real.
 */
const appRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/inicio" replace /> },
  {
    path: 'inicio',
    lazy: async () => {
      const { DashboardPage } = await import('@/features/dashboard/pages/DashboardPage');
      return { Component: DashboardPage };
    },
  },
  {
    path: 'agenda',
    lazy: guarded(
      'appointments.read',
      async () => (await import('@/features/appointments/pages/AgendaPage')).AgendaPage,
    ),
  },
  {
    path: 'agenda/nueva',
    lazy: guarded(
      'appointments.manage',
      async () =>
        (await import('@/features/appointments/pages/NewAppointmentPage')).NewAppointmentPage,
    ),
  },
  {
    path: 'caja',
    lazy: guarded(
      'payments.manage',
      async () => (await import('@/features/cash/pages/CashPage')).CashPage,
    ),
  },
  {
    path: 'clientes',
    lazy: guarded(
      'clients.read',
      async () => (await import('@/features/clients/pages/ClientsPage')).ClientsPage,
    ),
  },
  {
    path: 'clientes/nuevo',
    lazy: guarded(
      'clients.write',
      async () => (await import('@/features/clients/pages/ClientCreatePage')).ClientCreatePage,
    ),
  },
  {
    path: 'clientes/:clientId',
    lazy: guarded(
      'clients.read',
      async () => (await import('@/features/clients/pages/ClientProfilePage')).ClientProfilePage,
    ),
  },
  {
    path: 'clientes/:clientId/editar',
    lazy: guarded(
      'clients.write',
      async () => (await import('@/features/clients/pages/ClientEditPage')).ClientEditPage,
    ),
  },
  {
    path: 'tratamientos',
    lazy: guarded(
      'treatments.read',
      async () => (await import('@/features/treatments/pages/TreatmentsPage')).TreatmentsPage,
    ),
  },
  {
    path: 'tratamientos/nuevo',
    lazy: guarded(
      'treatments.manage',
      async () =>
        (await import('@/features/treatments/pages/TreatmentCreatePage')).TreatmentCreatePage,
    ),
  },
  {
    path: 'tratamientos/:treatmentId',
    lazy: guarded(
      'treatments.read',
      async () =>
        (await import('@/features/treatments/pages/TreatmentDetailPage')).TreatmentDetailPage,
    ),
  },
  {
    path: 'personal',
    lazy: guarded(
      'staff.read',
      async () => (await import('@/features/staff/pages/StaffPage')).StaffPage,
    ),
  },
  {
    path: 'personal/nuevo',
    lazy: guarded(
      'staff.manage',
      async () => (await import('@/features/staff/pages/StaffCreatePage')).StaffCreatePage,
    ),
  },
  {
    path: 'personal/:professionalId',
    lazy: guarded(
      'staff.read',
      async () => (await import('@/features/staff/pages/StaffProfilePage')).StaffProfilePage,
    ),
  },
  {
    path: 'personal/:professionalId/editar',
    lazy: guarded(
      'staff.manage',
      async () => (await import('@/features/staff/pages/StaffEditPage')).StaffEditPage,
    ),
  },
  {
    path: 'recordatorios',
    element: (
      <RequirePermission permission="reminders.manage">
        <ModulePlaceholder
          title="Recordatorios"
          description="Recordatorios y confirmaciones de citas pendientes."
          phase={13}
        />
      </RequirePermission>
    ),
  },
  {
    path: 'reportes',
    lazy: guarded(
      'reports.view',
      async () => (await import('@/features/reports/pages/ReportsPage')).ReportsPage,
    ),
  },
  {
    path: 'usuarios',
    lazy: async () => {
      const { UsersPage } = await import('@/features/users/pages/UsersPage');
      return {
        element: (
          <RequirePermission permission="users.manage">
            <UsersPage />
          </RequirePermission>
        ),
      };
    },
  },
  {
    path: 'configuracion',
    lazy: guarded(
      'settings.manage',
      async () => (await import('@/features/settings/pages/SettingsPage')).SettingsPage,
    ),
  },
  {
    path: 'mi-cuenta',
    lazy: async () => {
      const { AccountPage } = await import('@/features/account/pages/AccountPage');
      return { Component: AccountPage };
    },
  },
  { path: '*', element: <NotFoundPage /> },
];

if (import.meta.env.DEV) {
  appRoutes.push({
    path: 'dev/componentes',
    lazy: async () => {
      const { ComponentCatalogPage } = await import('@/pages/dev/ComponentCatalogPage');
      return { Component: ComponentCatalogPage };
    },
  });
}

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <AppLoadingPage />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'recuperar-contrasena', element: <ForgotPasswordPage /> },
        ],
      },
      // Enlaces de Firebase Auth: accesibles con o sin sesión.
      { path: 'auth/accion', element: <AuthActionPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ element: <AppShell />, children: appRoutes }],
      },
    ],
  },
]);
