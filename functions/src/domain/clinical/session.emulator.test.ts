import { addDays, clinicDateTime, toDateKey } from '@kinesalud/shared';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { db } from '../../core/firebase';
import { recordSession } from './clinicalService';
import { firestoreClinicalGateway } from './firestoreClinicalGateway';

/**
 * Integración con Firestore Emulator: "registrar sesión" en una transacción
 * real. La cita, el tratamiento, el cliente y la nota cambian juntos, y dos
 * registros simultáneos de la misma cita no cuentan la sesión dos veces.
 */

const diego: Actor = {
  type: 'USER',
  uid: 'u-diego',
  role: 'PROFESIONAL',
  professionalId: 'diego',
  name: 'Lic. Diego',
  channel: 'web',
};
const DAY = addDays(toDateKey(new Date()), -1);
const note = {
  appointmentId: 'cita-1',
  observations: 'TENS y movilización.',
  painBefore: 6,
  painAfter: 3,
};

beforeEach(async () => {
  for (const name of ['clients', 'treatments', 'appointments', 'clinicalRecords', 'auditLogs']) {
    await db.recursiveDelete(db.collection(name));
  }
  const batch = db.batch();
  batch.set(db.doc('clients/cli-1'), {
    firstName: 'Carla',
    assignedProfessionalIds: ['diego'],
    stats: { noShowCount: 0, lastVisitAt: null },
  });
  batch.set(db.doc('treatments/trt-1'), {
    clientId: 'cli-1',
    professionalId: 'diego',
    serviceId: 'lumbar',
    status: 'ACTIVO',
    plannedSessions: 10,
    completedSessions: 2,
  });
  batch.set(db.doc('appointments/cita-1'), {
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego',
    roomId: 'c1',
    roomName: 'Camilla 1',
    serviceId: 'lumbar',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    treatmentId: 'trt-1',
    sessionNumber: 3,
    date: DAY,
    startAt: Timestamp.fromDate(clinicDateTime(DAY, '09:00')),
    endAt: Timestamp.fromDate(clinicDateTime(DAY, '09:45')),
    status: 'CONFIRMADA',
    sessionRecorded: false,
  });
  await batch.commit();
});

describe('registrar sesión contra el emulador', () => {
  it('actualiza cita, tratamiento, cliente y nota en la misma transacción', async () => {
    const result = await recordSession(firestoreClinicalGateway, diego, note);
    expect(result).toEqual({ markedAttended: true, completedSessions: 3, plannedSessions: 10 });

    const [appointment, treatment, client, saved] = await Promise.all([
      db.doc('appointments/cita-1').get(),
      db.doc('treatments/trt-1').get(),
      db.doc('clients/cli-1').get(),
      db.doc('clinicalRecords/cli-1/sessionNotes/cita-1').get(),
    ]);
    expect(appointment.get('status')).toBe('ATENDIDA');
    expect(appointment.get('sessionRecorded')).toBe(true);
    expect(treatment.get('completedSessions')).toBe(3);
    expect((client.get('stats.lastVisitAt') as Timestamp).toDate()).toEqual(
      clinicDateTime(DAY, '09:00'),
    );
    expect(saved.data()).toMatchObject({ sessionNumber: 3, painBefore: 6, painAfter: 3 });
  });

  it('dos registros simultáneos de la misma cita: uno se guarda, el otro se rechaza', async () => {
    const results = await Promise.allSettled([
      recordSession(firestoreClinicalGateway, diego, note),
      recordSession(firestoreClinicalGateway, diego, { ...note, observations: 'Otra versión' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.doc('treatments/trt-1').get()).get('completedSessions')).toBe(3);
  });
});
