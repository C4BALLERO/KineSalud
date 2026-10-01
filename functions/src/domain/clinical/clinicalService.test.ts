import { clinicDateTime } from '@kinesalud/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type { StoredAppointment, TreatmentRef } from '../appointments/appointmentsGateway';
import type {
  ClinicalClientRef,
  ClinicalGateway,
  ClinicalTreatmentRef,
  SessionTx,
  StoredNote,
  StoredPlan,
  StoredRecord,
} from './clinicalGateway';
import {
  getClientClinical,
  getTreatmentClinical,
  recordSession,
  saveTreatmentPlan,
  updateSessionNote,
} from './clinicalService';

const DAY = '2026-09-28';
const START = clinicDateTime(DAY, '09:00');
const AFTER = clinicDateTime(DAY, '09:50');

class InMemoryClinical implements ClinicalGateway {
  clients = new Map<string, ClinicalClientRef & { lastVisitAt?: Date }>();
  treatments = new Map<string, ClinicalTreatmentRef & TreatmentRef>();
  appointments = new Map<string, StoredAppointment>();
  records = new Map<string, StoredRecord>();
  plans = new Map<string, StoredPlan>();
  notes = new Map<string, StoredNote>();
  events: string[] = [];
  audits: AuditEntry[] = [];

  async getClient(id: string) {
    return this.clients.get(id) ?? null;
  }
  async getTreatment(id: string) {
    return this.treatments.get(id) ?? null;
  }
  async getAppointment(id: string) {
    return this.appointments.get(id) ?? null;
  }
  async getRecord(clientId: string) {
    return this.records.get(clientId) ?? null;
  }
  async saveRecord(clientId: string, data: Omit<StoredRecord, 'updatedAt'>) {
    this.records.set(clientId, { ...data, updatedAt: new Date() });
  }
  async getPlan(_c: string, treatmentId: string) {
    return this.plans.get(treatmentId) ?? null;
  }
  async savePlan(_c: string, treatmentId: string, data: Omit<StoredPlan, 'updatedAt'>) {
    this.plans.set(treatmentId, { ...data, updatedAt: new Date() });
  }
  async listNotes(_c: string, treatmentId?: string) {
    return [...this.notes.values()].filter((n) => !treatmentId || n.treatmentId === treatmentId);
  }
  async getNote(_c: string, appointmentId: string) {
    return this.notes.get(appointmentId) ?? null;
  }
  async updateNote(_c: string, appointmentId: string, changes: Partial<StoredNote>) {
    Object.assign(this.notes.get(appointmentId)!, changes);
  }
  async runSession<T>(work: (tx: SessionTx) => Promise<T>): Promise<T> {
    const tx: Partial<SessionTx> = {
      getAppointment: async (id) => this.appointments.get(id) ?? null,
      getTreatment: async (id) => this.treatments.get(id) ?? null,
      getNote: async (_c, id) => this.notes.get(id) ?? null,
      updateAppointment: (id, changes) => {
        Object.assign(this.appointments.get(id)!, changes);
      },
      addEvent: (_id, e) => {
        this.events.push(e.type);
      },
      updateTreatment: (id, { completedDelta }) => {
        this.treatments.get(id)!.completedSessions += completedDelta;
      },
      updateClient: (id, changes) => {
        if (changes.lastVisitAt) this.clients.get(id)!.lastVisitAt = changes.lastVisitAt;
      },
      createNote: (_c, note) => {
        this.notes.set(note.appointmentId, { ...note, createdAt: new Date(), updatedAt: null });
      },
    };
    return work(tx as SessionTx);
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

const admin: Actor = { type: 'USER', uid: 'u-admin', role: 'ADMINISTRADOR', channel: 'web' };
const recep: Actor = { type: 'USER', uid: 'u-recep', role: 'RECEPCIONISTA', channel: 'web' };
const diego: Actor = {
  type: 'USER',
  uid: 'u-diego',
  role: 'PROFESIONAL',
  professionalId: 'diego',
  name: 'Lic. Diego',
  channel: 'web',
};
const carla: Actor = {
  type: 'USER',
  uid: 'u-carla',
  role: 'PROFESIONAL',
  professionalId: 'carla',
  channel: 'web',
};

const note = {
  appointmentId: 'cita-1',
  observations: 'Movilización lumbar y TENS.',
  painBefore: 7,
  painAfter: 4,
};

async function rejects(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

let gw: InMemoryClinical;
beforeEach(() => {
  gw = new InMemoryClinical();
  gw.clients.set('cli-1', { id: 'cli-1', assignedProfessionalIds: ['diego'] });
  gw.treatments.set('trt-1', {
    id: 'trt-1',
    clientId: 'cli-1',
    professionalId: 'diego',
    serviceId: 'lumbar',
    status: 'ACTIVO',
    plannedSessions: 10,
    completedSessions: 3,
  });
  gw.appointments.set('cita-1', {
    id: 'cita-1',
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    roomId: 'c1',
    roomName: 'Camilla 1',
    serviceId: 'lumbar',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    treatmentId: 'trt-1',
    sessionNumber: 4,
    date: DAY,
    startAt: START,
    endAt: clinicDateTime(DAY, '09:45'),
    status: 'CONFIRMADA',
    source: 'WEB',
    cancelReason: null,
    bufferMin: 15,
    notes: null,
    priceCents: 15000,
    paymentStatus: 'POR_COBRAR',
    paymentId: null,
    sessionRecorded: false,
    createdBy: null,
  });
});

describe('acceso a la información clínica', () => {
  it('la recepción nunca la ve y el profesional solo la de sus pacientes', async () => {
    await rejects(getClientClinical(gw, recep, { clientId: 'cli-1' }), 'permission-denied');
    await rejects(getClientClinical(gw, carla, { clientId: 'cli-1' }), 'permission-denied');
    await expect(getClientClinical(gw, diego, { clientId: 'cli-1' })).resolves.toEqual({
      record: null,
      notes: [],
    });
    await expect(getClientClinical(gw, admin, { clientId: 'cli-1' })).resolves.toBeTruthy();
  });

  it('cada lectura queda en la auditoría', async () => {
    await getTreatmentClinical(gw, diego, { treatmentId: 'trt-1' });
    expect(gw.audits).toEqual([
      expect.objectContaining({
        action: 'clinical.read',
        entityId: 'cli-1',
        meta: { scope: 'treatment:trt-1' },
      }),
    ]);
  });

  it('el plan lo define quien lleva el tratamiento', async () => {
    gw.clients.get('cli-1')!.assignedProfessionalIds.push('carla');
    const plan = { treatmentId: 'trt-1', goals: 'Flexión sin dolor' };
    await rejects(saveTreatmentPlan(gw, carla, plan), 'permission-denied');
    await saveTreatmentPlan(gw, diego, plan);
    expect(gw.plans.get('trt-1')).toMatchObject({ goals: 'Flexión sin dolor', assessment: null });
  });
});

describe('registrar la sesión', () => {
  it('marca la cita como atendida, suma la sesión y guarda la nota en una operación', async () => {
    const result = await recordSession(gw, diego, note, AFTER);
    expect(result).toEqual({ markedAttended: true, completedSessions: 4, plannedSessions: 10 });
    expect(gw.appointments.get('cita-1')).toMatchObject({
      status: 'ATENDIDA',
      sessionRecorded: true,
    });
    expect(gw.treatments.get('trt-1')?.completedSessions).toBe(4);
    expect(gw.clients.get('cli-1')?.lastVisitAt).toEqual(START);
    expect(gw.events).toEqual(['ATENDIDA']);
    expect(gw.notes.get('cita-1')).toMatchObject({
      sessionNumber: 4,
      painBefore: 7,
      painAfter: 4,
      createdBy: { uid: 'u-diego', name: 'Lic. Diego' },
    });
    expect(gw.audits.at(-1)?.action).toBe('clinical.session.record');
    await rejects(recordSession(gw, diego, note, AFTER), 'already-exists');
  });

  it('si la asistencia ya estaba marcada, no vuelve a contar la sesión', async () => {
    gw.appointments.get('cita-1')!.status = 'ATENDIDA';
    const result = await recordSession(gw, diego, note, AFTER);
    expect(result.markedAttended).toBe(false);
    expect(gw.treatments.get('trt-1')?.completedSessions).toBe(3);
    expect(gw.events).toEqual([]);
  });

  it('no se registra antes de la hora, ni por otro profesional, ni sin observaciones', async () => {
    await rejects(
      recordSession(gw, diego, note, clinicDateTime(DAY, '08:00')),
      'failed-precondition',
    );
    await rejects(recordSession(gw, carla, note, AFTER), 'permission-denied');
    await rejects(recordSession(gw, recep, note, AFTER), 'permission-denied');
    await rejects(
      recordSession(gw, diego, { ...note, observations: '' }, AFTER),
      'invalid-argument',
    );
  });
});

describe('editar una nota', () => {
  it('la edita su autor durante 7 días; después, solo la administración', async () => {
    await recordSession(gw, diego, note, AFTER);
    await updateSessionNote(gw, diego, { ...note, evolution: 'Mejor movilidad' }, AFTER);
    expect(gw.notes.get('cita-1')?.evolution).toBe('Mejor movilidad');

    const later = new Date(Date.now() + 8 * 86_400_000);
    await rejects(updateSessionNote(gw, diego, note, later), 'permission-denied');
    await expect(updateSessionNote(gw, admin, note, later)).resolves.toBeUndefined();
  });
});
