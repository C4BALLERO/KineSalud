import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@kinesalud/shared';
import { Badge } from '@/components/ui/Badge';
import { APPOINTMENT_STATUS_VISUALS } from './visuals';

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { tone, icon: Icon } = APPOINTMENT_STATUS_VISUALS[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" />}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
