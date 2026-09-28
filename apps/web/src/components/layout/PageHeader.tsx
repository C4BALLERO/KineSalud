import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Acciones principales de la página (se apilan bajo el título en móvil). */
  actions?: ReactNode;
  /** Enlace de regreso para páginas de detalle. */
  back?: { to: string; label: string };
  /** Contenido previo al título, p. ej. un avatar. */
  leading?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  leading,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 md:mb-8', className)}>
      {back && (
        <Link
          to={back.to}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-sm text-body-sm font-medium text-fg-muted hover:text-fg"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-h1 text-balance text-fg">{title}</h1>
            {description && <p className="text-body text-fg-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
