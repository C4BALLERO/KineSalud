import {
  createUserInputSchema,
  setUserActiveInputSchema,
  updateUserInputSchema,
  type AuthClaims,
  type CreateUserResult,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requirePermission } from '../../core/guards';
import { auditActor } from '../audit';
import type { StoredUser, UsersGateway } from './usersGateway';

function claimsOf(user: StoredUser): AuthClaims {
  return {
    role: user.role,
    active: user.active,
    professionalId: user.professionalId,
    cv: user.claimsVersion,
  };
}

async function loadUser(gateway: UsersGateway, uid: string): Promise<StoredUser> {
  const user = await gateway.getUser(uid);
  if (!user) throw new DomainError('not-found', 'El usuario no existe.');
  return user;
}

/** Impide dejar el sistema sin ningún administrador activo. */
async function assertNotLastAdmin(gateway: UsersGateway, user: StoredUser): Promise<void> {
  if (user.role === 'ADMINISTRADOR' && user.active && (await gateway.countActiveAdmins()) <= 1) {
    throw new DomainError(
      'failed-precondition',
      'Debe existir al menos un administrador activo. Asigna otro administrador antes de hacer este cambio.',
    );
  }
}

export async function createUser(
  gateway: UsersGateway,
  actor: Actor,
  data: unknown,
): Promise<CreateUserResult> {
  requirePermission(actor, 'users.manage');
  const input = parseInput(createUserInputSchema, data);

  const uid = await gateway.createAuthUser({ email: input.email, displayName: input.displayName });
  const user: StoredUser = { uid, ...input, active: true, claimsVersion: 1 };

  try {
    await gateway.setClaims(uid, claimsOf(user));
    await gateway.saveUser(user, { isNew: true });
  } catch (err) {
    // Sin claims ni perfil la cuenta quedaría inutilizable: se revierte.
    await gateway.deleteAuthUser(uid);
    throw err;
  }

  await gateway.audit({
    actor: auditActor(actor),
    action: 'user.create',
    entity: 'users',
    entityId: uid,
    meta: { role: user.role },
  });
  return { uid };
}

export async function updateUser(
  gateway: UsersGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'users.manage');
  const input = parseInput(updateUserInputSchema, data);
  const current = await loadUser(gateway, input.uid);

  const roleChanged = current.role !== input.role;
  if (roleChanged) {
    if (input.uid === actor.uid) {
      throw new DomainError('failed-precondition', 'No puedes cambiar tu propio rol.');
    }
    await assertNotLastAdmin(gateway, current);
  }

  const claimsChanged = roleChanged || current.professionalId !== input.professionalId;
  const updated: StoredUser = {
    ...current,
    displayName: input.displayName,
    role: input.role,
    professionalId: input.professionalId,
    claimsVersion: claimsChanged ? current.claimsVersion + 1 : current.claimsVersion,
  };

  if (current.displayName !== updated.displayName) {
    await gateway.updateAuthUser(updated.uid, { displayName: updated.displayName });
  }
  if (claimsChanged) await gateway.setClaims(updated.uid, claimsOf(updated));
  await gateway.saveUser(updated, { isNew: false });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'user.update',
    entity: 'users',
    entityId: updated.uid,
    meta: roleChanged ? { from: current.role, to: updated.role } : undefined,
  });
}

export async function setUserActive(
  gateway: UsersGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'users.manage');
  const input = parseInput(setUserActiveInputSchema, data);
  const current = await loadUser(gateway, input.uid);
  if (current.active === input.active) return;

  if (!input.active) {
    if (input.uid === actor.uid) {
      throw new DomainError('failed-precondition', 'No puedes desactivar tu propia cuenta.');
    }
    await assertNotLastAdmin(gateway, current);
  }

  const updated: StoredUser = {
    ...current,
    active: input.active,
    claimsVersion: current.claimsVersion + 1,
  };

  await gateway.updateAuthUser(updated.uid, { disabled: !updated.active });
  await gateway.setClaims(updated.uid, claimsOf(updated));
  // Invalida los tokens vigentes para que la desactivación sea inmediata.
  if (!updated.active) await gateway.revokeSessions(updated.uid);
  await gateway.saveUser(updated, { isNew: false });

  await gateway.audit({
    actor: auditActor(actor),
    action: updated.active ? 'user.activate' : 'user.deactivate',
    entity: 'users',
    entityId: updated.uid,
  });
}
