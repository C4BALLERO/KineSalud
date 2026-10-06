import { cn } from '@/utils/cn';

/** Leyenda de un gráfico con varias series: color + nombre + total (nunca solo color). */
export function ChartLegend({
  items,
}: {
  items: { key: string; label: string; className: string; total?: number }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Leyenda">
      {items.map((g) => (
        <li key={g.key} className="flex items-center gap-1.5 text-caption text-fg-muted">
          <span aria-hidden="true" className={cn('size-2.5 rounded-[2px]', g.className)} />
          {g.label}
          {g.total !== undefined && (
            <span className="tabular font-semibold text-fg">{g.total}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
