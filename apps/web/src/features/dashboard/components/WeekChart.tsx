import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@kinesalud/shared';
import { BarChart } from '@/components/charts/BarChart';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { STATUS_GROUPS, statusSegments } from '@/components/charts/statusGroups';
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
 * Citas de la semana (lunes a sábado), apiladas por estado. Cada barra lleva a
 * la agenda de ese día; el desglose aparece al señalarla y en su nombre accesible.
 */
export function WeekChart({ days, today }: { days: WeekDaySummary[]; today: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        items={STATUS_GROUPS.map((g) => ({ key: g.key, label: g.label, className: g.className }))}
      />
      <BarChart
        caption="Citas por día de la semana"
        heightClass="h-44"
        showValues
        data={days.map((day) => ({
          key: day.date,
          label: day.date === today ? 'Hoy' : formatDayShort(day.date),
          longLabel: `${day.label} ${formatDayShort(day.date).split(' ')[1]}`,
          segments: statusSegments(day.counts),
          href: `/agenda?fecha=${day.date}`,
          highlight: day.date === today,
        }))}
        describe={(d, total) => {
          const day = days.find((x) => x.date === d.key)!;
          const detail = breakdownText(day);
          return `${d.longLabel}: ${total} ${total === 1 ? 'cita' : 'citas'}${detail ? ` (${detail})` : ''}. Ver en la agenda.`;
        }}
      />
    </div>
  );
}
