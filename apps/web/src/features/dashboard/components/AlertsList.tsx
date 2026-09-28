import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import type { AlertTone, DashboardAlert } from '../model';

const TONES: Record<AlertTone, { icon: typeof Info; className: string }> = {
  danger: { icon: CircleAlert, className: 'text-danger bg-danger-subtle' },
  warning: { icon: TriangleAlert, className: 'text-warning bg-warning-subtle' },
  info: { icon: Info, className: 'text-info bg-info-subtle' },
};

/** Alertas accionables. Si no hay ninguna, lo dice en positivo (no un panel vacío). */
export function AlertsList({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-start gap-3 p-4 md:p-5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success"
        >
          <CircleCheck className="size-4.5" />
        </span>
        <div>
          <p className="text-body-sm font-semibold text-fg">Todo en orden</p>
          <p className="text-caption text-fg-muted">
            No hay citas pendientes de registrar ni de confirmar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {alerts.map((alert) => {
        const tone = TONES[alert.tone];
        return (
          <li key={alert.id} className="flex items-start gap-3 p-4 md:px-5">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                tone.className,
              )}
            >
              <tone.icon className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-body-sm font-semibold text-fg">{alert.title}</p>
              <p className="text-caption text-fg-muted">{alert.description}</p>
              <Link
                to={alert.action.to}
                className="mt-1 w-fit rounded-sm text-body-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                {alert.action.label}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
