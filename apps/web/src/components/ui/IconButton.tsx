import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/utils/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Nombre accesible obligatorio; también se muestra como tooltip. */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'secondary';
  /** Oculta el tooltip (p. ej. cuando el texto ya es visible junto al botón). */
  hideTooltip?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  hideTooltip = false,
  className,
  type,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type ?? 'button'}
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md md:size-9',
        'kv-press duration-150 ease-standard [&_svg]:size-5',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'ghost' && 'text-fg-muted hover:bg-surface-muted hover:text-fg',
        variant === 'secondary' &&
          'border border-border-strong bg-surface text-fg hover:bg-surface-muted',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );

  return hideTooltip ? button : <Tooltip content={label}>{button}</Tooltip>;
}
