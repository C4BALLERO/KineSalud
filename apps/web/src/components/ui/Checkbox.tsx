import { Checkbox as RadixCheckbox, Switch as RadixSwitch } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CheckboxProps {
  label: ReactNode;
  description?: string;
  checked?: boolean | 'indeterminate';
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  name,
  className,
}: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <RadixCheckbox.Root
        id={id}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        aria-describedby={description ? `${id}-desc` : undefined}
        className={cn(
          'peer mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px]',
          'border border-border-control bg-surface transition-colors duration-150',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-on-primary',
          'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-on-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator>
          {checked === 'indeterminate' ? (
            <Minus aria-hidden="true" className="size-3.5" strokeWidth={3} />
          ) : (
            <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <div className="flex flex-col">
        <label
          htmlFor={id}
          className="cursor-pointer text-body-sm text-fg peer-disabled:cursor-not-allowed"
        >
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-caption text-fg-subtle">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

interface SwitchProps {
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Interruptor para estados on/off con efecto inmediato (p. ej. activar profesional). */
export function Switch({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex flex-col">
        <label htmlFor={id} className="cursor-pointer text-body-sm font-medium text-fg">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-caption text-fg-subtle">
            {description}
          </p>
        )}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={description ? `${id}-desc` : undefined}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
          'border border-border-control bg-surface-muted transition-colors duration-150',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block size-4.5 translate-x-0.5 rounded-full bg-white shadow-sm ring-1 ring-border-control',
            'transition-transform duration-150 ease-standard data-[state=checked]:translate-x-5.5 data-[state=checked]:ring-0',
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}
