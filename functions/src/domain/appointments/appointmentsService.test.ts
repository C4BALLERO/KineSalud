import { addDays, clinicDateTime, toDateKey } from '@kinesalud/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type {
  AppointmentsGateway,
  BookingTx,
  ClientRef,
  NewAppointment,
  NewEvent,
  ProfessionalRef,
  StoredAppointment,
  TreatmentRef,
} from './appointmentsGateway';
import {
  changeAppointmentStatus,
  correctAppointmentStatus,
  createAppointment,
  rescheduleAppointment,
} from './appointmentsService';

// Un lunes futuro fijo y "ahora" = el lunes anterior a las 10:00.
const DAY = '2030-09-30';
const NOW = clinicDateTime(addDays(DAY, -7), '10:00');
const morning = [{ start: '08:00', end: '12:00' }];

class InMemoryBooking implements AppointmentsGateway {
  professionals: ProfessionalRef[] = [
    {
      id: 'diego',
      displayName: 'Lic. Diego Pérez',
      active: true,
      serviceIds: ['lumbar'],
      weeklySchedule: { mon: morning },
    },
    {
      id: 'ana',
      displayName: 'Lic. Ana Gutiérrez',
      active: true,
      serviceIds: ['lumbar'],
      weeklySchedule: { mon: morning },
    },
  ];
  rooms = [
    {
      id: 'c1',
      name: 'Camilla 1',
      kind: 'CAMILLA' as const,
      capacity: 1,
      allowedCategories: ['FISIOTERAPIA' as const],
      active: true,
    },
  ];
  services = [
    {
      id: 'lumbar',
      name: 'Fisioterapia lumbar',
      category: 'FISIOTERAPIA' as const,
      durationMin: 45,
      bufferMin: 15,
      defaultSessions: 10,
      roomKinds: ['CAMILLA' as const],
      priceCents: 15000,
      active: true,
    },
  ];
  clients = new Map<
    string,
    ClientRef & { assigned: string[]; noShow: number; lastVisitAt: Date | null }
  >([
    [
      'cli-1',
      {
        id: 'cli-1',
        firstName: 'Carla',
        lastName: 'Rojas',
        status: 'ACTIVO',
        assigned: [],
        noShow: 0,
        lastVisitAt: null,
      },
    ],
    [
      'cli-2',
      {
        id: 'cli-2',
        firstName: 'Luis',
        lastName: 'Mamani',
        status: 'ACTIVO',
        assigned: [],
        noShow: 0,
        lastVisitAt: null,
      },
    ],
    [
      'cli-off',
      {
        id: 'cli-off',
        firstName: 'Ina',
        lastName: 'Activa',
        status: 'INACTIVO',
        assigned: [],
        noShow: 0,
        lastVisitAt: null,
      },
    ],
  ]);
  treatments = new Map<string, TreatmentRef>([
    [
      'trt-1',
      {
        id: 'trt-1',
        clientId: 'cli-1',
        serviceId: 'lumbar',
        status: 'ACTIVO',
        plannedSessions: 3,
        completedSessions: 1,
      },
    ],
  ]);
  appointments = new Map<string, StoredAppointment>();
  events: (NewEvent & { appointmentId: string })[] = [];
  audits: AuditEntry[] = [];
  seq = 0;

