import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type {
  StoredTreatment,
  TreatmentClientRef,
  TreatmentProfessionalRef,
  TreatmentsGateway,
  TreatmentsTx,
} from './treatmentsGateway';
import { changeTreatmentStatus, createTreatment, updateTreatment } from './treatmentsService';

class InMemoryTreatments implements TreatmentsGateway {
  clients = new Map<string, TreatmentClientRef & { activeTreatments: number }>();
  professionals = new Map<string, TreatmentProfessionalRef>();
  treatments = new Map<string, StoredTreatment>();
  openAppointments = new Map<string, number>();
  audits: AuditEntry[] = [];
  seq = 0;

  async run<T>(work: (tx: TreatmentsTx) => Promise<T>): Promise<T> {
    return work(inMemoryTx(this));
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

const SERVICE = {
  id: 'lumbar',
  name: 'Fisioterapia lumbar',
  category: 'FISIOTERAPIA' as const,
  durationMin: 45,
  bufferMin: 15,
  defaultSessions: 10,
  roomKinds: ['CAMILLA' as const],
  priceCents: 15000,
  active: true,
};

function inMemoryTx(self: InMemoryTreatments): TreatmentsTx {
  return {
    async getClient(id) {
      return self.clients.get(id) ?? null;
    },
    async getService(id) {
      return id === SERVICE.id ? SERVICE : null;
    },
    async getProfessional(id) {
      return self.professionals.get(id) ?? null;
    },
    async getTreatment(id) {
      return self.treatments.get(id) ?? null;
    },
    async getClientTreatments(clientId) {
      return [...self.treatments.values()].filter((t) => t.clientId === clientId);
    },
    async countOpenAppointments(id) {
      return self.openAppointments.get(id) ?? 0;
    },
    createTreatment(doc) {
      const id = `trt-${++self.seq}`;
      self.treatments.set(id, { ...doc, id });
      return id;
    },
    updateTreatment(id, { statusChanged: _s, ...changes }) {
      Object.assign(self.treatments.get(id)!, changes);
    },
    updateClient(id, { addProfessionalId, activeDelta }) {
      const c = self.clients.get(id)!;
      if (addProfessionalId && !c.assignedProfessionalIds.includes(addProfessionalId)) {
        c.assignedProfessionalIds.push(addProfessionalId);
      }
      c.activeTreatments += activeDelta ?? 0;
    },
  };
}

const recep: Actor = { type: 'USER', uid: 'u-recep', role: 'RECEPCIONISTA', channel: 'web' };
const diego: Actor = {
  type: 'USER',
  uid: 'u-diego',
  role: 'PROFESIONAL',
  professionalId: 'diego',
  channel: 'web',
};

const base = {
  clientId: 'cli-1',
  serviceId: 'lumbar',
  professionalId: 'diego',
  startDate: new Date().toISOString().slice(0, 10),
  plannedSessions: 10,
};

async function rejects(promise: Promise<unknown>, code: string, message?: RegExp) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  if (message) expect((err as DomainError).message).toMatch(message);
}

let gw: InMemoryTreatments;
beforeEach(() => {
  gw = new InMemoryTreatments();
  gw.clients.set('cli-1', {
    id: 'cli-1',
    firstName: 'Carla',
    lastName: 'Rojas',
    status: 'ACTIVO',
    assignedProfessionalIds: [],
    activeTreatments: 0,
  });
  gw.clients.set('cli-2', {
    id: 'cli-2',
    firstName: 'Luis',
    lastName: 'Mamani',
    status: 'ACTIVO',
    assignedProfessionalIds: ['diego'],
    activeTreatments: 0,
  });
  gw.professionals.set('diego', {
    id: 'diego',
    displayName: 'Lic. Diego Pérez',
    active: true,
    serviceIds: ['lumbar'],
  });
  gw.professionals.set('ana', {
    id: 'ana',
    displayName: 'Lic. Ana Gutiérrez',
    active: true,
    serviceIds: [],
  });
});

describe('abrir un tratamiento', () => {
  it('lo crea activo, asigna el paciente al profesional y suma al contador', async () => {
    const { treatmentId } = await createTreatment(gw, recep, base);
    expect(gw.treatments.get(treatmentId)).toMatchObject({
      clientName: 'Carla Rojas',
      professionalName: 'Lic. Diego Pérez',
      category: 'FISIOTERAPIA',
      plannedSessions: 10,
      completedSessions: 0,
      status: 'ACTIVO',
    });
    expect(gw.clients.get('cli-1')).toMatchObject({
      assignedProfessionalIds: ['diego'],
      activeTreatments: 1,
    });
    expect(gw.audits[0]?.action).toBe('treatment.create');
  });

  it('no duplica un tratamiento activo del mismo servicio', async () => {
    await createTreatment(gw, recep, base);
    await rejects(createTreatment(gw, recep, base), 'already-exists', /ya tiene un tratamiento/);
  });

  it('exige un profesional que realice el servicio', async () => {
    await rejects(
      createTreatment(gw, recep, { ...base, professionalId: 'ana' }),
      'failed-precondition',
      /no realiza/,
    );
  });

  it('el profesional solo abre tratamientos a su nombre y para sus pacientes', async () => {
    await rejects(
      createTreatment(gw, diego, { ...base, clientId: 'cli-2', professionalId: 'ana' }),
      'permission-denied',
    );
    await rejects(createTreatment(gw, diego, base), 'permission-denied', /tus pacientes/);
    await expect(createTreatment(gw, diego, { ...base, clientId: 'cli-2' })).resolves.toBeTruthy();
  });
});

describe('editar un tratamiento', () => {
  it('no baja las sesiones previstas por debajo de las realizadas y agendadas', async () => {
    const { treatmentId } = await createTreatment(gw, recep, base);
    gw.treatments.get(treatmentId)!.completedSessions = 4;
    gw.openAppointments.set(treatmentId, 2);
    await rejects(
      updateTreatment(gw, recep, { treatmentId, professionalId: 'diego', plannedSessions: 5 }),
      'invalid-argument',
      /Mínimo 6/,
    );
    await updateTreatment(gw, recep, { treatmentId, professionalId: 'diego', plannedSessions: 6 });
    expect(gw.treatments.get(treatmentId)?.plannedSessions).toBe(6);
  });
});

describe('estado del tratamiento', () => {
  it('suspender exige motivo y no deja citas agendadas sin plan', async () => {
    const { treatmentId } = await createTreatment(gw, recep, base);
    gw.openAppointments.set(treatmentId, 1);
    await rejects(
      changeTreatmentStatus(gw, recep, { treatmentId, action: 'SUSPENDER', reason: 'Viaje' }),
      'failed-precondition',
      /1 cita agendada/,
    );
    gw.openAppointments.set(treatmentId, 0);
    await rejects(
      changeTreatmentStatus(gw, recep, { treatmentId, action: 'SUSPENDER' }),
      'invalid-argument',
      /motivo/,
    );
    await changeTreatmentStatus(gw, recep, { treatmentId, action: 'SUSPENDER', reason: 'Viaje' });
    expect(gw.treatments.get(treatmentId)).toMatchObject({
      status: 'SUSPENDIDO',
      statusReason: 'Viaje',
    });
    expect(gw.clients.get('cli-1')?.activeTreatments).toBe(0);

    await changeTreatmentStatus(gw, recep, { treatmentId, action: 'REACTIVAR' });
    expect(gw.treatments.get(treatmentId)?.status).toBe('ACTIVO');
    expect(gw.clients.get('cli-1')?.activeTreatments).toBe(1);
  });

  it('finalizar sin completar las sesiones pide motivo; completas, no', async () => {
    const { treatmentId } = await createTreatment(gw, recep, { ...base, plannedSessions: 2 });
    await rejects(
      changeTreatmentStatus(gw, recep, { treatmentId, action: 'FINALIZAR' }),
      'invalid-argument',
    );
    gw.treatments.get(treatmentId)!.completedSessions = 2;
    await changeTreatmentStatus(gw, recep, { treatmentId, action: 'FINALIZAR' });
    expect(gw.treatments.get(treatmentId)?.status).toBe('FINALIZADO');
    await rejects(
      updateTreatment(gw, recep, { treatmentId, professionalId: 'diego', plannedSessions: 3 }),
      'failed-precondition',
      /Reactívalo/,
    );
  });

  it('no reactiva si ya hay otro tratamiento activo del mismo servicio', async () => {
    const first = await createTreatment(gw, recep, { ...base, plannedSessions: 1 });
    gw.treatments.get(first.treatmentId)!.completedSessions = 1;
    await changeTreatmentStatus(gw, recep, { treatmentId: first.treatmentId, action: 'FINALIZAR' });
    await createTreatment(gw, recep, base);
    await rejects(
      changeTreatmentStatus(gw, recep, {
        treatmentId: first.treatmentId,
        action: 'REACTIVAR',
        reason: 'Recaída',
      }),
      'already-exists',
    );
  });

  it('el profesional no cambia tratamientos ajenos', async () => {
    gw.professionals.get('ana')!.serviceIds.push('lumbar');
    const { treatmentId } = await createTreatment(gw, recep, { ...base, professionalId: 'ana' });
    await rejects(
      changeTreatmentStatus(gw, diego, { treatmentId, action: 'SUSPENDER', reason: 'x' }),
      'permission-denied',
    );
  });
});
