import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@kinesalud/shared';
import { Link } from 'react-router';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { formatDayShort } from '@/utils/format';
import type { WeekDaySummary } from '../model';

const BREAKDOWN: AppointmentStatus[] = [
  'ATENDIDA',
  'CONFIRMADA',
  'PENDIENTE',
  'NO_ASISTIO',
  'CANCELADA',
];

function breakdownText(day: WeekDaySummary): string {
  return BREAKDOWN.filter((s) => day.counts[s] > 0)
    .map((s) => `${day.counts[s]} ${APPOINTMENT_STATUS_LABELS[s].toLowerCase()}`)
    .join(', ');
}

/**
 * Citas programadas por día (lunes a sábado). Una sola serie: sin leyenda, el
 * título la nombra. Cifra directa sobre cada barra (solo 6 marcas) y base
 * visible; el desglose por estado va en el tooltip y en el nombre accesible.
 */
export function WeekChart({ days, today }: { days: WeekDaySummary[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex h-44 items-end gap-2 border-b border-border-strong sm:gap-4">
        {days.map((day) => {
          const isToday = day.date === today;
          const pct = (day.total / max) * 100;
          const detail = breakdownText(day);
          const label = `${day.label} ${formatDayShort(day.date).split(' ')[1]}: ${day.total} ${day.total === 1 ? 'cita' : 'citas'}${detail ? ` (${detail})` : ''}. Ver en la agenda.`;
          return (
            <li
              key={day.date}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <Tooltip
                content={
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{day.label}</span>
                    <span>{detail || 'Sin citas'}</span>
                  </span>
                }
              >
                <Link
                  to={`/agenda?fecha=${day.date}`}
                  aria-label={label}
                  className="group flex h-full w-full flex-col items-center justify-end gap-1 rounded-t-sm"
                >
                  <span
                    className={cn(
                      'tabular text-caption',
                      isToday ? 'font-semibold text-fg' : 'text-fg-muted',
                    )}
                  >
                    {day.total}
                  </span>
                  <span
                    className={cn(
                      'w-full max-w-10 rounded-t-[4px] bg-chart-1 transition-opacity duration-150 group-hover:opacity-80',
                      day.total === 0 && 'bg-transparent',
                    )}
                    style={{ height: `${pct}%` }}
                  />
                </Link>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <ol aria-hidden="true" className="flex gap-2 sm:gap-4">
        {days.map((day) => {
          const isToday = day.date === today;
          return (
            <li
              key={day.date}
              className={cn(
                'flex-1 text-center text-caption capitalize',
                isToday ? 'font-semibold text-primary' : 'text-fg-muted',
              )}
            >
              {isToday ? 'Hoy' : formatDayShort(day.date)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
