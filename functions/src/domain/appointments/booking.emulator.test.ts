import { addDays, startOfWeek, toDateKey } from '@kinesalud/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { db } from '../../core/firebase';
import { createAppointment } from './appointmentsService';
import { firestoreAppointmentsGateway } from './firestoreAppointmentsGateway';

/**
 * Integración con Firestore Emulator: transacciones reales. Comprueba que el
 * candado por día impide citas duplicadas cuando varias personas agendan a la
 * vez el mismo horario.
 */

const recep: Actor = { type: 'USER', uid: 'u-recep', role: 'RECEPCIONISTA', channel: 'web' };
// El lunes de dentro de dos semanas: siempre futuro y dentro del horario.
const DAY = addDays(startOfWeek(toDateKey(new Date())), 14);
const morning = [{ start: '08:00', end: '12:00' }];

async function clear() {
  for (const name of [
    'settings',
    'professionals',
    'rooms',
    'services',
    'clients',
    'appointments',
    'scheduleLocks',
    'auditLogs',
  ]) {
    await db.recursiveDelete(db.collection(name));
  }
}

beforeEach(async () => {
  await clear();
  const batch = db.batch();
  batch.set(db.doc('settings/clinic'), { openingHours: { mon: morning }, slotMinutes: 15 });
  for (const id of ['diego', 'ana']) {
    batch.set(db.doc(`professionals/${id}`), {
      displayName: id,
      active: true,
      serviceIds: ['lumbar'],
      weeklySchedule: { mon: morning },
    });
  }
  batch.set(db.doc('rooms/c1'), {
    name: 'Camilla 1',
    kind: 'CAMILLA',
    capacity: 1,
    allowedCategories: ['FISIOTERAPIA'],
    active: true,
  });
  batch.set(db.doc('services/lumbar'), {
    name: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    durationMin: 45,
    bufferMin: 15,
    defaultSessions: 10,
    roomKinds: ['CAMILLA'],
    active: true,
  });
  for (let i = 1; i <= 5; i++) {
    batch.set(db.doc(`clients/cli-${i}`), {
      firstName: 'Cliente',
      lastName: String(i),
      status: 'ACTIVO',
      assignedProfessionalIds: [],
      stats: { noShowCount: 0, activeTreatments: 0, lastVisitAt: null },
    });
  }
  await batch.commit();
});

describe('reservas simultáneas', () => {
  it('cinco personas agendan el mismo horario a la vez: solo una lo consigue', async () => {
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((i) =>
        createAppointment(firestoreAppointmentsGateway, recep, {
          clientId: `cli-${i}`,
          serviceId: 'lumbar',
          professionalId: 'diego',
          date: DAY,
          start: '09:00',
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(4);
    for (const r of rejected)
      expect((r.reason as { code: string }).code).toBe('failed-precondition');

    const saved = await db.collection('appointments').where('date', '==', DAY).get();
    expect(saved.size).toBe(1);
  });

  it('dos profesionales no comparten el único espacio a la misma hora', async () => {
    const results = await Promise.allSettled(
      (['diego', 'ana'] as const).map((professionalId, i) =>
        createAppointment(firestoreAppointmentsGateway, recep, {
          clientId: `cli-${i + 1}`,
          serviceId: 'lumbar',
          professionalId,
          date: DAY,
          start: '10:00',
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
