import {
  appointmentClinicalInputSchema,
  canEditNote,
  canRecordSession,
  clientClinicalInputSchema,
  saveClinicalRecordInputSchema,
  saveTreatmentPlanInputSchema,
  sessionNoteInputSchema,
  treatmentClinicalInputSchema,
  type ClientClinicalView,
  type ClinicalActor,
  type RecordSessionResult,
  type SessionNoteView,
  type TreatmentClinicalView,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requireRecordAccess } from '../../core/guards';
import { applyCounters } from '../appointments/appointmentsService';
import { auditActor } from '../audit';
import type { ClinicalGateway, StoredNote, StoredPlan, StoredRecord } from './clinicalGateway';

/*
 * Acceso a la información clínica:
 * - la administración, a toda;
 * - el profesional, a la de los pacientes que tiene asignados;
 * - la recepción, nunca (no tiene permisos `clinical.*`).
 * Cada lectura y cada escritura quedan en la auditoría.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function clinicalActor(actor: Actor): ClinicalActor {
  return { uid: actor.uid ?? null, name: actor.name ?? null };
}

function noteView(n: StoredNote): SessionNoteView {
  return { ...n, createdAt: iso(n.createdAt), updatedAt: iso(n.updatedAt) };
}

function recordView(r: StoredRecord | null) {
  return r
    ? {
        background: r.background,
        alerts: r.alerts,
        updatedAt: iso(r.updatedAt),
        updatedBy: r.updatedBy,
      }
    : null;
}

function planView(p: StoredPlan | null) {
  return p
    ? {
        assessment: p.assessment,
        goals: p.goals,
        indications: p.indications,
        updatedAt: iso(p.updatedAt),
        updatedBy: p.updatedBy,
      }
    : null;
}

async function loadClient(gateway: ClinicalGateway, clientId: string) {
  const client = await gateway.getClient(clientId);
  if (!client) throw new DomainError('not-found', 'El cliente no existe.');
  return client;
}

async function loadTreatment(gateway: ClinicalGateway, treatmentId: string) {
  const treatment = await gateway.getTreatment(treatmentId);
  if (!treatment) throw new DomainError('not-found', 'El tratamiento no existe.');
  const client = await loadClient(gateway, treatment.clientId);
  return { treatment, client };
}

async function auditRead(gateway: ClinicalGateway, actor: Actor, entityId: string, scope: string) {
  await gateway.audit({
    actor: auditActor(actor),
    action: 'clinical.read',
    entity: 'clinicalRecords',
    entityId,
    meta: { scope },
  });
}

/* ---------- Lecturas (auditadas) ---------- */

export async function getClientClinical(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
): Promise<ClientClinicalView> {
  const { clientId } = parseInput(clientClinicalInputSchema, data);
  const client = await loadClient(gateway, clientId);
  requireRecordAccess(actor, 'clinical.read', client.assignedProfessionalIds);

  const [record, notes] = await Promise.all([
    gateway.getRecord(clientId),
    gateway.listNotes(clientId),
  ]);
  await auditRead(gateway, actor, clientId, 'client');
  return { record: recordView(record), notes: notes.map(noteView) };
}

export async function getTreatmentClinical(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
): Promise<TreatmentClinicalView> {
  const { treatmentId } = parseInput(treatmentClinicalInputSchema, data);
  const { treatment, client } = await loadTreatment(gateway, treatmentId);
  requireRecordAccess(actor, 'clinical.read', [
    treatment.professionalId,
    ...client.assignedProfessionalIds,
  ]);

  const [plan, notes, record] = await Promise.all([
    gateway.getPlan(client.id, treatmentId),
    gateway.listNotes(client.id, treatmentId),
    gateway.getRecord(client.id),
  ]);
  await auditRead(gateway, actor, client.id, `treatment:${treatmentId}`);
  return { plan: planView(plan), notes: notes.map(noteView), alerts: record?.alerts ?? null };
}

/** Nota de una cita (para verla o editarla desde la agenda). */
export async function getSessionNote(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
): Promise<{ note: SessionNoteView | null; alerts: string | null }> {
  const { appointmentId } = parseInput(appointmentClinicalInputSchema, data);
  const appointment = await gateway.getAppointment(appointmentId);
  if (!appointment) throw new DomainError('not-found', 'La cita no existe.');
  const client = await loadClient(gateway, appointment.clientId);
  requireRecordAccess(actor, 'clinical.read', [
    appointment.professionalId,
    ...client.assignedProfessionalIds,
  ]);

  const [note, record] = await Promise.all([
    gateway.getNote(client.id, appointmentId),
    gateway.getRecord(client.id),
  ]);
  await auditRead(gateway, actor, client.id, `appointment:${appointmentId}`);
  return { note: note ? noteView(note) : null, alerts: record?.alerts ?? null };
}

/* ---------- Escrituras ---------- */

export async function saveClinicalRecord(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  const input = parseInput(saveClinicalRecordInputSchema, data);
  const client = await loadClient(gateway, input.clientId);
  requireRecordAccess(actor, 'clinical.write', client.assignedProfessionalIds);
  await gateway.saveRecord(client.id, {
    background: input.background,
    alerts: input.alerts,
    updatedBy: clinicalActor(actor),
  });
  await gateway.audit({
    actor: auditActor(actor),
    action: 'clinical.record.save',
    entity: 'clinicalRecords',
    entityId: client.id,
  });
}