  async run<T>(work: (tx: BookingTx) => Promise<T>): Promise<T> {
    return work(inMemoryTx(this));
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

/** Transacción en memoria: aplica las escrituras directamente sobre el gateway. */
function inMemoryTx(self: InMemoryBooking): BookingTx {
  return {
    async lockDay() {},
    async getClinic() {
      return { openingHours: { mon: [{ start: '08:00', end: '18:00' }] }, slotMinutes: 15 };
    },
    async getProfessionals() {
      return self.professionals;
    },
    async getExceptions() {
      return [];
    },
    async getRooms() {
      return self.rooms;
    },
    async getService(id) {
      return self.services.find((s) => s.id === id) ?? null;
    },
    async getClient(id) {
      return self.clients.get(id) ?? null;
    },
    async getTreatment(id) {
      return self.treatments.get(id) ?? null;
    },
    async countOpenTreatmentAppointments(treatmentId) {
      return [...self.appointments.values()].filter(
        (a) =>
          a.treatmentId === treatmentId && (a.status === 'PENDIENTE' || a.status === 'CONFIRMADA'),
      ).length;
    },
    async getDayAppointments(date) {
      return [...self.appointments.values()].filter((a) => a.date === date);
    },
    async getAppointment(id) {
      return self.appointments.get(id) ?? null;
    },
    createAppointment(doc: NewAppointment) {
      const id = `apt-${++self.seq}`;
      self.appointments.set(id, { id, ...doc });
      return id;
    },
    updateAppointment(id, changes) {
      self.appointments.set(id, { ...self.appointments.get(id)!, ...changes });
    },
    addEvent(appointmentId, event) {
      self.events.push({ appointmentId, ...event });
    },
    updateClient(id, changes) {
      const c = self.clients.get(id)!;
      if (changes.addProfessionalId && !c.assigned.includes(changes.addProfessionalId)) {
        c.assigned.push(changes.addProfessionalId);
      }
      c.noShow += changes.noShowDelta ?? 0;
      if (changes.lastVisitAt) c.lastVisitAt = changes.lastVisitAt;
    },
    updateTreatment(id, { completedDelta }) {
      self.treatments.get(id)!.completedSessions += completedDelta;
    },
  };
}

const recep: Actor = {
  type: 'USER',
  uid: 'u-recep',
  role: 'RECEPCIONISTA',
  name: 'Rosa',
  channel: 'web',
};
const admin: Actor = { type: 'USER', uid: 'u-admin', role: 'ADMINISTRADOR', channel: 'web' };
const diego: Actor = {
  type: 'USER',
  uid: 'u-diego',
  role: 'PROFESIONAL',
  professionalId: 'diego',
  channel: 'web',
};
const ana: Actor = {
  type: 'USER',
  uid: 'u-ana',
  role: 'PROFESIONAL',
  professionalId: 'ana',
  channel: 'web',
};

const base = {
  clientId: 'cli-1',
  serviceId: 'lumbar',
  professionalId: 'diego',
  date: DAY,
  start: '09:00',
};

function rejects(promise: Promise<unknown>, code: string, message?: string | RegExp) {
  return expect(promise).rejects.toSatisfy((err: unknown) => {
    if (!(err instanceof DomainError) || err.code !== code) return false;
    if (message instanceof RegExp) return message.test(err.message);
    return message === undefined || err.message === message;
  });
}

let gw: InMemoryBooking;
beforeEach(() => {
  gw = new InMemoryBooking();
});

describe('agendar', () => {
  it('crea la cita con espacio asignado, historial y paciente asignado al profesional', async () => {
    const { appointmentId } = await createAppointment(gw, recep, base, NOW);
    expect(gw.appointments.get(appointmentId)).toMatchObject({
      clientName: 'Carla Rojas',
      professionalName: 'Lic. Diego Pérez',
      roomId: 'c1',
      roomName: 'Camilla 1',
      status: 'PENDIENTE',
      bufferMin: 15,
      source: 'WEB',
      endAt: clinicDateTime(DAY, '09:45'),
    });
    expect(gw.events[0]).toMatchObject({ type: 'CREADA', actor: { name: 'Rosa' } });
    expect(gw.clients.get('cli-1')?.assigned).toEqual(['diego']);
    expect(gw.audits.at(-1)?.action).toBe('appointment.create');
  });

  it('rechaza un horario ocupado y sugiere alternativas', async () => {
    await createAppointment(gw, recep, base, NOW);
    const err = (await createAppointment(
      gw,
      recep,
      { ...base, clientId: 'cli-2', start: '09:30' },
      NOW,
    ).catch((e: unknown) => e)) as DomainError;
    expect(err).toBeInstanceOf(DomainError);
    expect(err.message).toBe('El profesional ya tiene otra cita en ese horario.');
    expect(err.details).toMatchObject({ field: 'start', conflict: 'PROFESSIONAL_BUSY' });
    const alternatives = err.details!.alternatives as { start: string; professionalName: string }[];
    expect(alternatives.map((a) => a.start)).toEqual(['10:00', '10:15', '10:30']);
    expect(alternatives[0]?.professionalName).toBe('Lic. Diego Pérez');
  });

  it('con un solo espacio, otro profesional tampoco puede usarlo a la misma hora', async () => {
    await createAppointment(gw, recep, base, NOW);
    await rejects(
      createAppointment(gw, recep, { ...base, clientId: 'cli-2', professionalId: 'ana' }, NOW),
      'failed-precondition',
      'No hay un espacio compatible libre en ese horario.',
    );
  });

  it('solo recepción o administración agendan; el cliente debe estar activo', async () => {
    await rejects(createAppointment(gw, diego, base, NOW), 'permission-denied');
    await rejects(
      createAppointment(gw, recep, { ...base, clientId: 'cli-off' }, NOW),
      'failed-precondition',
      /inactivo/,
    );
  });

  it('numera la sesión del tratamiento y no agenda más de las previstas', async () => {
    const first = await createAppointment(gw, recep, { ...base, treatmentId: 'trt-1' }, NOW);
    expect(gw.appointments.get(first.appointmentId)?.sessionNumber).toBe(2);
    const second = await createAppointment(
      gw,
      recep,
      { ...base, treatmentId: 'trt-1', start: '10:00' },
      NOW,
    );
    expect(gw.appointments.get(second.appointmentId)?.sessionNumber).toBe(3);
    await rejects(
      createAppointment(gw, recep, { ...base, treatmentId: 'trt-1', start: '11:00' }, NOW),
      'failed-precondition',
      'El tratamiento ya tiene todas sus sesiones agendadas.',
    );
  });
});

describe('reprogramar', () => {
  it('mueve la cita, la vuelve a PENDIENTE y registra de dónde a dónde', async () => {
    const { appointmentId } = await createAppointment(
      gw,
      recep,
      { ...base, status: 'CONFIRMADA' },
      NOW,
    );
    // Se puede mover dentro de su propio horario (no choca consigo misma).
    await rescheduleAppointment(
      gw,
      recep,
      { appointmentId, professionalId: 'ana', date: DAY, start: '09:15' },
      NOW,
    );
    expect(gw.appointments.get(appointmentId)).toMatchObject({
      professionalId: 'ana',
      status: 'PENDIENTE',
      startAt: clinicDateTime(DAY, '09:15'),
    });
    expect(gw.events.at(-1)).toMatchObject({
      type: 'REPROGRAMADA',
      from: { status: 'CONFIRMADA', start: '09:00', professionalName: 'Lic. Diego Pérez' },
      to: { status: 'PENDIENTE', start: '09:15', professionalName: 'Lic. Ana Gutiérrez' },
    });
    expect(gw.clients.get('cli-1')?.assigned).toEqual(['diego', 'ana']);
  });
});

describe('estados', () => {
  const afterStart = clinicDateTime(DAY, '09:10');

  it('el profesional confirma y registra la asistencia solo de sus citas', async () => {
    const { appointmentId } = await createAppointment(gw, recep, base, NOW);
    await rejects(
      changeAppointmentStatus(gw, ana, { appointmentId, action: 'CONFIRMAR' }, NOW),
      'permission-denied',
    );
    await changeAppointmentStatus(gw, diego, { appointmentId, action: 'CONFIRMAR' }, NOW);
    expect(gw.appointments.get(appointmentId)?.status).toBe('CONFIRMADA');
    await rejects(
      changeAppointmentStatus(
        gw,
        diego,
        { appointmentId, action: 'CANCELAR', reason: 'Enfermo' },
        NOW,
      ),
      'permission-denied',
    );
  });

  it('atender suma la sesión al tratamiento y registra la última visita', async () => {
    const { appointmentId } = await createAppointment(
      gw,
      recep,
      { ...base, treatmentId: 'trt-1' },
      NOW,
    );
    await rejects(
      changeAppointmentStatus(gw, diego, { appointmentId, action: 'ATENDER' }, NOW),
      'failed-precondition',
      /desde la hora de inicio/,
    );
    await changeAppointmentStatus(gw, diego, { appointmentId, action: 'ATENDER' }, afterStart);
    expect(gw.treatments.get('trt-1')?.completedSessions).toBe(2);
    expect(gw.clients.get('cli-1')?.lastVisitAt).toEqual(clinicDateTime(DAY, '09:00'));
    await rejects(
      changeAppointmentStatus(
        gw,
        recep,
        { appointmentId, action: 'CANCELAR', reason: 'Error' },
        afterStart,
      ),
      'failed-precondition',
      /cerrada/,
    );
  });

  it('cancelar libera el horario y guarda el motivo', async () => {
    const { appointmentId } = await createAppointment(gw, recep, base, NOW);
    await changeAppointmentStatus(
      gw,
      recep,
      { appointmentId, action: 'CANCELAR', reason: 'Viaje' },
      NOW,
    );
    expect(gw.appointments.get(appointmentId)).toMatchObject({
      status: 'CANCELADA',
      cancelReason: 'Viaje',
    });
    await expect(
      createAppointment(gw, recep, { ...base, clientId: 'cli-2' }, NOW),
    ).resolves.toBeTruthy();
  });

  it('guarda el precio al agendar y no cancela una cita ya pagada', async () => {
    const { appointmentId } = await createAppointment(gw, recep, base, NOW);
    expect(gw.appointments.get(appointmentId)).toMatchObject({
      priceCents: 15000,
      paymentStatus: 'POR_COBRAR',
      paymentId: null,
    });
    Object.assign(gw.appointments.get(appointmentId)!, {
      paymentStatus: 'PAGADA',
      paymentId: 'pago-1',
    });
    await rejects(
      changeAppointmentStatus(
        gw,
        recep,
        { appointmentId, action: 'CANCELAR', reason: 'Viaje' },
        NOW,
      ),
      'failed-precondition',
      /Anula el cobro/,
    );
    await rejects(
      correctAppointmentStatus(
        gw,
        admin,
        { appointmentId, status: 'CANCELADA', reason: 'x x x' },
        NOW,
      ),
      'failed-precondition',
      /Anula el cobro/,
    );
  });

  it('la corrección administrativa ajusta contadores y no pisa horarios ocupados', async () => {
    const { appointmentId } = await createAppointment(gw, recep, base, NOW);
    await changeAppointmentStatus(gw, recep, { appointmentId, action: 'NO_ASISTIO' }, afterStart);
    expect(gw.clients.get('cli-1')?.noShow).toBe(1);

    await rejects(
      correctAppointmentStatus(
        gw,
        recep,
        { appointmentId, status: 'ATENDIDA', reason: 'Llegó tarde' },
        afterStart,
      ),
      'permission-denied',
    );
    await correctAppointmentStatus(
      gw,
      admin,
      { appointmentId, status: 'ATENDIDA', reason: 'Llegó tarde' },
      afterStart,
    );
    expect(gw.clients.get('cli-1')?.noShow).toBe(0);
    expect(gw.events.at(-1)).toMatchObject({ type: 'CORREGIDA', reason: 'Llegó tarde' });

    // Cancelada y su horario tomado por otra cita: no se puede reactivar.
    const other = await createAppointment(
      gw,
      recep,
      { ...base, clientId: 'cli-2', start: '10:00' },
      NOW,
    );
    await changeAppointmentStatus(
      gw,
      recep,
      { appointmentId: other.appointmentId, action: 'CANCELAR', reason: 'x x' },
      NOW,
    );
    await createAppointment(gw, recep, { ...base, start: '10:00' }, NOW);
    await rejects(
      correctAppointmentStatus(
        gw,
        admin,
        { appointmentId: other.appointmentId, status: 'PENDIENTE', reason: 'Error' },
        NOW,
      ),
      'failed-precondition',
      /ya fue ocupado/,
    );
  });
});

describe('fechas', () => {
  it('no agenda en fechas pasadas', async () => {
    await rejects(
      createAppointment(gw, recep, { ...base, date: addDays(toDateKey(new Date()), -1) }, NOW),
      'invalid-argument',
    );
  });
});
