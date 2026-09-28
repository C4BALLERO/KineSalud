import {
  type CreateUserInput,
  type CreateUserResult,
  type Role,
  type SetUserActiveInput,
  type UpdateUserInput,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import { collection, orderBy, query, type Timestamp } from 'firebase/firestore';
import { sendPasswordReset } from '@/features/auth/api/authApi';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

export interface UserListItem {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
  professionalId: string | null;
  lastLoginAt: Date | null;
}

/** Lista de usuarios en tiempo real (las reglas solo la permiten al ADMINISTRADOR). */
export function useUsers() {
  return useLiveQuery(
    'users',
    () => query(collection(db, 'users'), orderBy('displayName')),
    (d): UserListItem => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: data.displayName,
        email: data.email,
        role: data.role,
        active: data.active,
        professionalId: data.professionalId ?? null,
        lastLoginAt: (data.lastLoginAt as Timestamp | null)?.toDate() ?? null,
      };
    },
  );
}

/**
 * Crea la cuenta y envía el enlace para que la persona defina su contraseña
 * (el administrador nunca conoce ni asigna contraseñas).
 */
export function useCreateUser() {
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const result = await callFunction<CreateUserInput, CreateUserResult>('users-create', input);
      let accessLinkSent = true;
      try {
        await sendPasswordReset(input.email);
      } catch {
        accessLinkSent = false;
      }
      return { ...result, accessLinkSent };
    },
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: (input: UpdateUserInput) => callFunction<UpdateUserInput>('users-update', input),
  });
}

export function useSetUserActive() {
  return useMutation({
    mutationFn: (input: SetUserActiveInput) =>
      callFunction<SetUserActiveInput>('users-setActive', input),
  });
}

export function useSendAccessLink() {
  return useMutation({ mutationFn: (email: string) => sendPasswordReset(email) });
}
