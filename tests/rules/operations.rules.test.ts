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
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const claims = {
  admin: { role: 'ADMINISTRADOR', active: true, professionalId: null, cv: 1 },
  recep: { role: 'RECEPCIONISTA', active: true, professionalId: null, cv: 1 },
  diego: { role: 'PROFESIONAL', active: true, professionalId: 'prof-diego', cv: 1 },
  noLink: { role: 'PROFESIONAL', active: true, professionalId: null, cv: 1 },
  inactive: { role: 'RECEPCIONISTA', active: false, professionalId: null, cv: 2 },
} satisfies Record<string, TokenOptions>;

const db = (uid: string, token: TokenOptions) => env.authenticatedContext(uid, token).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kinesalud-rules-ops',
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
    await setDoc(doc(fs, 'professionals', 'prof-diego'), {
      displayName: 'Lic. Diego Pérez',
      active: true,
    });
    await setDoc(doc(fs, 'services', 's1'), { name: 'Fisioterapia lumbar' });
    await setDoc(doc(fs, 'clients', 'c-diego'), {
      firstName: 'Carla',
      assignedProfessionalIds: ['prof-diego'],
      status: 'ACTIVO',
    });
    await setDoc(doc(fs, 'clients', 'c-otro'), {
      firstName: 'Luis',
      assignedProfessionalIds: ['prof-carla'],
      status: 'ACTIVO',
    });
    await setDoc(doc(fs, 'appointments', 'a-diego'), {
      professionalId: 'prof-diego',
      date: '2026-09-28',
    });
    await setDoc(doc(fs, 'appointments', 'a-otro'), {
      professionalId: 'prof-carla',
      date: '2026-09-28',
    });
    await setDoc(doc(fs, 'treatments', 't-diego'), {
      professionalId: 'prof-diego',
      status: 'ACTIVO',
    });
    await setDoc(doc(fs, 'treatments', 't-otro'), {
      professionalId: 'prof-carla',
      status: 'ACTIVO',
    });
  });
});

describe('catálogos', () => {
  it('todo el personal activo lee profesionales y servicios', async () => {
    await assertSucceeds(getDoc(doc(db('d', claims.diego), 'professionals', 'prof-diego')));
    await assertSucceeds(getDocs(collection(db('r', claims.recep), 'services')));
  });

  it('sin sesión o con la cuenta desactivada no se leen', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'services', 's1')));
    await assertFails(getDoc(doc(db('x', claims.inactive), 'services', 's1')));
  });

  it('nadie los modifica desde la web', async () => {
    await assertFails(setDoc(doc(db('a', claims.admin), 'services', 's2'), { name: 'X' }));
    await assertFails(
      setDoc(doc(db('a', claims.admin), 'professionals', 'prof-diego'), { active: false }),
    );
    await assertFails(setDoc(doc(db('a', claims.admin), 'settings', 'clinic'), { name: 'X' }));
  });

  it('las ausencias del personal se leen para la agenda, pero solo las escribe el servidor', async () => {
    const upcoming = query(
      collection(db('r', claims.recep), 'professionalExceptions'),
      where('dateTo', '>=', '2026-09-28'),
    );
    await assertSucceeds(getDocs(upcoming));
    await assertSucceeds(getDocs(collection(db('d', claims.diego), 'professionalExceptions')));
    await assertFails(getDocs(collection(db('x', claims.inactive), 'professionalExceptions')));
    await assertFails(
      setDoc(doc(db('a', claims.admin), 'professionalExceptions', 'e1'), {
        professionalId: 'prof-diego',
      }),
    );
  });
});

describe('citas', () => {
  it('administración y recepción leen todas las citas del día', async () => {
    const q = query(
      collection(db('r', claims.recep), 'appointments'),
      where('date', '==', '2026-09-28'),
    );
    await assertSucceeds(getDocs(q));
    await assertSucceeds(getDoc(doc(db('a', claims.admin), 'appointments', 'a-otro')));
  });

  it('el PROFESIONAL solo lee sus propias citas', async () => {
    const mine = query(
      collection(db('d', claims.diego), 'appointments'),
      where('professionalId', '==', 'prof-diego'),
    );
    await assertSucceeds(getDocs(mine));
    await assertFails(getDoc(doc(db('d', claims.diego), 'appointments', 'a-otro')));
  });

  it('el PROFESIONAL no puede listar las citas de todo el consultorio', async () => {
    const all = query(
      collection(db('d', claims.diego), 'appointments'),
      where('date', '==', '2026-09-28'),
    );
    await assertFails(getDocs(all));
  });

  it('un PROFESIONAL sin ficha vinculada no ve citas', async () => {
    await assertFails(getDoc(doc(db('n', claims.noLink), 'appointments', 'a-diego')));
  });

  it('nadie escribe citas directamente (solo vía Functions)', async () => {
    await assertFails(
      setDoc(doc(db('a', claims.admin), 'appointments', 'nueva'), { professionalId: 'prof-diego' }),
    );
  });
});

describe('clientes y tratamientos', () => {
  it('el PROFESIONAL solo lee los clientes asignados', async () => {
    await assertSucceeds(getDoc(doc(db('d', claims.diego), 'clients', 'c-diego')));
    await assertFails(getDoc(doc(db('d', claims.diego), 'clients', 'c-otro')));
    const mine = query(
      collection(db('d', claims.diego), 'clients'),
      where('assignedProfessionalIds', 'array-contains', 'prof-diego'),
    );
    await assertSucceeds(getCountFromServer(mine));
  });

  it('recepción cuenta todos los clientes activos', async () => {
    const q = query(collection(db('r', claims.recep), 'clients'), where('status', '==', 'ACTIVO'));
    await assertSucceeds(getCountFromServer(q));
  });

  it('nadie escribe clientes directamente: CI único y auditoría pasan por Functions', async () => {
    await assertFails(
      setDoc(doc(db('r', claims.recep), 'clients', 'nuevo'), { firstName: 'X', status: 'ACTIVO' }),
    );
    await assertFails(
      setDoc(
        doc(db('a', claims.admin), 'clients', 'c-otro'),
        { status: 'INACTIVO' },
        { merge: true },
      ),
    );
  });

  it('el índice de carnets es privado del servidor', async () => {
    await assertFails(getDoc(doc(db('a', claims.admin), 'clientCiIndex', '3400000')));
    await assertFails(
      setDoc(doc(db('r', claims.recep), 'clientCiIndex', '3400000'), { clientId: 'x' }),
    );
  });

  it('el PROFESIONAL solo lee sus tratamientos', async () => {
    await assertSucceeds(getDoc(doc(db('d', claims.diego), 'treatments', 't-diego')));
    await assertFails(getDoc(doc(db('d', claims.diego), 'treatments', 't-otro')));
  });
});
