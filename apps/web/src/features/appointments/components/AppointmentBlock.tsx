import { APPOINTMENT_STATUS_LABELS, TREATMENT_CATEGORY_LABELS } from '@kinesalud/shared';
import type { CSSProperties } from 'react';
import { APPOINTMENT_STATUS_VISUALS, CATEGORY_CLASSES } from '@/components/domain/visuals';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';
import type { AgendaAppointment } from '../api/appointments';

interface AppointmentBlockProps {
  appointment: AgendaAppointment;
  style: CSSProperties;
  onOpen: (id: string) => void;
  /** Vista semana: menos texto por bloque. */
  compact?: boolean;
  /** Muestra el profesional (vista semana con todo el personal). */
  showProfessional?: boolean;
  selected?: boolean;
}

/**
 * Cita en la grilla: barra lateral y fondo tintado por categoría, icono y
 * texto de estado (nunca solo color). Canceladas atenuadas y tachadas; las
 * inasistencias con borde punteado.
 */
export function AppointmentBlock({
  appointment: a,
  style,
  onOpen,
  compact,
  showProfessional,
  selected,
}: AppointmentBlockProps) {
  const category = CATEGORY_CLASSES[a.category];
  const { icon: StatusIcon } = APPOINTMENT_STATUS_VISUALS[a.status];
  const cancelled = a.status === 'CANCELADA';
  const noShow = a.status === 'NO_ASISTIO';
  const label = [
    `${formatTime(a.startAt)} a ${formatTime(a.endAt)}`,
    a.clientName,
    a.serviceName,
    TREATMENT_CATEGORY_LABELS[a.category],
    a.professionalName,
    a.roomName,
    APPOINTMENT_STATUS_LABELS[a.status],
  ].join(', ');

  return (
    <button
      type="button"
      onClick={() => onOpen(a.id)}
      aria-label={label}
      title={label}
      style={style}
      className={cn(
        'absolute flex cursor-pointer flex-col overflow-hidden rounded-sm border-l-[3px] px-1.5 py-1 text-left',
        'transition-shadow duration-150 hover:z-10 hover:shadow-md focus-visible:z-20',
        category.bar,
        cancelled ? 'bg-surface-muted' : category.bg,
        noShow && 'border-y border-r border-dashed border-danger',
        selected && 'z-10 ring-2 ring-primary',
      )}
    >
      <span className="flex min-w-0 items-center gap-1 text-caption">
        <StatusIcon
          aria-hidden="true"
          className={cn('size-3.5 shrink-0', cancelled ? 'text-fg-subtle' : category.text)}
        />
        <span
          className={cn(
            'tabular shrink-0 font-semibold',
            cancelled ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {formatTime(a.startAt)}
        </span>
        <span
          className={cn(
            'truncate font-medium',
            cancelled ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {a.clientName}
        </span>
      </span>
      {!compact && (
        <span className="truncate text-caption text-fg-muted">
          {a.serviceName}
          {a.sessionNumber ? ` · S${a.sessionNumber}` : ''}
          {' · '}
          {a.roomName}
        </span>
      )}
      {showProfessional && (
        <span className="truncate text-caption text-fg-muted">{a.professionalName}</span>
      )}
    </button>
  );
}
