import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

/**
 * Grupo de casillas con título, ayuda y error asociados por ARIA (p. ej. las
 * áreas de atención o los tipos de espacio de un servicio).
 */
export function CheckboxGroup({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={className}
    >
      <p id={`${id}-label`} className="mb-2 text-body-sm font-medium text-fg">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </p>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-caption text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-2 text-caption text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
