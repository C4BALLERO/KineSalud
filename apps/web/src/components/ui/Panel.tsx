import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Acciones a la derecha del encabezado (p. ej. "Ver agenda"). */
  actions?: ReactNode;
  children: ReactNode;
  /** Quita el padding del cuerpo (tablas y listas a sangre). */
  flush?: boolean;
  className?: string;
  as?: 'section' | 'div' | 'article';
}

/**
 * Contenedor principal de contenido. Usa borde en lugar de sombra, como define
 * el Design System, para no saturar la interfaz de tarjetas flotantes.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
  as: Tag = 'section',
}: PanelProps) {
  return (
    <Tag className={cn('rounded-lg border border-border bg-surface', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-h3 text-fg">{title}</h2>}
            {description && <p className="text-body-sm text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4 md:p-5')}>{children}</div>
    </Tag>
  );
}
