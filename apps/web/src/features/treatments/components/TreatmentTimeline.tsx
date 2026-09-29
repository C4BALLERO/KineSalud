import { APPOINTMENT_STATUS_LABELS } from '@kinesalud/shared';
import { CalendarPlus } from 'lucide-react';
import { Link } from 'react-router';
import { APPOINTMENT_STATUS_VISUALS } from '@/components/domain/visuals';
import { cn } from '@/utils/cn';
import { capitalizeFirst, formatDayLong, formatTime } from '@/utils/format';
import type { TimelineItem } from '../model';

const MARKER: Record<string, string> = {
  ATENDIDA: 'border-success bg-success text-on-primary',
  PENDIENTE: 'border-warning bg-surface text-warning',
  CONFIRMADA: 'border-info bg-surface text-info',
  NO_ASISTIO: 'border-danger bg-surface text-danger',
  CANCELADA: 'border-border-strong bg-surface text-fg-subtle',
};

/**
 * Sesiones del tratamiento en una línea vertical: realizadas (marcador lleno),
 * agendadas (contorno), perdidas o canceladas (atenuadas) y las que faltan
 * agendar. El estado se indica con icono y texto, no solo con color.
 */
export function TreatmentTimeline({
  items,
  scheduleHref,
}: {
  items: TimelineItem[];
  /** Enlace para agendar las sesiones que faltan (recepción y administración). */
  scheduleHref?: string;
}) {
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        if (item.kind === 'unscheduled') {
          return (
            <li key="unscheduled" className="relative flex gap-4 pb-1">
              <span
                aria-hidden="true"
                className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-surface text-caption text-fg-subtle"
              >
                …
              </span>
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pt-0.5">
                <p className="text-body-sm text-fg-muted">
                  {item.count === 1
                    ? `Falta agendar la sesión ${item.from}`
                    : `Faltan agendar ${item.count} sesiones (de la ${item.from} a la ${item.from + item.count - 1})`}
                </p>
                {scheduleHref && (
                  <Link
                    to={scheduleHref}
                    className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    <CalendarPlus aria-hidden="true" className="size-4" />
                    Agendar
                  </Link>
                )}
              </div>
            </li>
          );
        }

        const a = item.appointment;
        const { icon: Icon } = APPOINTMENT_STATUS_VISUALS[a.status];
        const muted = a.status === 'CANCELADA' || a.status === 'NO_ASISTIO';
        return (
          <li key={a.id} className="relative flex gap-4 pb-5">
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-0 left-3.5 w-px -translate-x-1/2 bg-border"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-3.5',
                MARKER[a.status],
              )}
            >
              <Icon />
            </span>
            <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', muted && 'opacity-70')}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
                <span className="font-semibold text-fg">
                  {a.status === 'ATENDIDA' || a.status === 'PENDIENTE' || a.status === 'CONFIRMADA'
                    ? a.sessionNumber
                      ? `Sesión ${a.sessionNumber}`
                      : 'Sesión'
                    : 'Cita'}
                </span>
                <span className="text-fg-muted">{APPOINTMENT_STATUS_LABELS[a.status]}</span>
              </p>
              <Link
                to={`/agenda?fecha=${a.date}&cita=${a.id}`}
                className="w-fit text-caption text-fg-muted underline-offset-2 hover:text-primary hover:underline"
              >
                {capitalizeFirst(formatDayLong(a.date))} · {formatTime(a.startAt)} ·{' '}
                {a.professionalName}
              </Link>
              {a.cancelReason && (
                <p className="text-caption text-fg-subtle">Motivo: {a.cancelReason}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
