import { CalendarX2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/States';
import { capitalizeFirst, formatDayLong } from '@/utils/format';
import { AppointmentRow, type AppointmentRowData } from './AppointmentRow';

interface AppointmentDayListProps<T extends AppointmentRowData & { id: string; date: string }> {
  /** Citas ya ordenadas; se agrupan por día respetando ese orden. */
  appointments: T[];
  now: Date;
  empty: { title: string; description: string; action?: ReactNode };
  hideProfessional?: boolean;
}

/** Citas agrupadas por día con encabezado de fecha (historial de cliente, citas de un profesional). */
export function AppointmentDayList<T extends AppointmentRowData & { id: string; date: string }>({
  appointments,
  now,
  empty,
  hideProfessional,
}: AppointmentDayListProps<T>) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<CalendarX2 />}
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    );
  }

  const groups = new Map<string, T[]>();
  for (const a of appointments) groups.set(a.date, [...(groups.get(a.date) ?? []), a]);

  return (
    <div className="flex flex-col">
      {[...groups.entries()].map(([date, items]) => (
        <section key={date} aria-label={formatDayLong(date)}>
          <h3 className="border-y border-border bg-surface-muted px-4 py-1.5 text-caption font-semibold text-fg-muted first:border-t-0 md:px-5">
            {capitalizeFirst(formatDayLong(date))}
          </h3>
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id}>
                <AppointmentRow appointment={a} now={now} hideProfessional={hideProfessional} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
