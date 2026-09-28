import { CheckCheck, CircleCheck, CircleX, Clock, UserX, type LucideIcon } from 'lucide-react';
import type { AppointmentStatus, TreatmentCategory } from '@kinesalud/shared';
import type { BadgeTone } from '@/components/ui/Badge';

/** Representación visual de cada estado de cita (color + icono + texto). */
export const APPOINTMENT_STATUS_VISUALS: Record<
  AppointmentStatus,
  { tone: BadgeTone; icon: LucideIcon }
> = {
  PENDIENTE: { tone: 'warning', icon: Clock },
  CONFIRMADA: { tone: 'info', icon: CircleCheck },
  ATENDIDA: { tone: 'success', icon: CheckCheck },
  CANCELADA: { tone: 'neutral', icon: CircleX },
  NO_ASISTIO: { tone: 'danger', icon: UserX },
};

/** Clases por categoría. El color siempre va acompañado de la etiqueta de texto. */
export const CATEGORY_CLASSES: Record<
  TreatmentCategory,
  { text: string; bg: string; bar: string; dot: string }
> = {
  FISIOTERAPIA: {
    text: 'text-cat-fisioterapia',
    bg: 'bg-cat-fisioterapia-subtle',
    bar: 'border-l-cat-fisioterapia',
    dot: 'bg-cat-fisioterapia',
  },
  REHABILITACION: {
    text: 'text-cat-rehabilitacion',
    bg: 'bg-cat-rehabilitacion-subtle',
    bar: 'border-l-cat-rehabilitacion',
    dot: 'bg-cat-rehabilitacion',
  },
  ESTETICA: {
    text: 'text-cat-estetica',
    bg: 'bg-cat-estetica-subtle',
    bar: 'border-l-cat-estetica',
    dot: 'bg-cat-estetica',
  },
};
