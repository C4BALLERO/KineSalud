import type { CSSProperties } from 'react';
import { BarChart } from '@/components/charts/BarChart';
import { compactMoney } from '@/components/charts/scale';
import { formatDayMonth, formatMoney } from '@/utils/format';
import type { IncomeDay } from '@/features/cash/model';

/**
 * Ingresos por día del mes, con el promedio diario de lo que va del mes.
 * Con hasta 31 barras no se rotulan todas: el monto aparece al señalar (y en
 * el nombre accesible) y el eje marca cada 5 días y hoy.
 */
export function IncomeChart({ days, today }: { days: IncomeDay[]; today: string }) {
  const elapsed = days.filter((d) => d.date <= today);
  const avg = elapsed.length > 0 ? elapsed.reduce((s, d) => s + d.cents, 0) / elapsed.length : 0;
  return (
    <BarChart
      caption="Ingresos por día"
      heightClass="h-40"
      formatValue={formatMoney}
      formatTick={compactMoney}
      data={days.map((d) => ({
        key: d.date,
        label: String(Number(d.date.slice(8, 10))),
        longLabel: formatDayMonth(d.date),
        segments: [{ key: 'income', label: 'Ingresos', value: d.cents, className: 'bg-chart-1' }],
        highlight: d.date === today,
      }))}
      describe={(d, total) => `${d.longLabel}: ${total > 0 ? formatMoney(total) : 'sin ingresos'}`}
      axisLabel={(d) => {
        const day = Number(d.key.slice(8, 10));
        if (d.highlight) return 'Hoy';
        return day === 1 || day % 5 === 0 ? String(day) : '';
      }}
      reference={
        avg > 0 ? { value: avg, label: `Promedio ${formatMoney(Math.round(avg))}` } : undefined
      }
    />
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
      {items.map((i, index) => (
        <li
          key={i.key}
          className="group -mx-2 flex flex-col gap-1.5 rounded-md px-2 py-1 transition-colors duration-150 hover:bg-surface-muted"
        >
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
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <span
              className="kv-bar-x block h-full rounded-full bg-chart-1 transition-[filter] duration-150 group-hover:brightness-110 group-hover:saturate-150"
              style={{ width: `${(i.cents / max) * 100}%`, '--i': index } as CSSProperties}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
