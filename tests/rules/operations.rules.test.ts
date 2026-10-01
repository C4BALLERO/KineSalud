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
  serverTimestamp,
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
    await setDoc(doc(fs, 'payments', 'p-diego'), {
      professionalId: 'prof-diego',
      date: '2026-09-28',
      amountCents: 15000,
    });
    await setDoc(doc(fs, 'payments', 'p-otro'), {
      professionalId: 'prof-carla',
      date: '2026-09-28',
      amountCents: 9000,
    });
    await setDoc(doc(fs, 'cashSessions', 'caja-1'), { status: 'ABIERTA', openingCents: 0 });
    await setDoc(doc(fs, 'cashRegister', 'main'), { openSessionId: 'caja-1' });
    await setDoc(doc(fs, 'incomeStats', '2026-09'), { totalCents: 24000 });
    await setDoc(doc(fs, 'dailyStats', '2026-09-28'), { date: '2026-09-28', cells: {} });
    await setDoc(doc(fs, 'dailyIncome', '2026-09-28'), { date: '2026-09-28', totalCents: 0 });
    await setDoc(doc(fs, 'clinicalRecords', 'c-diego'), { alerts: 'Alergia al látex' });
    await setDoc(doc(fs, 'reminders', 'a-diego'), { status: 'ENVIADO', clientName: 'Carla' });
    await setDoc(doc(fs, 'notifications', 'n-recep'), { userId: 'r', title: 'x', read: false });
    await setDoc(doc(fs, 'clinicalRecords', 'c-diego', 'sessionNotes', 'a-diego'), {
      professionalId: 'prof-diego',
      observations: 'x',
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

  it('el historial de la cita lo ve quien puede ver la cita, y nadie lo modifica', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      // Evento anterior a una reprogramación: era de otro profesional.
      await setDoc(doc(fs, 'appointments', 'a-diego', 'events', 'e1'), {
        type: 'CREADA',
        professionalId: 'prof-carla',
      });
      await setDoc(doc(fs, 'appointments', 'a-otro', 'events', 'e1'), { type: 'CREADA' });
    });
    await assertSucceeds(
      getDocs(collection(db('d', claims.diego), 'appointments', 'a-diego', 'events')),
    );
    await assertFails(
      getDocs(collection(db('d', claims.diego), 'appointments', 'a-otro', 'events')),
    );
    await assertSucceeds(
      getDocs(collection(db('r', claims.recep), 'appointments', 'a-otro', 'events')),
    );
    await assertFails(
      setDoc(doc(db('a', claims.admin), 'appointments', 'a-diego', 'events', 'e2'), { type: 'X' }),
    );
    await assertFails(getDoc(doc(db('a', claims.admin), 'scheduleLocks', '2026-09-28')));
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

  it('el PROFESIONAL ve las sesiones de un tratamiento filtrando por su ficha', async () => {
    const fs = db('d', claims.diego);
    await assertSucceeds(
      getDocs(
        query(
          collection(fs, 'appointments'),
          where('treatmentId', '==', 't-diego'),
          where('professionalId', '==', 'prof-diego'),
        ),
      ),
    );
    await assertFails(
      getDocs(query(collection(fs, 'appointments'), where('treatmentId', '==', 't-diego'))),
    );
  });

  it('nadie escribe tratamientos directamente', async () => {
    await assertFails(
      setDoc(doc(db('r', claims.recep), 'treatments', 'nuevo'), { status: 'ACTIVO' }),
    );
  });

  it('el PROFESIONAL solo lee sus tratamientos', async () => {
    await assertSucceeds(getDoc(doc(db('d', claims.diego), 'treatments', 't-diego')));
    await assertFails(getDoc(doc(db('d', claims.diego), 'treatments', 't-otro')));
  });
});

