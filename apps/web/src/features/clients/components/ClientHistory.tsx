import { TREATMENT_STATUS_LABELS } from '@kinesalud/shared';
import { CalendarX2, HeartPulse } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppointmentRow } from '@/components/domain/AppointmentRow';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { EmptyState } from '@/components/feedback/States';
import { Badge } from '@/components/ui/Badge';
import { SessionProgress } from '@/components/ui/Progress';
import { capitalizeFirst, formatDayLong } from '@/utils/format';
import type { ClientAppointment, ClientTreatment } from '../api/clients';

/** Citas agrupadas por día (más recientes primero). */
export function AppointmentHistory({
  appointments,
  now,
  emptyAction,
}: {
  appointments: ClientAppointment[];
  now: Date;
  emptyAction?: ReactNode;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<CalendarX2 />}
        title="Sin citas registradas"
        description="Las citas del cliente aparecerán aquí."
        action={emptyAction}
      />
    );
  }

  const groups = new Map<string, ClientAppointment[]>();
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
                <AppointmentRow appointment={a} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const TREATMENT_TONES = {
  ACTIVO: 'primary',
  FINALIZADO: 'success',
  SUSPENDIDO: 'neutral',
} as const;

export function TreatmentList({ treatments }: { treatments: ClientTreatment[] }) {
  if (treatments.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<HeartPulse />}
        title="Sin tratamientos"
        description="Los planes de fisioterapia, rehabilitación o estética del cliente aparecerán aquí."
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {treatments.map((t) => (
        <li key={t.id} className="flex flex-col gap-3 p-4 md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-fg">{t.serviceName}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-caption text-fg-muted">
                <CategoryTag category={t.category} />
                <span aria-hidden="true">·</span>
                {t.professionalName}
                <span aria-hidden="true">·</span>
                desde el {formatDayLong(t.startDate)}
              </p>
            </div>
            <Badge tone={TREATMENT_TONES[t.status]}>{TREATMENT_STATUS_LABELS[t.status]}</Badge>
          </div>
          <SessionProgress completed={t.completedSessions} planned={t.plannedSessions} />
        </li>
      ))}
    </ul>
  );
}
