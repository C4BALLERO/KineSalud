import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@kinesalud/shared';
import { APPOINTMENT_STATUS_VISUALS } from '@/components/domain/visuals';
import { cn } from '@/utils/cn';
import type { StatusCounts } from '../model';

/** Orden de lectura del día: lo resuelto primero, lo pendiente después. */
const ORDER: AppointmentStatus[] = [
  'ATENDIDA',
  'CONFIRMADA',
  'PENDIENTE',
  'NO_ASISTIO',
  'CANCELADA',
];

const SEGMENT: Record<AppointmentStatus, string> = {
  ATENDIDA: 'bg-success',
  CONFIRMADA: 'bg-info',
  PENDIENTE: 'bg-warning',
  NO_ASISTIO: 'bg-danger',
  CANCELADA: 'bg-border-strong',
};

interface DaySummaryProps {
  counts: StatusCounts;
  /** "Tus citas de hoy" / "Citas de hoy". */
  label: string;
  /** Mensaje cuando no hay citas (en lugar de una leyenda llena de ceros). */
  emptyHint: string;
}

/**
 * Resumen del día en una sola franja: barra segmentada (decorativa) más una
 * leyenda con icono, texto y cifra por estado. Reemplaza un muro de 5 tarjetas.
 */
export function DaySummary({ counts, label, emptyHint }: DaySummaryProps) {
  const total = ORDER.reduce((sum, s) => sum + counts[s], 0);

  if (total === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline gap-2">
          <span className="tabular text-display text-fg">0</span>
          <span className="text-body text-fg-muted">{label}</span>
        </p>
        <p className="text-body-sm text-fg-muted">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2">
        <span className="tabular text-display text-fg">{total}</span>
        <span className="text-body text-fg-muted">{label}</span>
      </p>

      <div aria-hidden="true" className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {ORDER.filter((s) => counts[s] > 0).map((s) => (
          <span
            key={s}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', SEGMENT[s])}
            style={{ flexGrow: counts[s] }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {ORDER.map((s) => {
          const Icon = APPOINTMENT_STATUS_VISUALS[s].icon;
          return (
            <li
              key={s}
              className={cn(
                'flex items-center gap-1.5 text-body-sm',
                counts[s] === 0 ? 'text-fg-subtle' : 'text-fg',
              )}
            >
              <span aria-hidden="true" className={cn('size-2 rounded-full', SEGMENT[s])} />
              <Icon aria-hidden="true" className="size-3.5 text-fg-muted" />
              <span className="tabular font-semibold">{counts[s]}</span>
              {APPOINTMENT_STATUS_LABELS[s].toLowerCase()}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