describe('caja y cobros', () => {
  it('recepción y administración leen cobros y la caja; nadie los escribe directamente', async () => {
    for (const token of [claims.admin, claims.recep]) {
      const fs = db('x', token);
      await assertSucceeds(getDoc(doc(fs, 'payments', 'p-otro')));
      await assertSucceeds(getDoc(doc(fs, 'cashSessions', 'caja-1')));
      await assertSucceeds(getDoc(doc(fs, 'cashRegister', 'main')));
      await assertFails(setDoc(doc(fs, 'payments', 'nuevo'), { amountCents: 1 }));
      await assertFails(setDoc(doc(fs, 'cashRegister', 'main'), { openSessionId: null }));
    }
  });

  it('el PROFESIONAL solo ve los cobros de sus sesiones, nunca la caja', async () => {
    const fs = db('d', claims.diego);
    await assertSucceeds(getDoc(doc(fs, 'payments', 'p-diego')));
    await assertFails(getDoc(doc(fs, 'payments', 'p-otro')));
    await assertSucceeds(
      getDocs(
        query(
          collection(fs, 'payments'),
          where('professionalId', '==', 'prof-diego'),
          where('date', '>=', '2026-09-01'),
        ),
      ),
    );
    await assertFails(
      getDocs(query(collection(fs, 'payments'), where('date', '==', '2026-09-28'))),
    );
    await assertFails(getDoc(doc(fs, 'cashSessions', 'caja-1')));
    await assertFails(getDoc(doc(fs, 'incomeStats', '2026-09')));
  });

  it('los ingresos globales del mes son solo de administración', async () => {
    await assertSucceeds(getDoc(doc(db('a', claims.admin), 'incomeStats', '2026-09')));
    await assertFails(getDoc(doc(db('r', claims.recep), 'incomeStats', '2026-09')));
  });
});

describe('reportes', () => {
  it('recepción y administración leen las estadísticas; el profesional no', async () => {
    const range = (fs: ReturnType<typeof db>) =>
      getDocs(query(collection(fs, 'dailyStats'), where('date', '>=', '2026-09-01')));
    await assertSucceeds(range(db('a', claims.admin)));
    await assertSucceeds(range(db('r', claims.recep)));
    await assertFails(range(db('d', claims.diego)));
    await assertFails(
      setDoc(doc(db('a', claims.admin), 'dailyStats', '2026-09-28'), { cells: {} }),
    );
  });

  it('los ingresos diarios son solo de administración', async () => {
    await assertSucceeds(getDoc(doc(db('a', claims.admin), 'dailyIncome', '2026-09-28')));
    await assertFails(getDoc(doc(db('r', claims.recep), 'dailyIncome', '2026-09-28')));
  });
});

describe('información clínica', () => {
  it('nadie la lee ni la escribe desde la web, ni siquiera la administración o el profesional asignado', async () => {
    for (const [uid, token] of [
      ['a', claims.admin],
      ['r', claims.recep],
      ['d', claims.diego],
    ] as const) {
      const fs = db(uid, token);
      await assertFails(getDoc(doc(fs, 'clinicalRecords', 'c-diego')));
      await assertFails(getDoc(doc(fs, 'clinicalRecords', 'c-diego', 'sessionNotes', 'a-diego')));
      await assertFails(
        setDoc(doc(fs, 'clinicalRecords', 'c-diego', 'sessionNotes', 'nueva'), {
          observations: 'x',
        }),
      );
    }
  });
});

describe('recordatorios y notificaciones', () => {
  it('recepción y administración leen los recordatorios; el profesional no; nadie los escribe', async () => {
    await assertSucceeds(getDoc(doc(db('r', claims.recep), 'reminders', 'a-diego')));
    await assertSucceeds(getDoc(doc(db('a', claims.admin), 'reminders', 'a-diego')));
    await assertFails(getDoc(doc(db('d', claims.diego), 'reminders', 'a-diego')));
    await assertFails(
      setDoc(doc(db('r', claims.recep), 'reminders', 'a-diego'), { status: 'CONFIRMADO' }),
    );
  });

  it('cada persona ve sus notificaciones y solo puede marcarlas como leídas', async () => {
    const mine = doc(db('r', claims.recep), 'notifications', 'n-recep');
    await assertSucceeds(getDoc(mine));
    await assertFails(getDoc(doc(db('a', claims.admin), 'notifications', 'n-recep')));
    await assertFails(setDoc(mine, { title: 'cambiado' }, { merge: true }));
    await assertSucceeds(setDoc(mine, { read: true }, { merge: true }));
    await assertFails(
      setDoc(doc(db('r', claims.recep), 'notifications', 'nueva'), { userId: 'r', read: false }),
    );
  });

  it('cada persona registra solo sus dispositivos para push', async () => {
    const fs = db('r', claims.recep);
    await assertSucceeds(
      setDoc(doc(fs, 'users', 'r', 'devices', 'd1'), {
        token: 'abc',
        userAgent: 'Chrome',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(fs, 'users', 'otro', 'devices', 'd1'), {
        token: 'abc',
        userAgent: 'Chrome',
        createdAt: serverTimestamp(),
      }),
    );
  });
});
