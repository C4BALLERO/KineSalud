import { RadioGroup } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface RadioCardGroupProps<T extends string> {
  label: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: RadioCardOption<T>[];
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Opciones excluyentes con descripción (p. ej. elegir un rol). Más claro que
 * un select cuando cada opción necesita explicar sus consecuencias.
 */
export function RadioCardGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  disabled,
  required,
}: RadioCardGroupProps<T>) {
  const id = useId();
  const messageId = error || hint ? `${id}-msg` : undefined;

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-body-sm font-medium text-fg">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
      <RadioGroup.Root
        value={value}
        onValueChange={(v) => onChange(v as T)}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        aria-required={required}
        className="flex flex-col gap-2"
      >
        {options.map((o) => (
          <RadioGroup.Item
            key={o.value}
            value={o.value}
            className={cn(
              'group flex w-full cursor-pointer items-start gap-3 rounded-md border bg-surface p-3 text-left transition-colors duration-150',
              'border-border-strong hover:border-fg-subtle',
              'data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle',
              'disabled:cursor-not-allowed disabled:opacity-60',
              error && 'border-danger',
            )}
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border-control bg-surface group-data-[state=checked]:border-primary"
            >
              <RadioGroup.Indicator className="size-2.5 rounded-full bg-primary" />
            </span>
            {o.icon && (
              <span
                aria-hidden="true"
                className="mt-0.5 text-fg-muted group-data-[state=checked]:text-primary [&_svg]:size-4.5"
              >
                {o.icon}
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body-sm font-semibold text-fg">{o.label}</span>
              {o.description && <span className="text-caption text-fg-muted">{o.description}</span>}
            </span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {error ? (
        <p id={messageId} className="text-caption text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-caption text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
