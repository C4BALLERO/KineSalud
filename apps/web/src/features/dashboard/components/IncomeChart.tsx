import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { formatDayMonth, formatMoney } from '@/utils/format';
import type { IncomeDay } from '@/features/cash/model';

/**
 * Ingresos por día del mes. Una sola serie (sin leyenda: el título la nombra);
 * con hasta 31 barras no se rotulan todas: el monto va en el tooltip y en el
 * nombre accesible, y el eje marca cada 5 días y hoy.
 */
export function IncomeChart({ days, today }: { days: IncomeDay[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.cents));
  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label="Ingresos por día"
        className="flex h-36 items-end gap-px border-b border-border-strong sm:gap-1"
      >
        {days.map((d) => {
          const isToday = d.date === today;
          const label = `${formatDayMonth(d.date)}: ${d.cents > 0 ? formatMoney(d.cents) : 'sin ingresos'}`;
          return (
            <li key={d.date} className="flex h-full min-w-0 flex-1 items-end">
              <Tooltip content={label}>
                <span role="img" aria-label={label} className="flex h-full w-full items-end">
                  <span
                    className={cn(
                      'w-full rounded-t-[3px] bg-chart-1',
                      isToday && 'bg-primary',
                      d.cents === 0 && 'bg-transparent',
                    )}
                    style={{ height: `${(d.cents / max) * 100}%` }}
                  />
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <ol aria-hidden="true" className="flex gap-px sm:gap-1">
        {days.map((d) => {
          const day = Number(d.date.slice(8, 10));
          const isToday = d.date === today;
          const show = isToday || day === 1 || day % 5 === 0;
          return (
            <li
              key={d.date}
              className={cn(
                'tabular min-w-0 flex-1 text-center text-caption',
                isToday ? 'font-semibold text-primary' : 'text-fg-muted',
              )}
            >
              {show ? (isToday ? 'Hoy' : day) : ''}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Reparto horizontal (medio de pago, profesional): barra + monto en texto. */
export function IncomeBreakdown({
  items,
  label,
}: {
  items: { key: string; label: string; cents: number }[];
  label: string;
}) {
  const total = items.reduce((sum, i) => sum + i.cents, 0);
  const max = Math.max(1, ...items.map((i) => i.cents));
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-body-sm">
            <span className="truncate text-fg">{i.label}</span>
            <span className="tabular shrink-0 text-fg">
              {formatMoney(i.cents)}
              {total > 0 && (
                <span className="text-fg-subtle"> · {Math.round((i.cents / total) * 100)}%</span>
              )}
            </span>
          </div>
          <span
            aria-hidden="true"
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <span
              className="block h-full rounded-full bg-chart-1"
              style={{ width: `${(i.cents / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
