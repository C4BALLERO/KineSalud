import { newPasswordSchema } from '@kinesalud/shared';
import { z } from 'zod';

/** Contraseña nueva + confirmación (restablecer y cambiar contraseña). */
export const newPasswordFormSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirma la contraseña nueva.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirma la contraseña nueva.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'La contraseña nueva debe ser distinta de la actual.',
  });
