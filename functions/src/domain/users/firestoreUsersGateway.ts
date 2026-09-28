import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from '../../core/firebase';
import { DomainError } from '../../core/errors';
import type { StoredUser, UsersGateway } from './usersGateway';

const users = () => db.collection('users');

function hasCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === code;
}

/** Implementación real del puerto con el Admin SDK. */
export const firestoreUsersGateway: UsersGateway = {
  async createAuthUser({ email, displayName }) {
    try {
      // Sin contraseña: la persona define la suya con el enlace de restablecimiento.
      const record = await adminAuth.createUser({ email, displayName, emailVerified: false });
      return record.uid;
    } catch (err) {
      if (hasCode(err, 'auth/email-already-exists')) {
        throw new DomainError(
          'already-exists',
          'Ya existe una cuenta con este correo electrónico.',
        );
      }
      throw err;
    }
  },

  async deleteAuthUser(uid) {
    await adminAuth.deleteUser(uid);
  },

  async updateAuthUser(uid, changes) {
    await adminAuth.updateUser(uid, changes);
  },

  async setClaims(uid, claims) {
    await adminAuth.setCustomUserClaims(uid, { ...claims });
  },

  async revokeSessions(uid) {
    await adminAuth.revokeRefreshTokens(uid);
  },

  async getUser(uid) {
    const snap = await users().doc(uid).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return {
      uid,
      displayName: d.displayName,
      email: d.email,
      role: d.role,
      active: d.active,
      professionalId: d.professionalId ?? null,
      claimsVersion: d.claimsVersion ?? 0,
    } satisfies StoredUser;
  },

  async saveUser(user, { isNew }) {
    const data = {
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      active: user.active,
      professionalId: user.professionalId,
      claimsVersion: user.claimsVersion,
      updatedAt: FieldValue.serverTimestamp(),
      ...(isNew ? { createdAt: FieldValue.serverTimestamp(), lastLoginAt: null } : {}),
    };
    await users().doc(user.uid).set(data, { merge: true });
  },

  async countActiveAdmins() {
    const snap = await users()
      .where('role', '==', 'ADMINISTRADOR')
      .where('active', '==', true)
      .count()
      .get();
    return snap.data().count;
  },

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
