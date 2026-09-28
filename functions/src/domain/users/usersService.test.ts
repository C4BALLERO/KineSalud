import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthClaims } from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type { StoredUser, UsersGateway } from './usersGateway';
import { createUser, setUserActive, updateUser } from './usersService';

class InMemoryUsersGateway implements UsersGateway {
  users = new Map<string, StoredUser>();
  claims = new Map<string, AuthClaims>();
  disabled = new Set<string>();
  revoked: string[] = [];
  audits: AuditEntry[] = [];
  deleted: string[] = [];
  failSaveOnce = false;
  private seq = 0;

  async createAuthUser({ email }: { email: string }) {
    if ([...this.users.values()].some((u) => u.email === email)) {
      throw new DomainError('already-exists', 'Ya existe una cuenta con este correo electrónico.');
    }
    return `uid-${++this.seq}`;
  }
  async deleteAuthUser(uid: string) {
    this.deleted.push(uid);
  }
  async updateAuthUser(uid: string, changes: { disabled?: boolean }) {
    if (changes.disabled === true) this.disabled.add(uid);
    if (changes.disabled === false) this.disabled.delete(uid);
  }
  async setClaims(uid: string, claims: AuthClaims) {
    this.claims.set(uid, claims);
  }
  async revokeSessions(uid: string) {
    this.revoked.push(uid);
  }
  async getUser(uid: string) {
    return this.users.get(uid) ?? null;
  }
  async saveUser(user: StoredUser) {
    if (this.failSaveOnce) {
      this.failSaveOnce = false;
      throw new Error('firestore caído');
    }
    this.users.set(user.uid, { ...user });
  }
  async countActiveAdmins() {
    return [...this.users.values()].filter((u) => u.role === 'ADMINISTRADOR' && u.active).length;
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

const admin: Actor = { type: 'USER', uid: 'admin-1', role: 'ADMINISTRADOR', channel: 'web' };
const receptionist: Actor = { type: 'USER', uid: 'recep-1', role: 'RECEPCIONISTA', channel: 'web' };

function seedAdmin(gw: InMemoryUsersGateway) {
  gw.users.set('admin-1', {
    uid: 'admin-1',
    displayName: 'Ana Gutiérrez',
    email: 'admin@kinesalud.test',
    role: 'ADMINISTRADOR',
    active: true,
    professionalId: null,
    claimsVersion: 1,
  });
}

async function expectDomainError(promise: Promise<unknown>, code: DomainError['code']) {
  await expect(promise).rejects.toMatchObject({ name: 'DomainError', code });
}

describe('usersService', () => {
  let gw: InMemoryUsersGateway;
  beforeEach(() => {
    gw = new InMemoryUsersGateway();
    seedAdmin(gw);
  });

  describe('createUser', () => {
    it('crea la cuenta con claims, perfil y auditoría', async () => {
      const { uid } = await createUser(gw, admin, {
        displayName: 'Lucía Mendoza',
        email: 'Recepcion@KineSalud.test',
        role: 'RECEPCIONISTA',
      });
      expect(gw.users.get(uid)).toMatchObject({ email: 'recepcion@kinesalud.test', active: true });
      expect(gw.claims.get(uid)).toEqual({
        role: 'RECEPCIONISTA',
        active: true,
        professionalId: null,
        cv: 1,
      });
      expect(gw.audits.at(-1)).toMatchObject({ action: 'user.create', entityId: uid });
    });

    it('solo el ADMINISTRADOR puede crear usuarios', async () => {
      await expectDomainError(
        createUser(gw, receptionist, {
          displayName: 'X Y Z',
          email: 'x@y.co',
          role: 'PROFESIONAL',
        }),
        'permission-denied',
      );
    });

    it('valida la entrada con los esquemas compartidos', async () => {
      await expectDomainError(
        createUser(gw, admin, { displayName: 'Al', email: 'no-es-correo', role: 'PROFESIONAL' }),
        'invalid-argument',
      );
    });

    it('rechaza correos duplicados', async () => {
      await expectDomainError(
        createUser(gw, admin, {
          displayName: 'Otra Ana',
          email: 'admin@kinesalud.test',
          role: 'PROFESIONAL',
        }),
        'already-exists',
      );
    });

    it('revierte la cuenta de Auth si falla el guardado del perfil', async () => {
      gw.failSaveOnce = true;
      await expect(
        createUser(gw, admin, {
          displayName: 'Diego Pérez',
          email: 'd@k.test',
          role: 'PROFESIONAL',
        }),
      ).rejects.toThrow('firestore caído');
      expect(gw.deleted).toHaveLength(1);
    });
  });

  describe('updateUser', () => {
    it('incrementa la versión de claims al cambiar el rol', async () => {
      const { uid } = await createUser(gw, admin, {
        displayName: 'Diego Pérez',
        email: 'd@k.test',
        role: 'RECEPCIONISTA',
      });
      await updateUser(gw, admin, {
        uid,
        displayName: 'Diego Pérez',
        role: 'PROFESIONAL',
        professionalId: 'prof-diego',
      });
      expect(gw.claims.get(uid)).toEqual({
        role: 'PROFESIONAL',
        active: true,
        professionalId: 'prof-diego',
        cv: 2,
      });
    });

    it('no incrementa la versión de claims si solo cambia el nombre', async () => {
      const { uid } = await createUser(gw, admin, {
        displayName: 'Diego Perez',
        email: 'd@k.test',
        role: 'PROFESIONAL',
      });
      await updateUser(gw, admin, { uid, displayName: 'Diego Pérez', role: 'PROFESIONAL' });
      expect(gw.users.get(uid)?.claimsVersion).toBe(1);
      expect(gw.users.get(uid)?.displayName).toBe('Diego Pérez');
    });

    it('impide que el administrador cambie su propio rol', async () => {
      await expectDomainError(
        updateUser(gw, admin, {
          uid: 'admin-1',
          displayName: 'Ana Gutiérrez',
          role: 'RECEPCIONISTA',
        }),
        'failed-precondition',
      );
    });

    it('impide quitar el rol al último administrador activo', async () => {
      const otherAdmin: Actor = { ...admin, uid: 'admin-2' };
      await expectDomainError(
        updateUser(gw, otherAdmin, {
          uid: 'admin-1',
          displayName: 'Ana Gutiérrez',
          role: 'PROFESIONAL',
        }),
        'failed-precondition',
      );
    });

    it('responde not-found si el usuario no existe', async () => {
      await expectDomainError(
        updateUser(gw, admin, { uid: 'nadie', displayName: 'Nadie Nunca', role: 'PROFESIONAL' }),
        'not-found',
      );
    });
  });

  describe('setUserActive', () => {
    it('desactiva: deshabilita en Auth, revoca sesiones y actualiza claims', async () => {
      const { uid } = await createUser(gw, admin, {
        displayName: 'Lucía Mendoza',
        email: 'l@k.test',
        role: 'RECEPCIONISTA',
      });
      await setUserActive(gw, admin, { uid, active: false });
      expect(gw.disabled.has(uid)).toBe(true);
      expect(gw.revoked).toContain(uid);
      expect(gw.claims.get(uid)).toMatchObject({ active: false, cv: 2 });
      expect(gw.audits.at(-1)?.action).toBe('user.deactivate');
    });

    it('reactiva una cuenta', async () => {
      const { uid } = await createUser(gw, admin, {
        displayName: 'Lucía Mendoza',
        email: 'l@k.test',
        role: 'RECEPCIONISTA',
      });
      await setUserActive(gw, admin, { uid, active: false });
      await setUserActive(gw, admin, { uid, active: true });
      expect(gw.disabled.has(uid)).toBe(false);
      expect(gw.users.get(uid)?.active).toBe(true);
    });

    it('impide desactivar la propia cuenta', async () => {
      await expectDomainError(
        setUserActive(gw, admin, { uid: 'admin-1', active: false }),
        'failed-precondition',
      );
    });
  });
});
