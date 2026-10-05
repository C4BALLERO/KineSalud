import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const claims = {
  admin: { role: 'ADMINISTRADOR', active: true, professionalId: null, cv: 1 },
  recep: { role: 'RECEPCIONISTA', active: true, professionalId: null, cv: 1 },
  prof: { role: 'PROFESIONAL', active: true, professionalId: 'prof-diego', cv: 1 },
  inactive: { role: 'RECEPCIONISTA', active: false, professionalId: null, cv: 2 },
};

const db = (uid: string, token: TokenOptions) => env.authenticatedContext(uid, token).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kinesalud-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    for (const [uid, role] of [
      ['admin', 'ADMINISTRADOR'],
      ['recep', 'RECEPCIONISTA'],
      ['prof', 'PROFESIONAL'],
    ] as const) {
      await setDoc(doc(fs, 'users', uid), {
        displayName: uid,
        email: `${uid}@kinesalud.test`,
        role,
        active: true,
        professionalId: null,
        claimsVersion: 1,
        lastLoginAt: null,
      });
    }
    await setDoc(doc(fs, 'auditLogs', 'a1'), { action: 'user.create', at: Timestamp.now() });
  });
});

describe('users', () => {
  it('una persona lee su propia cuenta', async () => {
    await assertSucceeds(getDoc(doc(db('recep', claims.recep), 'users', 'recep')));
  });

  it('la RECEPCIONISTA no lee cuentas ajenas ni lista usuarios', async () => {
    await assertFails(getDoc(doc(db('recep', claims.recep), 'users', 'admin')));
    await assertFails(getDocs(collection(db('recep', claims.recep), 'users')));
  });

  it('el ADMINISTRADOR lista todas las cuentas', async () => {
    await assertSucceeds(getDocs(collection(db('admin', claims.admin), 'users')));
  });

  it('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', 'recep')));
  });

  it('una cuenta desactivada pierde el acceso aunque su token siga vigente', async () => {
    await assertFails(getDoc(doc(db('recep', claims.inactive), 'users', 'recep')));
  });

  it('una persona registra su último acceso', async () => {
    await assertSucceeds(
      updateDoc(doc(db('prof', claims.prof), 'users', 'prof'), { lastLoginAt: serverTimestamp() }),
    );
  });

  it('el último acceso debe ser la hora del servidor (no se puede falsificar)', async () => {
    await assertFails(
      updateDoc(doc(db('prof', claims.prof), 'users', 'prof'), {
        lastLoginAt: Timestamp.fromDate(new Date('2020-01-01')),
      }),
    );
  });

  it('nadie puede cambiar su propio rol ni su vínculo desde la web', async () => {
    await assertFails(
      updateDoc(doc(db('prof', claims.prof), 'users', 'prof'), { role: 'ADMINISTRADOR' }),
    );
    await assertFails(
      updateDoc(doc(db('prof', claims.prof), 'users', 'prof'), {
        lastLoginAt: serverTimestamp(),
        professionalId: 'prof-otro',
      }),
    );
  });

  it('ni siquiera el ADMINISTRADOR escribe usuarios directamente (solo vía Functions)', async () => {
    await assertFails(
      updateDoc(doc(db('admin', claims.admin), 'users', 'recep'), { role: 'ADMINISTRADOR' }),
    );
    await assertFails(
      setDoc(doc(db('admin', claims.admin), 'users', 'nuevo'), {
        role: 'ADMINISTRADOR',
        active: true,
      }),
    );
  });
});

describe('auditLogs', () => {
  it('solo el ADMINISTRADOR lee la auditoría', async () => {
    await assertSucceeds(getDoc(doc(db('admin', claims.admin), 'auditLogs', 'a1')));
    await assertFails(getDoc(doc(db('recep', claims.recep), 'auditLogs', 'a1')));
    await assertFails(getDoc(doc(db('prof', claims.prof), 'auditLogs', 'a1')));
  });

  it('nadie escribe auditoría desde la web', async () => {
    await assertFails(setDoc(doc(db('admin', claims.admin), 'auditLogs', 'x'), { action: 'fake' }));
  });

  it('la pantalla de auditoría consulta por rango de fechas; solo la administración', async () => {
    const byRange = (fs: ReturnType<typeof db>) =>
      getDocs(
        query(
          collection(fs, 'auditLogs'),
          where('at', '>=', Timestamp.fromMillis(Date.now() - 86_400_000)),
          orderBy('at', 'desc'),
          limit(300),
        ),
      );
    await assertSucceeds(byRange(db('admin', claims.admin)));
    await assertFails(byRange(db('recep', claims.recep)));
    await assertFails(deleteDoc(doc(db('admin', claims.admin), 'auditLogs', 'a1')));
  });
});

describe('colecciones no habilitadas', () => {
  it('se deniegan por defecto', async () => {
    await assertFails(getDoc(doc(db('admin', claims.admin), 'clinicalRecords', 'c1')));
    await assertFails(setDoc(doc(db('admin', claims.admin), 'clients', 'c1'), { firstName: 'X' }));
  });
});
