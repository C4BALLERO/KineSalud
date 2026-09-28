import { Navigate, Outlet, useLocation, type Location } from 'react-router';
import { AccountBlockedPage } from '@/features/auth/pages/AccountBlockedPage';
import { useSession } from '@/features/auth/session';
import { AppLoadingPage } from '@/pages/AppLoadingPage';

/** Rutas privadas: exigen una sesión válida; si no, llevan al login recordando el destino. */
export function ProtectedRoute() {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') return <AppLoadingPage />;
  if (status === 'signed-out') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status === 'blocked') return <AccountBlockedPage />;
  return <Outlet />;
}

/** Rutas públicas (login, recuperación): con sesión activa se vuelve al destino original. */
export function PublicOnlyRoute() {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') return <AppLoadingPage />;
  if (status === 'signed-in' || status === 'blocked') {
    const from = (location.state as { from?: Location } | null)?.from;
    const target = from ? `${from.pathname}${from.search}` : '/inicio';
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
