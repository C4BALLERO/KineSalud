import { cn } from '@/utils/cn';

interface ProgressBarProps {
  value: number;
  max: number;
  /** Nombre accesible de la barra. */
  label: string;
  className?: string;
}

export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-standard"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface SessionProgressProps {
  completed: number;
  planned: number;
  className?: string;
  /** Versión compacta para listas (sin segmentos). */
  compact?: boolean;
}

/**
 * Progreso de un tratamiento: "Sesión 4 de 10" con un segmento por sesión.
 * Con más de 20 sesiones se usa una barra continua para no perder legibilidad.
 */
export function SessionProgress({ completed, planned, className, compact }: SessionProgressProps) {
  const label = `${completed} de ${planned} sesiones realizadas`;
  const segmented = !compact && planned > 0 && planned <= 20;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body-sm font-medium text-fg">
          Sesión <span className="tabular">{completed}</span> de{' '}
          <span className="tabular">{planned}</span>
        </span>
        {!compact && (
          <span className="tabular text-caption text-fg-subtle">
            {planned > 0 ? Math.round((completed / planned) * 100) : 0}%
          </span>
        )}
      </div>
      {segmented ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={planned}
          aria-valuenow={completed}
          className="flex gap-1"
        >
          {Array.from({ length: planned }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 flex-1 rounded-full',
                i < completed ? 'bg-primary' : 'bg-surface-muted ring-1 ring-border ring-inset',
              )}
            />
          ))}
        </div>
      ) : (
        <ProgressBar value={completed} max={planned} label={label} />
      )}
    </div>
  );
}
