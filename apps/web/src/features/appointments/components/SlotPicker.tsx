import { timeToMinutes, type Slot } from '@kinesalud/shared';
import { useId } from 'react';
import { cn } from '@/utils/cn';

interface SlotPickerProps {
  slots: Slot[];
  value: { start: string; professionalId: string } | null;
  onChange: (slot: Slot) => void;
  /** Nombre de cada profesional, cuando se ofrecen horarios de varios. */
  professionalName?: (id: string) => string;
  label: string;
}

const PERIODS = [
  { label: 'Mañana', from: 0, to: 13 * 60 },
  { label: 'Tarde', from: 13 * 60, to: 24 * 60 },
];

/**
 * Horarios libres como opciones de radio (teclado con flechas, lector de
 * pantalla anuncia "09:15, 3 de 20"), agrupados en mañana y tarde.
 */
export function SlotPicker({ slots, value, onChange, professionalName, label }: SlotPickerProps) {
  const name = useId();
  const keyOf = (s: { start: string; professionalId: string }) => `${s.start}|${s.professionalId}`;
  const selected = value ? keyOf(value) : null;

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">{label}</legend>
      {PERIODS.map((period) => {
        const list = slots.filter((s) => {
          const m = timeToMinutes(s.start);
          return m >= period.from && m < period.to;
        });
        if (list.length === 0) return null;
        return (
          <div key={period.label} className="flex flex-col gap-2">
            <p className="text-caption font-semibold text-fg-muted">{period.label}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((s) => {
                const key = keyOf(s);
                const checked = key === selected;
                return (
                  <label
                    key={key}
                    className={cn(
                      'relative flex min-h-11 cursor-pointer flex-col justify-center rounded-md border px-3 py-1.5 text-body-sm md:min-h-9',
                      'transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
                      checked
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-strong bg-surface text-fg hover:border-primary hover:bg-primary-subtle',
                    )}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={key}
                      checked={checked}
                      onChange={() => onChange(s)}
                      aria-label={
                        professionalName
                          ? `${s.start}, ${professionalName(s.professionalId)}`
                          : s.start
                      }
                      className="sr-only"
                    />
                    <span className="tabular font-semibold">{s.start}</span>
                    {professionalName && (
                      <span
                        className={cn(
                          'text-caption',
                          checked ? 'text-on-primary/90' : 'text-fg-muted',
                        )}
                      >
                        {professionalName(s.professionalId)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
