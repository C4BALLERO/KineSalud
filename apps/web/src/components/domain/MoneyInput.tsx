import type { Ref } from 'react';
import { Input, type InputProps } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

interface MoneyInputProps extends Omit<InputProps, 'type' | 'inputMode' | 'leadingIcon'> {
  ref?: Ref<HTMLInputElement>;
}

/**
 * Monto en bolivianos. Es un campo de texto (no `type="number"`): acepta coma
 * o punto decimal y el teclado numérico del celular. Se interpreta con
 * `parseMoney` de `@kinesalud/shared`.
 */
export function MoneyInput({ className, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      leadingIcon={<span className="text-body-sm font-medium">Bs</span>}
      className={cn('tabular', className)}
    />
  );
}