export async function saveTreatmentPlan(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  const input = parseInput(saveTreatmentPlanInputSchema, data);
  const { treatment, client } = await loadTreatment(gateway, input.treatmentId);
  // El plan lo define quien lleva el tratamiento (o la administración).
  requireRecordAccess(actor, 'clinical.write', [treatment.professionalId]);
  await gateway.savePlan(client.id, treatment.id, {
    assessment: input.assessment,
    goals: input.goals,
    indications: input.indications,
    updatedBy: clinicalActor(actor),
  });
  await gateway.audit({
    actor: auditActor(actor),
    action: 'clinical.plan.save',
    entity: 'clinicalRecords',
    entityId: client.id,
    meta: { treatmentId: treatment.id },
  });
}

/**
 * Registrar la sesión de una cita, en una sola transacción:
 * - si la cita estaba pendiente o confirmada, pasa a ATENDIDA (suma la sesión
 *   al tratamiento y registra la última visita, como al marcar asistencia);
 * - si ya estaba atendida, no se vuelve a contar;
 * - se guarda la nota clínica y la cita queda marcada como "sesión registrada".
 */
export async function recordSession(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<RecordSessionResult> {
  const input = parseInput(sessionNoteInputSchema, data);

  const result = await gateway.runSession(async (tx) => {
    const appointment = await tx.getAppointment(input.appointmentId);
    if (!appointment) throw new DomainError('not-found', 'La cita no existe.');
    // Solo el profesional de la cita (o la administración) escribe su sesión.
    requireRecordAccess(actor, 'clinical.write', [appointment.professionalId]);
    const allowed = canRecordSession(appointment, now);
    if (!allowed.ok) throw new DomainError('failed-precondition', allowed.reason);

    const [existing, treatment] = await Promise.all([
      tx.getNote(appointment.clientId, appointment.id),
      appointment.treatmentId ? tx.getTreatment(appointment.treatmentId) : Promise.resolve(null),
    ]);
    if (existing) {
      throw new DomainError(
        'already-exists',
        'Esta sesión ya está registrada. Edita la nota existente.',
      );
    }

    const previous = appointment.status;
    const completedBefore = treatment?.completedSessions ?? null;
    const markedAttended = previous !== 'ATENDIDA';
    tx.updateAppointment(appointment.id, {
      sessionRecorded: true,
      ...(markedAttended ? { status: 'ATENDIDA' as const, cancelReason: null } : {}),
    });
    if (markedAttended) {
      tx.addEvent(appointment.id, {
        type: 'ATENDIDA',
        professionalId: appointment.professionalId,
        from: { status: previous },
        to: { status: 'ATENDIDA' },
        reason: null,
        actor: {
          type: actor.type,
          uid: actor.uid ?? null,
          name: actor.name ?? null,
          channel: actor.channel,
        },
      });
      applyCounters(tx, appointment, previous, 'ATENDIDA');
    }
    tx.createNote(appointment.clientId, {
      appointmentId: appointment.id,
      treatmentId: appointment.treatmentId,
      sessionNumber: appointment.sessionNumber,
      date: appointment.date,
      serviceName: appointment.serviceName,
      professionalId: appointment.professionalId,
      professionalName: appointment.professionalName,
      observations: input.observations,
      evolution: input.evolution,
      recommendations: input.recommendations,
      painBefore: input.painBefore,
      painAfter: input.painAfter,
      createdBy: clinicalActor(actor),
    });

    return {
      clientId: appointment.clientId,
      markedAttended,
      completedSessions:
        completedBefore === null ? null : completedBefore + (markedAttended ? 1 : 0),
      plannedSessions: treatment?.plannedSessions ?? null,
    };
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'clinical.session.record',
    entity: 'clinicalRecords',
    entityId: result.clientId,
    meta: { appointmentId: input.appointmentId, markedAttended: result.markedAttended },
  });
  const { clientId: _c, ...out } = result;
  return out;
}

export async function updateSessionNote(
  gateway: ClinicalGateway,
  actor: Actor,
  data: unknown,
  now = new Date(),
): Promise<void> {
  const input = parseInput(sessionNoteInputSchema, data);
  const appointment = await gateway.getAppointment(input.appointmentId);
  if (!appointment) throw new DomainError('not-found', 'La cita no existe.');
  requireRecordAccess(actor, 'clinical.write', [appointment.professionalId]);
  const note = await gateway.getNote(appointment.clientId, appointment.id);
  if (!note) throw new DomainError('not-found', 'La sesión todavía no está registrada.');

  const allowed = canEditNote(
    note,
    { uid: actor.uid ?? '', isAdmin: actor.role === 'ADMINISTRADOR' },
    now,
  );
  if (!allowed.ok) throw new DomainError('permission-denied', allowed.reason);

  await gateway.updateNote(appointment.clientId, appointment.id, {
    observations: input.observations,
    evolution: input.evolution,
    recommendations: input.recommendations,
    painBefore: input.painBefore,
    painAfter: input.painAfter,
  });
  await gateway.audit({
    actor: auditActor(actor),
    action: 'clinical.session.update',
    entity: 'clinicalRecords',
    entityId: appointment.clientId,
    meta: { appointmentId: appointment.id },
  });
}
