import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { PASSWORD_MIN_LENGTH } from '@kinesalud/shared';
import { FormField } from '@/components/ui/FormField';
import { PasswordInput } from '@/components/ui/PasswordInput';

export interface NewPasswordValues {
  newPassword: string;
  confirmPassword: string;
}

/** Campos "contraseña nueva" + "confirmación", compartidos por restablecer y cambiar. */
export function NewPasswordFields<T extends NewPasswordValues>({
  register,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<NewPasswordValues>;
}) {
  const reg = register as unknown as UseFormRegister<NewPasswordValues>;
  return (
    <>
      <FormField
        label="Contraseña nueva"
        hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con al menos una letra y un número.`}
        error={errors.newPassword?.message}
      >
        {(p) => <PasswordInput {...p} {...reg('newPassword')} autoComplete="new-password" />}
      </FormField>
      <FormField label="Confirmar contraseña nueva" error={errors.confirmPassword?.message}>
        {(p) => <PasswordInput {...p} {...reg('confirmPassword')} autoComplete="new-password" />}
      </FormField>
    </>
  );
}
