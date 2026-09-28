import logoCompleto from '@/assets/brand/logo-completo.png';
import logoIcono from '@/assets/brand/logo-icono.png';
import { cn } from '@/utils/cn';

/**
 * Símbolo oficial de Kinesalud y Vida: figura en movimiento sobre una mano
 * que sostiene, con la columna vertebral como arco. PNG con transparencia.
 */
export function LogoSymbol({ className, title }: { className?: string; title?: string }) {
  return (
    <img
      src={logoIcono}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={256}
      height={251}
      decoding="async"
      className={cn('size-8 shrink-0 object-contain', className)}
    />
  );
}

interface LogoProps {
  /**
   * - `full`: símbolo + nombre tipográfico (sidebar, barras). Legible en tamaños pequeños.
   * - `symbol`: solo el símbolo (riel colapsado, pantallas de carga).
   * - `brand`: logo oficial completo con su tipografía (login, pantallas de marca).
   */
  variant?: 'full' | 'symbol' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const symbolSizes = { sm: 'size-7', md: 'size-8', lg: 'size-11' };
const wordSizes = { sm: 'text-body', md: 'text-h3', lg: 'text-h1' };
const brandHeights = { sm: 'h-12', md: 'h-16', lg: 'h-24' };

export function Logo({ variant = 'full', size = 'md', className }: LogoProps) {
  if (variant === 'symbol') {
    return <LogoSymbol className={cn(symbolSizes[size], className)} title="Kinesalud y Vida" />;
  }
  if (variant === 'brand') {
    return (
      <img
        src={logoCompleto}
        alt="Kinesalud y Vida"
        width={960}
        height={382}
        decoding="async"
        className={cn('w-auto object-contain', brandHeights[size], className)}
      />
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoSymbol className={symbolSizes[size]} />
      <span
        className={cn(
          'inline-flex items-baseline gap-[0.3em] leading-none tracking-tight whitespace-nowrap',
          wordSizes[size],
        )}
      >
        <span className="font-bold text-primary">Kinesalud</span>{' '}
        <span className="font-medium text-secondary">y Vida</span>
      </span>
    </span>
  );
}
