import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Props que FormField inyecta en el control para asociarlo con label, ayuda y error. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

interface FormFieldProps {
  label: string;
  /** Texto de ayuda permanente bajo el campo. */
  hint?: string;
  /** Mensaje de error; reemplaza visualmente la ayuda y se anuncia. */
  error?: string;
  required?: boolean;
  /** Etiqueta "Opcional" en campos no obligatorios de formularios largos. */
  optional?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Envuelve un control con label visible, ayuda y error correctamente asociados
 * (nunca se depende del placeholder como label).
 */
export function FormField({
  label,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-fg">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className="font-normal text-fg-subtle"> (opcional)</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-caption text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
