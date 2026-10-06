import type { StatusCounts } from '@kinesalud/shared';
import { BarChart } from '@/components/charts/BarChart';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { STATUS_GROUPS, statusSegments } from '@/components/charts/statusGroups';
import type { Bucket } from '../model';

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;

/** Citas por período, apiladas por estado, con leyenda, promedio y desglose al señalar. */
export function StatusChart({ buckets }: { buckets: Bucket<StatusCounts>[] }) {
  const data = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    longLabel: b.longLabel,
    segments: statusSegments(b.value),
  }));
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const avg = average(totals);
  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        items={STATUS_GROUPS.map((g) => ({
          key: g.key,
          label: g.label,
          className: g.className,
          total: buckets.reduce((s, b) => s + g.of(b.value), 0),
        }))}
      />
      <BarChart
        caption="Citas por período"
        data={data}
        heightClass="h-52"
        showValues={buckets.length <= 16}
        describe={(d, total) => {
          const parts = d.segments
            .filter((s) => s.value > 0)
            .map((s) => `${s.value} ${s.label.toLowerCase()}`);
          return `${d.longLabel}: ${total} ${total === 1 ? 'cita' : 'citas'} (${parts.length ? parts.join(', ') : 'sin citas'})`;
        }}
        reference={
          buckets.length > 1 && avg > 0
            ? { value: avg, label: `Promedio ${avg.toFixed(1).replace('.', ',')}` }
            : undefined
        }
      />
    </div>
  );
}

/** Una serie (p. ej. ingresos): sin leyenda, el título la nombra; con promedio. */
export function ValueChart({
  buckets,
  format,
  formatTick = format,
}: {
  buckets: Bucket<number>[];
  format: (value: number) => string;
  formatTick?: (value: number) => string;
}) {
  const avg = average(buckets.map((b) => b.value));
  return (
    <BarChart
      caption="Valores por período"
      heightClass="h-44"
      formatValue={format}
      formatTick={formatTick}
      data={buckets.map((b) => ({
        key: b.key,
        label: b.label,
        longLabel: b.longLabel,
        segments: [{ key: 'value', label: 'Total', value: b.value, className: 'bg-chart-1' }],
      }))}
      reference={
        buckets.length > 1 && avg > 0
          ? { value: avg, label: `Promedio ${format(Math.round(avg))}` }
          : undefined
      }
    />
  );
}
