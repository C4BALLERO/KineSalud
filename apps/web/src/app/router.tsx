import { CalendarPlus, UserPlus } from 'lucide-react';
import { createBrowserRouter, Link, Navigate, type RouteObject } from 'react-router';
import { RequirePermission } from '@/components/access/RequirePermission';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/access/RouteGuards';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { AuthActionPage } from '@/features/auth/pages/AuthActionPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AppLoadingPage } from '@/pages/AppLoadingPage';
import { ModulePlaceholder } from '@/pages/ModulePlaceholder';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

/**
 * Rutas de la aplicación. Cada módulo reemplaza su ModulePlaceholder en la
 * fase correspondiente. Las guardias de permiso protegen la UI; Firestore
 * Rules y Cloud Functions son la barrera real.
 */
const appRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/inicio" replace /> },
  {
    path: 'inicio',
    element: (
      <ModulePlaceholder
        title="Inicio"
        description="Resumen del día, agenda de hoy y alertas del consultorio."
        phase={7}
      />
    ),
  },
  {
    path: 'agenda',
    element: (
      <RequirePermission permission="appointments.read">
        <ModulePlaceholder
          title="Agenda"
          description="Citas por día y semana, disponibilidad y estados."
          phase={10}
          actions={
            <Button asChild>
              <Link to="/agenda/nueva">
                <CalendarPlus aria-hidden="true" />
                Nueva cita
              </Link>
            </Button>
          }
        />
      </RequirePermission>
    ),
  },
  {
    path: 'agenda/nueva',
    element: (
      <RequirePermission permission="appointments.manage">
        <ModulePlaceholder
          title="Nueva cita"
          description="Asistente de programación de citas."
          phase={10}
        />
      </RequirePermission>
    ),
  },
  {
    path: 'clientes',
    element: (
      <RequirePermission permission="clients.read">
        <ModulePlaceholder
          title="Clientes"
          description="Registro, búsqueda y perfil de los clientes del consultorio."
          phase={8}
          actions={
            <Button asChild>
              <Link to="/clientes/nuevo">
                <UserPlus aria-hidden="true" />
                Registrar cliente
              </Link>
            </Button>
          }
        />
      </RequirePermission>
    ),
  },
  {
    path: 'clientes/nuevo',
    element: (
      <RequirePermission permission="clients.write">
        <ModulePlaceholder
          title="Registrar cliente"
          description="Datos personales y de contacto."
          phase={8}
        />
      </RequirePermission>
    ),
  },
  {
    path: 'tratamientos',
    element: (
      <RequirePermission permission="treatments.read">
        <ModulePlaceholder
          title="Tratamientos"
          description="Planes de fisioterapia, rehabilitación y estética con su progreso."
          phase={11}
        />
      </RequirePermission>
    ),
  },
  {
    path: 'personal',
    element: (
      <RequirePermission permission="staff.read">
        <ModulePlaceholder
          title="Personal"
          description="Profesionales, especialidades, horarios y disponibilidad."
          phase={9}
        />
      </RequirePermission>
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
    element: (
      <RequirePermission permission="reports.view">
        <ModulePlaceholder
          title="Reportes"
          description="Citas, asistencia, clientes, tratamientos y carga de trabajo."
          phase={14}
        />
      </RequirePermission>
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
    element: (
      <RequirePermission permission="settings.manage">
        <ModulePlaceholder
          title="Configuración"
          description="Horario del consultorio, espacios y catálogo de servicios."
          phase={9}
        />
      </RequirePermission>
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
