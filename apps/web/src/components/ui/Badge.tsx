import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-subtle text-neutral border-neutral-border',
  primary: 'bg-primary-subtle text-primary border-primary-border',
  success: 'bg-success-subtle text-success border-success-border',
  warning: 'bg-warning-subtle text-warning border-warning-border',
  danger: 'bg-danger-subtle text-danger border-danger-border',
  info: 'bg-info-subtle text-info border-info-border',
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Icono que acompaña al texto: el estado nunca depende solo del color. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-caption font-medium whitespace-nowrap',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
