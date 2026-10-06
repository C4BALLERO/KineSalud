import {
  APPOINTMENT_ACTION_TARGET,
  BLOCKING_APPOINTMENT_STATUSES,
  canApplyAction,
  canReschedule,
  changeAppointmentStatusInputSchema,
  checkSlot,
  clinicDateTime,
  clinicMinutesOf,
  correctAppointmentStatusInputSchema,
  createAppointmentInputSchema,
  findSlots,
  listSlotsInputSchema,
  nearestSlots,
  PAID_CANCEL_REASON,
  permissionScope,
  rescheduleAppointmentInputSchema,
  SLOT_CONFLICTS,
  toDateKey,
  type AppointmentEventType,
  type AppointmentStatus,
  type BookedAppointment,
  type CreateAppointmentResult,
  type DateKey,
  type DayContext,
  type ListSlotsResult,
  type SlotAlternative,
  type SlotRequest,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requirePermission, requireRecordAccess } from '../../core/guards';
import { auditActor } from '../audit';
import type {
  AppointmentsGateway,
  BookingTx,
  NewEvent,
  ProfessionalRef,
  StoredAppointment,
} from './appointmentsGateway';

const toBooked = (a: StoredAppointment): BookedAppointment => ({
  id: a.id,
  professionalId: a.professionalId,
  roomId: a.roomId,
  clientId: a.clientId,
  status: a.status,
  start: clinicMinutesOf(a.startAt),
  end: clinicMinutesOf(a.endAt),
  bufferMin: a.bufferMin ?? 0,
});

interface LoadedDay {
  ctx: DayContext;
  professionals: ProfessionalRef[];
  rooms: Awaited<ReturnType<BookingTx['getRooms']>>;
}

/** Lee (en la transacción) todo lo necesario para validar horarios de un día. */
async function loadDay(tx: BookingTx, date: DateKey, now: Date): Promise<LoadedDay> {
  const [clinic, professionals, exceptions, rooms, appointments] = await Promise.all([
    tx.getClinic(),
    tx.getProfessionals(),
    tx.getExceptions(date),
    tx.getRooms(),
    tx.getDayAppointments(date),
  ]);
  if (!clinic) {
    throw new DomainError(
      'failed-precondition',
      'El consultorio no tiene horario de atención configurado. Pide a la administración que lo defina en Configuración.',
    );
  }
  const today = toDateKey(now);
  return {
    professionals,
    rooms,
    ctx: {
      date,
      openingHours: clinic.openingHours,
      slotMinutes: clinic.slotMinutes,
      professionals,
      exceptions,
      rooms,
      appointments: appointments.map(toBooked),
      nowMinutes: date === today ? clinicMinutesOf(now) : null,
    },
  };
}

/**
 * Error de horario ocupado con hasta 3 alternativas cercanas (mismo profesional
 * primero). Con `sameOnly`, solo se sugieren horarios de la misma agenda.
 */
function slotError(
  day: LoadedDay,
  conflict: keyof typeof SLOT_CONFLICTS,
  request: SlotRequest & { professionalId: string; start: string },
  sameOnly = false,
): DomainError {
  const nameOf = (id: string) => day.professionals.find((p) => p.id === id)?.displayName ?? '';
  const same = findSlots(day.ctx, { ...request });
  const pool =
    same.length > 0 || sameOnly ? same : findSlots(day.ctx, { ...request, professionalId: null });
  const alternatives: SlotAlternative[] = nearestSlots(pool, request.start).map((s) => ({
    start: s.start,
    professionalId: s.professionalId,
    professionalName: nameOf(s.professionalId),
  }));
  return new DomainError('failed-precondition', SLOT_CONFLICTS[conflict], {
    field: 'start',
    conflict,
    alternatives,
  });
}

function eventActor(actor: Actor): NewEvent['actor'] {
  return {
    type: actor.type,
    uid: actor.uid ?? null,
    name: actor.name ?? null,
    channel: actor.channel,
  };
}

function sourceOf(actor: Actor) {
  return actor.type === 'CHATBOT' ? 'CHATBOT' : actor.type === 'SYSTEM' ? 'SYSTEM' : 'WEB';
}

/**
 * Profesional cuya agenda propia administra el actor, o null si administra la
 * agenda de todo el consultorio (recepción y administración).
 */
