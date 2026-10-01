import type { StatusCounts } from '@kinesalud/shared';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import type { Bucket } from '../model';

/**
 * Grupos del gráfico de citas. PENDIENTE y CONFIRMADA se suman como "por
 * atender": para el reporte importa si la cita se resolvió o no.
 */
const GROUPS = [
  {
    key: 'attended',
    label: 'Atendidas',
    swatch: 'bg-success',
    of: (c: StatusCounts) => c.ATENDIDA,
  },
  {
    key: 'open',
    label: 'Por atender',
    swatch: 'bg-info',
    of: (c: StatusCounts) => c.PENDIENTE + c.CONFIRMADA,
  },
  {
    key: 'noShow',
    label: 'No asistió',
    swatch: 'bg-danger',
    of: (c: StatusCounts) => c.NO_ASISTIO,
  },
  {
    key: 'cancelled',
    label: 'Canceladas',
    swatch: 'bg-border-strong',
    of: (c: StatusCounts) => c.CANCELADA,
  },
] as const;

const totalOf = (c: StatusCounts) => GROUPS.reduce((s, g) => s + g.of(c), 0);

function describe(c: StatusCounts): string {
  const parts = GROUPS.filter((g) => g.of(c) > 0).map((g) => `${g.of(c)} ${g.label.toLowerCase()}`);
  return parts.length > 0 ? parts.join(', ') : 'sin citas';
}

/** Citas por período, apiladas por estado, con leyenda (el estado nunca va solo en el color). */
export function StatusChart({ buckets }: { buckets: Bucket<StatusCounts>[] }) {
  const max = Math.max(1, ...buckets.map((b) => totalOf(b.value)));
  const showValues = buckets.length <= 16;
  const labelEvery = Math.ceil(buckets.length / 12);
  const totals = GROUPS.map((g) => ({
    ...g,
    total: buckets.reduce((s, b) => s + g.of(b.value), 0),
  }));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Leyenda">
        {totals.map((g) => (
          <li key={g.key} className="flex items-center gap-1.5 text-caption text-fg-muted">
            <span aria-hidden="true" className={cn('size-2.5 rounded-[2px]', g.swatch)} />
            {g.label}
            <span className="tabular font-semibold text-fg">{g.total}</span>
          </li>
        ))}
      </ul>
      <ol
        aria-label="Citas por período"
        className="flex h-48 items-end gap-0.5 border-b border-border-strong sm:gap-1.5"
      >
        {buckets.map((b) => {
          const total = totalOf(b.value);
          const label = `${b.longLabel}: ${total} ${total === 1 ? 'cita' : 'citas'} (${describe(b.value)})`;
          return (
            <li
              key={b.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <Tooltip
                content={
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{b.longLabel}</span>
                    <span>{describe(b.value)}</span>
                  </span>
                }
              >
                <span
                  role="img"
                  aria-label={label}
                  className="flex h-full w-full flex-col items-center justify-end gap-1"
                >
                  {showValues && total > 0 && (
                    <span className="tabular text-caption text-fg-muted">{total}</span>
                  )}
                  <span
                    className="flex w-full max-w-10 flex-col-reverse gap-0.5"
                    style={{ height: `${(total / max) * 100}%` }}
                  >
                    {GROUPS.map((g) => {
                      const v = g.of(b.value);
                      if (v === 0) return null;
                      return (
                        <span
                          key={g.key}
                          className={cn(
                            'w-full first:rounded-b-none last:rounded-t-[4px]',
                            g.swatch,
                          )}
                          style={{ flexGrow: v, flexBasis: 0, minHeight: 2 }}
                        />
                      );
                    })}
                  </span>
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <AxisLabels buckets={buckets} every={labelEvery} />
    </div>
  );
}

/** Una serie (p. ej. ingresos): sin leyenda, el título la nombra. */
export function ValueChart({
  buckets,
  format,
}: {
  buckets: Bucket<number>[];
  format: (value: number) => string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const labelEvery = Math.ceil(buckets.length / 12);
  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label="Valores por período"
        className="flex h-40 items-end gap-0.5 border-b border-border-strong sm:gap-1.5"
      >
        {buckets.map((b) => {
          const label = `${b.longLabel}: ${format(b.value)}`;
          return (
            <li key={b.key} className="flex h-full min-w-0 flex-1 items-end justify-center">
              <Tooltip content={label}>
                <span
                  role="img"
                  aria-label={label}
                  className="flex h-full w-full max-w-10 items-end"
                >
                  <span
                    className={cn(
                      'w-full rounded-t-[4px] bg-chart-1',
                      b.value === 0 && 'bg-transparent',
                    )}
                    style={{ height: `${(b.value / max) * 100}%` }}
                  />
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <AxisLabels buckets={buckets} every={labelEvery} />
    </div>
  );
}

function AxisLabels<T>({ buckets, every }: { buckets: Bucket<T>[]; every: number }) {
  return (
    <ol aria-hidden="true" className="flex gap-0.5 sm:gap-1.5">
      {buckets.map((b, i) => (
        <li key={b.key} className="min-w-0 flex-1 truncate text-center text-caption text-fg-muted">
          {i % every === 0 ? b.label : ''}
        </li>
      ))}
    </ol>
  );
}
