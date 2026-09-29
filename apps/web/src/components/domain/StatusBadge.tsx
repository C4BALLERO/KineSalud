import {
  APPOINTMENT_STATUS_LABELS,
  TREATMENT_STATUS_LABELS,
  type AppointmentStatus,
  type TreatmentStatus,
} from '@kinesalud/shared';
import { Activity, CircleCheckBig, CirclePause } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { APPOINTMENT_STATUS_VISUALS } from './visuals';

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { tone, icon: Icon } = APPOINTMENT_STATUS_VISUALS[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" />}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const TREATMENT_VISUALS: Record<TreatmentStatus, { tone: BadgeTone; icon: typeof Activity }> = {
  ACTIVO: { tone: 'primary', icon: Activity },
  FINALIZADO: { tone: 'success', icon: CircleCheckBig },
  SUSPENDIDO: { tone: 'neutral', icon: CirclePause },
};

export function TreatmentStatusBadge({ status }: { status: TreatmentStatus }) {
  const { tone, icon: Icon } = TREATMENT_VISUALS[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" />}>
      {TREATMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
