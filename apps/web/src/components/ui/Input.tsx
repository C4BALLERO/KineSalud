import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Estilo compartido por todos los controles de texto. */
export const controlClasses =
  'w-full rounded-md border border-border-control bg-surface text-body-sm text-fg ' +
  'placeholder:text-fg-subtle transition-colors duration-150 ease-standard ' +
  'hover:border-fg-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted disabled:hover:border-border-control ' +
  'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger';

/** Solo para campos de texto: en CSS, `:read-only` también coincide siempre con <select>. */
const readOnlyClasses = 'read-only:bg-surface-muted';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icono decorativo a la izquierda (p. ej. búsqueda). */
  leadingIcon?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, leadingIcon, ...props }: InputProps) {
  if (!leadingIcon) {
    return (
      <input
        className={cn(controlClasses, readOnlyClasses, 'h-11 px-3 md:h-10', className)}
        {...props}
      />
    );
  }
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle [&_svg]:size-4"
      >
        {leadingIcon}
      </span>
      <input
        className={cn(controlClasses, readOnlyClasses, 'h-11 pr-3 pl-9 md:h-10', className)}
        {...props}
      />
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        controlClasses,
        readOnlyClasses,
        'min-h-24 resize-y px-3 py-2 leading-6',
        className,
      )}
      {...props}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
}

/**
 * Select nativo estilizado: en móvil abre el selector del sistema operativo,
 * que es la experiencia más accesible para listas cortas.
 */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlClasses,
          'h-11 cursor-pointer appearance-none pr-9 pl-3 md:h-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}
