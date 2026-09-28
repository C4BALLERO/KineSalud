import {
  TREATMENT_CATEGORY_LABELS,
  type AppointmentStatus,
  type TreatmentCategory,
} from '@kinesalud/shared';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';
import { AppointmentStatusBadge } from './StatusBadge';
import { CATEGORY_CLASSES } from './visuals';

export interface AppointmentRowData {
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  clientName: string;
  professionalName: string;
  serviceName: string;
  category: TreatmentCategory;
  roomName: string;
  sessionNumber: number | null;
}

interface AppointmentRowProps {
  appointment: AppointmentRowData;
  now: Date;
  /** Oculta el profesional (vista "Mi día", donde siempre es la misma persona). */
  hideProfessional?: boolean;
}

/**
 * Cita en formato de lista: hora, categoría (barra lateral + texto), cliente,
 * servicio, profesional, espacio y estado. Las citas ya terminadas se atenúan;
 * la cita en curso se resalta.
 */
export function AppointmentRow({ appointment: a, now, hideProfessional }: AppointmentRowProps) {
  const t = now.getTime();
  const inProgress = a.startAt.getTime() <= t && t < a.endAt.getTime() && a.status !== 'CANCELADA';
  const finished = a.endAt.getTime() <= t;
  const category = CATEGORY_CLASSES[a.category];

  const details = [
    a.serviceName + (a.sessionNumber ? ` · sesión ${a.sessionNumber}` : ''),
    hideProfessional ? null : a.professionalName,
    a.roomName,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-l-[3px] py-3 pr-4 pl-3 md:items-center md:pr-5',
        category.bar,
        inProgress && 'bg-primary-subtle',
        a.status === 'CANCELADA' && 'opacity-70',
      )}
    >
      <div className="w-14 shrink-0 md:w-24">
        <p
          className={cn(
            'tabular text-body-sm font-semibold',
            finished && !inProgress ? 'text-fg-muted' : 'text-fg',
          )}
        >
          {formatTime(a.startAt)}
          <span className="hidden font-normal text-fg-subtle md:inline">
            {' '}
            – {formatTime(a.endAt)}
          </span>
        </p>
        {inProgress && <p className="text-caption font-medium text-primary">En curso</p>}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-body-sm font-semibold',
            a.status === 'CANCELADA' ? 'text-fg-muted line-through' : 'text-fg',
          )}
        >
          {a.clientName}
        </p>
        <p className="truncate text-caption text-fg-muted">
          <span className={cn('font-medium', category.text)}>
            {TREATMENT_CATEGORY_LABELS[a.category]}
          </span>
          {' · '}
          {details.join(' · ')}
        </p>
      </div>

      <div className="shrink-0">
        <AppointmentStatusBadge status={a.status} />
      </div>
    </div>
  );
}
