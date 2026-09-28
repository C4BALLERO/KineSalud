import { ROLE_LABELS, type Role } from '@kinesalud/shared';
import { CircleCheck, CircleSlash } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ROLE_ICONS } from './roleIcons';

export function RoleBadge({ role }: { role: Role }) {
  const Icon = ROLE_ICONS[role];
  return (
    <Badge
      tone={role === 'ADMINISTRADOR' ? 'primary' : 'neutral'}
      icon={<Icon aria-hidden="true" />}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function UserStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" icon={<CircleCheck aria-hidden="true" />}>
      Activo
    </Badge>
  ) : (
    <Badge icon={<CircleSlash aria-hidden="true" />}>Desactivado</Badge>
  );
}
