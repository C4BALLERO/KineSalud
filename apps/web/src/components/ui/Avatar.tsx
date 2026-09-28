import { cn } from '@/utils/cn';
import { initialsOf } from '@/utils/format';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'size-8 text-overline',
  md: 'size-10 text-body-sm',
  lg: 'size-14 text-h3',
};

/** Avatar de iniciales (el sistema no almacena fotografías de clientes). */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-semibold text-primary ring-1 ring-primary-border',
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
