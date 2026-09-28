import { CircleCheck, CircleSlash, Clock, Link2, Link2Off, Plane } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { AvailabilitySummary } from '../model';

export function ProfessionalStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" icon={<CircleCheck aria-hidden="true" />}>
      Activo
    </Badge>
  ) : (
    <Badge icon={<CircleSlash aria-hidden="true" />}>Inactivo</Badge>
  );
}

/** Disponibilidad del día con icono y texto (nunca solo color). */
export function AvailabilityBadge({ summary }: { summary: AvailabilitySummary }) {
  const icon =
    summary.tone === 'success' ? (
      <Clock aria-hidden="true" />
    ) : summary.tone === 'warning' ? (
      <Plane aria-hidden="true" />
    ) : (
      <CircleSlash aria-hidden="true" />
    );
  return (
    <Badge tone={summary.tone} icon={icon}>
      {summary.label}
    </Badge>
  );
}

export function AccountBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <Badge tone="info" icon={<Link2 aria-hidden="true" />}>
      Con cuenta
    </Badge>
  ) : (
    <Badge icon={<Link2Off aria-hidden="true" />}>Sin cuenta</Badge>
  );
}
