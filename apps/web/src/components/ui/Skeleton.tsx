import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Bloque de carga. Siempre debe imitar la forma real del contenido. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn('skeleton-shimmer rounded-sm', className)}
    />
  );
}

/** Contenedor accesible para un grupo de skeletons. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Skeleton de lista/tabla: filas con avatar y dos líneas. */
export function ListSkeleton({ rows = 5, label = 'Cargando…' }: { rows?: number; label?: string }) {
  return (
    <LoadingRegion label={label} className="flex flex-col divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-6 w-20 sm:block" />
        </div>
      ))}
    </LoadingRegion>
  );
}
