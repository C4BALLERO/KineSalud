import { LoaderCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SpinnerProps {
  className?: string;
  /** Texto para lectores de pantalla. Si se omite, el spinner es decorativo. */
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex">
      <LoaderCircle
        aria-hidden="true"
        className={cn('size-4 animate-spin motion-reduce:animate-none', className)}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
