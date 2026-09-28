import {
  canAccessRecord,
  hasPermission,
  permissionScope,
  ROLES,
  type Permission,
  type Role,
} from '@kinesalud/shared';
import type { z } from 'zod';
import type { Actor } from './actor';
import { DomainError } from './errors';

/** Subconjunto del token decodificado que necesitamos. */
export interface TokenLike {
  uid: string;
  token: Record<string, unknown>;
}

/**
 * Construye el Actor a partir del token verificado por Firebase. Rechaza
 * sesiones sin rol asignado o de cuentas desactivadas.
 */
export function actorFromAuth(auth: TokenLike | undefined, channel = 'web'): Actor {
  if (!auth) throw new DomainError('unauthenticated', 'Tu sesión expiró. Vuelve a iniciar sesión.');
  const { role, active, professionalId, name } = auth.token;
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
    throw new DomainError('permission-denied', 'Tu cuenta no tiene un rol asignado.');
  }
  if (active !== true) {
    throw new DomainError('permission-denied', 'Tu cuenta está desactivada.');
  }
  return {
    type: 'USER',
    uid: auth.uid,
    role: role as Role,
    professionalId: typeof professionalId === 'string' ? professionalId : null,
    name: typeof name === 'string' ? name : null,
    channel,
  };
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (
    !actor.role ||
    !hasPermission({ role: actor.role, professionalId: actor.professionalId }, permission)
  ) {
    throw new DomainError('permission-denied', 'No tienes permiso para realizar esta acción.');
  }
}

const DENIED = 'No tienes permiso para realizar esta acción.';

/** Exige el permiso con alcance sobre todo el consultorio (no solo lo propio). */
export function requireClinicWide(actor: Actor, permission: Permission, message = DENIED): void {
  if (
    !actor.role ||
    permissionScope({ role: actor.role, professionalId: actor.professionalId }, permission) !==
      'all'
  ) {
    throw new DomainError('permission-denied', message);
  }
}

/** Exige el permiso sobre un registro concreto (con alcance propio, debe ser del profesional). */
export function requireRecordAccess(
  actor: Actor,
  permission: Permission,
  professionalIds: readonly string[],
): void {
  if (
    !actor.role ||
    !canAccessRecord(
      { role: actor.role, professionalId: actor.professionalId },
      permission,
      professionalIds,
    )
  ) {
    throw new DomainError('permission-denied', DENIED);
  }
}

/** Valida la entrada con el esquema compartido; devuelve el primer error legible. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new DomainError(
      'invalid-argument',
      issue?.message ?? 'Los datos enviados no son válidos.',
      {
        field: issue?.path.join('.'),
      },
    );
  }
  return result.data;
}
