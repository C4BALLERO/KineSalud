import { PAIN_SCALE, painLabel } from '@kinesalud/shared';
import { useId } from 'react';
import { cn } from '@/utils/cn';

/**
 * Escala visual analógica del dolor (EVA) de 0 a 10, como opciones de radio:
 * se recorre con las flechas y el lector de pantalla anuncia número y nivel.
 * Es opcional: "Sin registrar" deja el valor vacío.
 */
export function PainScaleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-body-sm font-medium text-fg">
        {label} <span className="font-normal text-fg-subtle">(opcional)</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {PAIN_SCALE.map((n) => {
          const checked = value === n;
          return (
            <label
              key={n}
              className={cn(
                'relative flex size-11 cursor-pointer items-center justify-center rounded-md border text-body-sm font-semibold md:size-9',
                'transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
                checked
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-strong bg-surface text-fg hover:border-primary hover:bg-primary-subtle',
              )}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={checked}
                onChange={() => onChange(n)}
                aria-label={`${n}, ${painLabel(n)}`}
                className="sr-only"
              />
              <span className="tabular">{n}</span>
            </label>
          );
        })}
        <label
          className={cn(
            'relative flex h-11 cursor-pointer items-center rounded-md border px-3 text-body-sm md:h-9',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
            value === null
              ? 'border-primary bg-primary-subtle text-fg'
              : 'border-border-strong bg-surface text-fg-muted hover:border-primary',
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === null}
            onChange={() => onChange(null)}
            className="sr-only"
          />
          Sin registrar
        </label>
      </div>
      <p className="text-caption text-fg-subtle" aria-live="polite">
        {value === null ? '0 = sin dolor · 10 = dolor máximo' : `${value}: ${painLabel(value)}`}
      </p>
    </fieldset>
  );
}
