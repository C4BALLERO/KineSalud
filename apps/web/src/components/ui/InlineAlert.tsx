import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-info-subtle border-info-border',
    icon: <Info aria-hidden="true" className="text-info" />,
  },
  success: {
    box: 'bg-success-subtle border-success-border',
    icon: <CircleCheck aria-hidden="true" className="text-success" />,
  },
  warning: {
    box: 'bg-warning-subtle border-warning-border',
    icon: <TriangleAlert aria-hidden="true" className="text-warning" />,
  },
  danger: {
    box: 'bg-danger-subtle border-danger-border',
    icon: <CircleAlert aria-hidden="true" className="text-danger" />,
  },
};

interface InlineAlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Mensaje contextual dentro de la página (no desaparece solo). */
export function InlineAlert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: InlineAlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      data-icon-entrance=""
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 [&>svg]:mt-0.5 [&>svg]:size-4.5 [&>svg]:shrink-0',
        tones[tone].box,
        className,
      )}
    >
      {tones[tone].icon}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-sm">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className="text-fg-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
