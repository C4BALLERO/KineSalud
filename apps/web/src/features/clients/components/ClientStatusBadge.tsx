import type { ClientStatus } from '@kinesalud/shared';
import { CircleCheck, CircleSlash } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return status === 'ACTIVO' ? (
    <Badge tone="success" icon={<CircleCheck aria-hidden="true" />}>
      Activo
    </Badge>
  ) : (
    <Badge icon={<CircleSlash aria-hidden="true" />}>Inactivo</Badge>
  );
}
