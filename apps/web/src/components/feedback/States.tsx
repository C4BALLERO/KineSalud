import { CloudOff, Lock, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface StateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** `compact` para estados dentro de paneles pequeños. */
  size?: 'default' | 'compact';
  role?: 'status' | 'alert';
}

function StateBase({
  icon,
  title,
  description,
  action,
  className,
  size = 'default',
  role,
}: StateProps) {
  return (
    <div
      role={role}
      className={cn(
        'mx-auto flex max-w-md flex-col items-center text-center',
        size === 'default' ? 'gap-3 px-4 py-12' : 'gap-2 px-4 py-8',
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-icon-entrance=""
        className={cn(
          'flex items-center justify-center rounded-full bg-surface-muted text-fg-muted',
          size === 'default' ? 'size-12 [&_svg]:size-6' : 'size-10 [&_svg]:size-5',
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-h3 text-fg">{title}</h3>
        {description && <p className="text-body-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Sin datos todavía: explica el valor y ofrece la acción principal. */
export function EmptyState(props: Omit<StateProps, 'role'>) {
  return <StateBase {...props} />;
}

/** Búsqueda o filtros sin coincidencias. */
export function NoResultsState({ onClear, query }: { onClear?: () => void; query?: string }) {
  return (
    <StateBase
      icon={<SearchX />}
      title="Sin resultados"
      description={
        query ? (
          <>
            No encontramos coincidencias para <strong className="text-fg">“{query}”</strong>. Revisa
            la escritura o prueba con el CI o el teléfono.
          </>
        ) : (
          'Ningún registro coincide con los filtros seleccionados.'
        )
      }
      action={
        onClear && (
          <Button variant="secondary" onClick={onClear}>
            Limpiar filtros
          </Button>
        )
      }
      role="status"
    />
  );
}

/** Error al cargar: mensaje humano y reintento. */
export function ErrorState({
  title = 'No pudimos cargar la información',
  description = 'Revisa tu conexión a internet e inténtalo de nuevo. Si el problema continúa, avisa al administrador.',
  onRetry,
  size,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  size?: StateProps['size'];
}) {
  return (
    <StateBase
      icon={<CloudOff />}
      title={title}
      description={description}
      size={size}
      role="alert"
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    />
  );
}

/** El usuario no tiene permiso para ver este contenido. */
export function NoPermissionState({
  title = 'No tienes acceso a esta sección',
  description = 'Tu rol no permite ver esta información. Si crees que es un error, contacta al administrador del consultorio.',
  action,
  size,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  size?: StateProps['size'];
}) {
  return (
    <StateBase
      icon={<Lock />}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}
