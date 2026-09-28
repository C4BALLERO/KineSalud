import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap ' +
  'transition-colors duration-150 ease-standard select-none cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover disabled:hover:bg-primary',
  secondary:
    'bg-surface text-fg border border-border-strong hover:bg-surface-muted active:bg-surface-muted',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg active:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger-hover active:bg-danger-hover',
};

/* Altura mínima 44 px en táctil (sm/md crecen en pantallas pequeñas). */
const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-3 text-body-sm md:h-8',
  md: 'h-11 px-4 text-body-sm md:h-10',
  lg: 'h-12 px-5 text-body',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra un spinner, conserva el ancho y bloquea el doble envío. */
  loading?: boolean;
  /** Icono a la izquierda (componente Lucide ya instanciado). */
  icon?: ReactNode;
  /** Renderiza el hijo (p. ej. un <Link>) con los estilos del botón. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(base, variants[variant], sizes[size]);
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  asChild = false,
  disabled,
  className,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonClasses(variant, size), className);

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
