import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface StatProps {
  label: string;
  value: ReactNode;
  /** Contexto breve: "de 5 en total", "+3 esta semana". */
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Indicador compacto. Se usa en grupos de pocos (máx. 3–4) dentro de una
 * misma franja, no como muro de tarjetas.
 */
export function Stat({ label, value, hint, icon, className }: StatProps) {
  return (
    <div className={cn('flex min-w-0 items-start gap-3', className)}>
      {icon && (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary [&_svg]:size-4.5"
        >
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-body-sm text-fg-muted">{label}</span>
        <span className="tabular text-h1 text-fg">{value}</span>
        {hint && <span className="text-caption text-fg-subtle">{hint}</span>}
      </div>
    </div>
  );
}
