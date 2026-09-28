import { CalendarX2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppointmentRow } from '@/components/domain/AppointmentRow';
import { EmptyState } from '@/components/feedback/States';
import { cn } from '@/utils/cn';
import { capitalizeFirst, formatDayLong } from '@/utils/format';
import type { AgendaAppointment } from '../api/appointments';

/**
 * Agenda como lista (móvil y lectores de pantalla): citas agrupadas por día,
 * cada una abre su detalle.
 */
export function AgendaList({
  appointments,
  now,
  onOpen,
  selectedId,
  hideProfessional,
  emptyAction,
  showDayHeaders = true,
}: {
  appointments: AgendaAppointment[];
  now: Date;
  onOpen: (id: string) => void;
  selectedId?: string | null;
  hideProfessional?: boolean;
  emptyAction?: ReactNode;
  showDayHeaders?: boolean;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<CalendarX2 />}
        title="Sin citas"
        description="No hay citas que coincidan con la fecha y los filtros elegidos."
        action={emptyAction}
      />
    );
  }
  const groups = new Map<string, AgendaAppointment[]>();
  for (const a of appointments) groups.set(a.date, [...(groups.get(a.date) ?? []), a]);

  return (
    <div className="flex flex-col">
      {[...groups.entries()].map(([date, items]) => (
        <section key={date} aria-label={formatDayLong(date)}>
          {showDayHeaders && (
            <h3 className="border-y border-border bg-surface-muted px-4 py-1.5 text-caption font-semibold text-fg-muted first:border-t-0 md:px-5">
              {capitalizeFirst(formatDayLong(date))}
            </h3>
          )}
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpen(a.id)}
                  className={cn(
                    'block w-full cursor-pointer text-left transition-colors duration-150 hover:bg-surface-muted',
                    a.id === selectedId && 'bg-primary-subtle',
                  )}
                >
                  <AppointmentRow appointment={a} now={now} hideProfessional={hideProfessional} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
