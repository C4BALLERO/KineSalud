import { z } from 'zod';
import { ROLES, type Role } from './enums';

/**
 * Custom claims del token de Firebase Auth. Solo los asigna Cloud Functions.
 * `cv` (claims version) permite a la web detectar que sus claims cambiaron y
 * refrescar el token sin esperar a que expire.
 */
export interface AuthClaims {
  role: Role;
  active: boolean;
  professionalId: string | null;
  cv: number;
}

/** Documento `users/{uid}`: espejo legible de la cuenta y sus claims. */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
  professionalId: string | null;
  claimsVersion: number;
}

export const PASSWORD_MIN_LENGTH = 8;

export const displayNameSchema = z
  .string({ error: 'Ingresa el nombre completo.' })
  .trim()
  .min(1, 'Ingresa el nombre completo.')
  .min(3, 'El nombre debe tener al menos 3 caracteres.')
  .max(80, 'El nombre no puede superar 80 caracteres.');

export const emailSchema = z
  .string({ error: 'Ingresa un correo electrónico.' })
  .trim()
  .toLowerCase()
  .min(1, 'Ingresa un correo electrónico.')
  .pipe(z.email('Ingresa un correo electrónico válido.'));

export const roleSchema = z.enum(ROLES, { error: 'Selecciona un rol.' });

/** Contraseña nueva: mínimo 8 caracteres con al menos una letra y un número. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(128, 'La contraseña es demasiado larga.')
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Incluye al menos una letra.')
  .regex(/\d/, 'Incluye al menos un número.');

const uidSchema = z.string().trim().min(1, 'Usuario no válido.').max(128);
const professionalIdSchema = z.string().trim().min(1).max(128).nullable();

export const createUserInputSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: roleSchema,
  professionalId: professionalIdSchema.default(null),
});
export type CreateUserInput = z.input<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  uid: uidSchema,
  displayName: displayNameSchema,
  role: roleSchema,
  professionalId: professionalIdSchema.default(null),
});
export type UpdateUserInput = z.input<typeof updateUserInputSchema>;

export const setUserActiveInputSchema = z.object({
  uid: uidSchema,
  active: z.boolean(),
});
export type SetUserActiveInput = z.input<typeof setUserActiveInputSchema>;

export interface CreateUserResult {
  uid: string;
}

/** Descripción de cada rol para ayudar al administrador a elegir. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMINISTRADOR: 'Acceso completo: usuarios, configuración, personal, reportes e historia clínica.',
  RECEPCIONISTA:
    'Clientes, agenda, confirmaciones y recordatorios. Sin acceso a información clínica.',
  PROFESIONAL:
    'Agenda sus citas, registra a sus pacientes, elige los servicios que ofrece y lleva el registro clínico de las sesiones que atiende.',
};
