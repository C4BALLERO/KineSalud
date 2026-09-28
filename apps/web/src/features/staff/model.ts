import {
  dayAvailability,
  EXCEPTION_TYPE_LABELS,
  formatRanges,
  type DateKey,
  type ProfessionalDoc,
} from '@kinesalud/shared';
import type { BadgeTone } from '@/components/ui/Badge';
import { formatDayMonth } from '@/utils/format';
import type { ExceptionItem } from './api/staff';

export interface AvailabilitySummary {
  tone: BadgeTone;
  label: string;
  /** Detalle: tramos del día o hasta cuándo dura la ausencia. */
  detail: string | null;
}

/** Resumen de disponibilidad de un día para listas y fichas ("Atiende hoy · 08:00–12:00"). */
export function availabilitySummary(
  professional: Pick<ProfessionalDoc, 'active' | 'weeklySchedule'>,
  exceptions: readonly ExceptionItem[],
  day: DateKey,
  isToday = true,
): AvailabilitySummary {
  const a = dayAvailability(professional, exceptions, day);
  switch (a.kind) {
    case 'inactive':
      return { tone: 'neutral', label: 'Inactivo', detail: null };
    case 'absent':
      return {
        tone: 'warning',
        label: EXCEPTION_TYPE_LABELS[a.exception.type],
        detail:
          a.exception.dateTo === day
            ? `Vuelve el día siguiente`
            : `Hasta el ${formatDayMonth(a.exception.dateTo)}`,
      };
    case 'off':
      return { tone: 'neutral', label: isToday ? 'No atiende hoy' : 'No atiende', detail: null };
    case 'working':
      return {
        tone: 'success',
        label: isToday ? 'Atiende hoy' : 'Atiende',
        detail: formatRanges(a.ranges),
      };
  }
}

/** Valores del formulario de ficha (texto y listas, antes de validar). */
export interface ProfessionalFormValues {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  categories: string[];
  specialties: string;
  serviceIds: string[];
}

export const EMPTY_PROFESSIONAL_FORM: ProfessionalFormValues = {
  title: 'Lic.',
  firstName: '',
  lastName: '',
  phone: '',
  categories: [],
  specialties: '',
  serviceIds: [],
};

export function toProfessionalFormValues(p: ProfessionalDoc): ProfessionalFormValues {
  return {
    title: p.title ?? '',
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone ?? '',
    categories: p.categories,
    specialties: p.specialties.join(', '),
    serviceIds: p.serviceIds,
  };
}
