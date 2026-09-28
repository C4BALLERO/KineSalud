import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { ErrorState } from '@/components/feedback/States';
import { Button } from '@/components/ui/Button';
import { NotFoundPage } from './NotFoundPage';

/** Límite de errores de ruta: evita pantallas en blanco ante fallos inesperados. */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <NotFoundPage />
      </main>
    );
  }

  if (import.meta.env.DEV) console.error(error);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4">
      <ErrorState
        title="Algo salió mal"
        description="Ocurrió un error inesperado. Recarga la página; si el problema continúa, avisa al administrador."
        onRetry={() => window.location.reload()}
      />
      <Button asChild variant="ghost">
        <Link to="/inicio">Volver al inicio</Link>
      </Button>
    </main>
  );
}
