import { cn } from '@/utils/cn';

/**
 * Símbolo de Kinesalud y Vida: una figura humana en movimiento que forma una
 * "K": el cuerpo (trazo vertical curvo), el brazo que se eleva (recuperación)
 * y la pierna que avanza (movimiento). La cabeza en tono arcilla aporta la
 * calidez de "Vida". El teal coincide con el token --color-primary.
 */
export function LogoSymbol({
  className,
  title,
  inverse = false,
}: {
  className?: string;
  title?: string;
  /** Versión para fondos de color primario: fondo blanco y trazos teal. */
  inverse?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="9" fill={inverse ? '#FFFFFF' : '#0F766E'} />
      <g
        fill="none"
        stroke={inverse ? '#0F766E' : '#FFFFFF'}
        strokeWidth="3.1"
        strokeLinecap="round"
      >
        <path d="M11.5 25.5C11.5 20 12.2 15.5 14 11.5" />
        <path d="M13 16.6C16.5 15.4 19.5 12.8 21.8 9.2" />
        <path d="M12.8 18.6L20.5 24.8" />
      </g>
      <circle cx="15.8" cy="6.8" r="2.7" fill={inverse ? '#B34A33' : '#F9C9B8'} />
    </svg>
  );
}

interface LogoProps {
  /** `full`: símbolo + nombre. `symbol`: solo símbolo (riel, favicon). */
  variant?: 'full' | 'symbol';
  size?: 'sm' | 'md' | 'lg';
  /** Para fondos de color primario (panel de marca del login). */
  inverse?: boolean;
  className?: string;
}

const symbolSizes = { sm: 'size-7', md: 'size-8', lg: 'size-11' };
const wordSizes = { sm: 'text-body', md: 'text-h3', lg: 'text-h1' };

export function Logo({ variant = 'full', size = 'md', inverse = false, className }: LogoProps) {
  if (variant === 'symbol') {
    return (
      <LogoSymbol
        className={cn(symbolSizes[size], className)}
        title="Kinesalud y Vida"
        inverse={inverse}
      />
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoSymbol className={symbolSizes[size]} inverse={inverse} />
      <span
        className={cn(
          'inline-flex items-baseline gap-[0.3em] leading-none tracking-tight whitespace-nowrap',
          wordSizes[size],
        )}
      >
        <span className={cn('font-bold', inverse ? 'text-white' : 'text-fg')}>Kinesalud</span>{' '}
        <span className={cn('font-medium', inverse ? 'text-white' : 'text-secondary')}>y Vida</span>
      </span>
    </span>
  );
}