function ownAgenda(actor: Actor): string | null {
  requirePermission(actor, 'appointments.manage');
  const scope = permissionScope(
    { role: actor.role!, professionalId: actor.professionalId },
    'appointments.manage',
  );
  if (scope === 'all') return null;
  if (!actor.professionalId) {
    throw new DomainError(
      'permission-denied',
      'Tu cuenta no está vinculada a una ficha de profesional. Pide a la administración que la vincule.',
    );
  }
  return actor.professionalId;
}

const OWN_AGENDA_ONLY = 'Solo puedes agendar citas en tu propia agenda.';

const timeOf = (d: Date) => {
  const m = clinicMinutesOf(d);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/* ---------- Agendar ---------- */

export async function createAppointment(
  gateway: AppointmentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<CreateAppointmentResult> {
  const own = ownAgenda(actor);
  const input = parseInput(createAppointmentInputSchema, data);
  if (own && input.professionalId !== own) {
    throw new DomainError('permission-denied', OWN_AGENDA_ONLY, { field: 'professionalId' });
  }

  const appointmentId = await gateway.run(async (tx) => {
    await tx.lockDay(input.date);
    const [day, service, client, treatment, openInTreatment] = await Promise.all([
      loadDay(tx, input.date, now),
      tx.getService(input.serviceId),
      tx.getClient(input.clientId),
      input.treatmentId ? tx.getTreatment(input.treatmentId) : Promise.resolve(null),
      input.treatmentId ? tx.countOpenTreatmentAppointments(input.treatmentId) : Promise.resolve(0),
    ]);

    if (!client) throw new DomainError('not-found', 'El cliente no existe.');
    // El profesional no ve a los clientes ajenos: agenda solo a sus pacientes.
    if (own && !client.assignedProfessionalIds.includes(own)) {
      throw new DomainError(
        'permission-denied',
        'Ese cliente no está entre tus pacientes. Regístralo desde Mis pacientes.',
        { field: 'clientId' },
      );
    }
    if (client.status !== 'ACTIVO') {
      throw new DomainError(
        'failed-precondition',
        'El cliente está inactivo. Reactívalo desde su perfil para agendarle citas.',
        { field: 'clientId' },
      );
    }
    if (!service) throw new DomainError('not-found', 'El servicio no existe.');

    let sessionNumber: number | null = null;
    if (input.treatmentId) {
      if (!treatment || treatment.clientId !== client.id || treatment.serviceId !== service.id) {
        throw new DomainError(
          'invalid-argument',
          'El tratamiento no corresponde a este cliente y servicio.',
          { field: 'treatmentId' },
        );
      }
      if (treatment.status !== 'ACTIVO') {
        throw new DomainError('failed-precondition', 'El tratamiento ya no está activo.', {
          field: 'treatmentId',
        });
      }
      sessionNumber = treatment.completedSessions + openInTreatment + 1;
      if (sessionNumber > treatment.plannedSessions) {
        throw new DomainError(
          'failed-precondition',
          'El tratamiento ya tiene todas sus sesiones agendadas.',
          { field: 'treatmentId' },
        );
      }
    }

    const request = {
      service,
      clientId: client.id,
      professionalId: input.professionalId,
      start: input.start,
    };
    const result = checkSlot(day.ctx, { ...request, roomId: input.roomId });
    if (!result.ok) throw slotError(day, result.conflict, request, Boolean(own));

    const professional = day.professionals.find((p) => p.id === input.professionalId)!;
    const room = day.rooms.find((r) => r.id === result.roomId)!;
    const id = tx.createAppointment({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      professionalId: professional.id,
      professionalName: professional.displayName,
      roomId: room.id,
      roomName: room.name,
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      treatmentId: input.treatmentId,
      sessionNumber,
      date: input.date,
      startAt: clinicDateTime(input.date, input.start),
      endAt: clinicDateTime(input.date, result.end),
      status: input.status,
      source: sourceOf(actor),
      cancelReason: null,
      bufferMin: service.bufferMin,
      notes: input.notes,
      priceCents: service.priceCents ?? null,
      paymentStatus: 'POR_COBRAR',
      paymentId: null,
      sessionRecorded: false,
      createdBy: actor.uid ?? null,
    });
    tx.addEvent(id, {
      type: 'CREADA',
      professionalId: professional.id,
      from: null,
      to: {
        status: input.status,
        date: input.date,
        start: input.start,
        professionalName: professional.displayName,
      },
      reason: null,
      actor: eventActor(actor),
    });
    // El profesional pasa a ver al cliente entre sus pacientes.
    tx.updateClient(client.id, { addProfessionalId: professional.id });
    return id;
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'appointment.create',
    entity: 'appointments',
    entityId: appointmentId,
  });
  return { appointmentId };
}

/* ---------- Horarios libres ---------- */

/**
 * Horarios libres de un día para un servicio. Lo usa el profesional, que no
 * puede leer las citas ajenas que ocupan camillas y cabinas: el servidor las
 * considera sin exponerlas. Con agenda propia, solo devuelve sus horarios.
 */
export async function listSlots(
  gateway: AppointmentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<ListSlotsResult> {
  const own = ownAgenda(actor);
  const input = parseInput(listSlotsInputSchema, data);
  const professionalId = own ?? input.professionalId;

  return gateway.run(async (tx) => {
    const [day, service, client] = await Promise.all([
      loadDay(tx, input.date, now),
      tx.getService(input.serviceId),
      input.clientId ? tx.getClient(input.clientId) : Promise.resolve(null),
    ]);
    if (!service) throw new DomainError('not-found', 'El servicio no existe.');
    // El cliente solo cuenta (para no superponer sus citas) si el actor puede verlo,
    // y solo se ignora una cita propia (la que se está reprogramando).
    const clientId =
      client && (!own || client.assignedProfessionalIds.includes(own)) ? client.id : null;
    const ignoreAppointmentId = day.ctx.appointments.some(
      (a) => a.id === input.ignoreAppointmentId && (!own || a.professionalId === own),
    )
      ? input.ignoreAppointmentId
      : null;
    return {
      slots: findSlots(day.ctx, { service, clientId, professionalId, ignoreAppointmentId }),
    };
  });
}

/* ---------- Reprogramar ---------- */

export async function rescheduleAppointment(
  gateway: AppointmentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<void> {
  const own = ownAgenda(actor);
  const input = parseInput(rescheduleAppointmentInputSchema, data);
  if (own && input.professionalId !== own) {
    throw new DomainError('permission-denied', OWN_AGENDA_ONLY, { field: 'professionalId' });
  }

  await gateway.run(async (tx) => {
    const current = await tx.getAppointment(input.appointmentId);
    if (!current) throw new DomainError('not-found', 'La cita no existe.');
    if (own && current.professionalId !== own) {
      throw new DomainError('permission-denied', 'Solo puedes reprogramar tus propias citas.');
    }
    const allowed = canReschedule(current);
    if (!allowed.ok) throw new DomainError('failed-precondition', allowed.reason);

    await tx.lockDay(input.date);
    if (current.date !== input.date) await tx.lockDay(current.date);
    const [day, service] = await Promise.all([
      loadDay(tx, input.date, now),
      tx.getService(current.serviceId),
    ]);
    if (!service) throw new DomainError('not-found', 'El servicio de la cita ya no existe.');

    const request = {
      service,
      clientId: current.clientId,
      professionalId: input.professionalId,
      start: input.start,
      ignoreAppointmentId: current.id,
    };
    const result = checkSlot(day.ctx, { ...request, roomId: input.roomId });
    if (!result.ok) throw slotError(day, result.conflict, request, Boolean(own));

    const professional = day.professionals.find((p) => p.id === input.professionalId)!;
    const room = day.rooms.find((r) => r.id === result.roomId)!;
    tx.updateAppointment(current.id, {
      professionalId: professional.id,
      professionalName: professional.displayName,
      roomId: room.id,
      roomName: room.name,
      date: input.date,
      startAt: clinicDateTime(input.date, input.start),
      endAt: clinicDateTime(input.date, result.end),
      bufferMin: service.bufferMin,
      // Un nuevo horario debe volver a confirmarse con el cliente.
      status: 'PENDIENTE',
    });
    tx.addEvent(current.id, {
      type: 'REPROGRAMADA',
      professionalId: professional.id,
      from: {
        status: current.status,
        date: current.date,
        start: timeOf(current.startAt),
        professionalName: current.professionalName,
      },
      to: {
        status: 'PENDIENTE',
        date: input.date,
        start: input.start,
        professionalName: professional.displayName,
      },
      reason: null,
      actor: eventActor(actor),
    });
    tx.updateClient(current.clientId, { addProfessionalId: professional.id });
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'appointment.reschedule',
    entity: 'appointments',
    entityId: input.appointmentId,
  });
}

/* ---------- Cambios de estado ---------- */

/** Efectos de entrar o salir de ATENDIDA / NO_ASISTIO sobre cliente y tratamiento. */
export function applyCounters(
  tx: BookingTx,
  appointment: StoredAppointment,
  from: AppointmentStatus,
  to: AppointmentStatus,
) {
  if (from === to) return;
  if (appointment.treatmentId) {
    if (to === 'ATENDIDA') tx.updateTreatment(appointment.treatmentId, { completedDelta: 1 });
    if (from === 'ATENDIDA') tx.updateTreatment(appointment.treatmentId, { completedDelta: -1 });
  }
  if (to === 'NO_ASISTIO') tx.updateClient(appointment.clientId, { noShowDelta: 1 });
  if (from === 'NO_ASISTIO') tx.updateClient(appointment.clientId, { noShowDelta: -1 });
  if (to === 'ATENDIDA')
    tx.updateClient(appointment.clientId, { lastVisitAt: appointment.startAt });
}

export async function changeAppointmentStatus(
  gateway: AppointmentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<void> {
  const input = parseInput(changeAppointmentStatusInputSchema, data);
  const target = APPOINTMENT_ACTION_TARGET[input.action];

  await gateway.run(async (tx) => {
    const current = await tx.getAppointment(input.appointmentId);
    if (!current) throw new DomainError('not-found', 'La cita no existe.');

    // El profesional confirma, cancela y registra asistencia solo de sus propias citas.
    if (input.action === 'CANCELAR' || input.action === 'CONFIRMAR') {
      requireRecordAccess(actor, 'appointments.manage', [current.professionalId]);
    } else {
      requireRecordAccess(actor, 'attendance.mark', [current.professionalId]);
    }

    const allowed = canApplyAction(current, input.action, now);
    if (!allowed.ok) throw new DomainError('failed-precondition', allowed.reason);

    tx.updateAppointment(current.id, {
      status: target,
      cancelReason: target === 'CANCELADA' ? input.reason : null,
    });
    tx.addEvent(current.id, {
      type: target as AppointmentEventType,
      professionalId: current.professionalId,
      from: { status: current.status },
      to: { status: target },
      reason: input.reason,
      actor: eventActor(actor),
    });
    applyCounters(tx, current, current.status, target);
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: `appointment.${input.action.toLowerCase()}`,
    entity: 'appointments',
    entityId: input.appointmentId,
  });
}

export async function correctAppointmentStatus(
  gateway: AppointmentsGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<void> {
  requirePermission(actor, 'appointments.correct');
  const input = parseInput(correctAppointmentStatusInputSchema, data);

  const changed = await gateway.run(async (tx) => {
    const current = await tx.getAppointment(input.appointmentId);
    if (!current) throw new DomainError('not-found', 'La cita no existe.');
    if (current.status === input.status) return false;
    if (input.status === 'CANCELADA' && current.paymentStatus === 'PAGADA') {
      throw new DomainError('failed-precondition', PAID_CANCEL_REASON);
    }

    // Volver a ocupar un horario liberado exige que siga libre.
    const reoccupies =
      BLOCKING_APPOINTMENT_STATUSES.includes(input.status) &&
      !BLOCKING_APPOINTMENT_STATUSES.includes(current.status);
    if (reoccupies) {
      await tx.lockDay(current.date);
      const [day, service] = await Promise.all([
        loadDay(tx, current.date, now),
        tx.getService(current.serviceId),
      ]);
      const booked = day.ctx.appointments.filter(
        (a) => a.id !== current.id && BLOCKING_APPOINTMENT_STATUSES.includes(a.status),
      );
      const mine = toBooked(current);
      const buffer = service?.bufferMin ?? mine.bufferMin;
      const clash = booked.find(
        (a) =>
          ((a.professionalId === mine.professionalId || a.roomId === mine.roomId) &&
            mine.start < a.end + a.bufferMin &&
            a.start < mine.end + buffer) ||
          (a.clientId === mine.clientId && mine.start < a.end && a.start < mine.end),
      );
      if (clash) {
        throw new DomainError(
          'failed-precondition',
          'Ese horario ya fue ocupado por otra cita. Reprograma la cita en lugar de corregir su estado.',
        );
      }
    }

    tx.updateAppointment(current.id, {
      status: input.status,
      cancelReason: input.status === 'CANCELADA' ? input.reason : null,
    });
    tx.addEvent(current.id, {
      type: 'CORREGIDA',
      professionalId: current.professionalId,
      from: { status: current.status },
      to: { status: input.status },
      reason: input.reason,
      actor: eventActor(actor),
    });
    applyCounters(tx, current, current.status, input.status);
    return true;
  });

  if (changed) {
    await gateway.audit({
      actor: auditActor(actor),
      action: 'appointment.correct',
      entity: 'appointments',
      entityId: input.appointmentId,
      meta: { status: input.status, reason: input.reason },
    });
  }
}
