import { useState, type CSSProperties } from 'react';
import { Outlet } from 'react-router';
import { IdleSignOut } from '@/features/auth/idle/IdleSignOut';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Estructura principal de la aplicación autenticada.
 * - Móvil (<768): barra superior + navegación inferior.
 * - Tablet/laptop (768–1279): riel de iconos expandible.
 * - Escritorio (≥1280): sidebar completo.
 */
export function AppShell() {
  const isDesktop = useMediaQuery(BREAKPOINTS.xl);
  // null = automático según el ancho de pantalla; boolean = elección del usuario.
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const collapsed = userCollapsed ?? !isDesktop;

  const shellStyle = {
    '--shell-sidebar': collapsed ? 'var(--rail-width)' : 'var(--sidebar-width)',
  } as CSSProperties;

  return (
    <div style={shellStyle} className="min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setUserCollapsed(!collapsed)}
        className="hidden md:flex"
      />

      <div className="flex min-h-dvh flex-col transition-[padding] duration-200 ease-standard md:pl-(--shell-sidebar)">
        <Topbar />
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-(--container-content) flex-1 px-4 pt-6 pb-[calc(var(--bottomnav-height)+2rem)] focus:outline-none md:px-6 md:pb-10 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <BottomNav className="md:hidden" />
      <IdleSignOut />
    </div>
  );
}
