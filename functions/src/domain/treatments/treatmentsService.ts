import {
  canApplyTreatmentAction,
  changeTreatmentStatusInputSchema,
  createTreatmentInputSchema,
  minPlannedSessions,
  permissionScope,
  TREATMENT_ACTION_TARGET,
  treatmentActionNeedsReason,
  updateTreatmentInputSchema,
  type CreateTreatmentResult,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requireRecordAccess } from '../../core/guards';
import { auditActor } from '../audit';
import type {
  StoredTreatment,
  TreatmentProfessionalRef,
  TreatmentsGateway,
  TreatmentsTx,
} from './treatmentsGateway';

function isOwnScope(actor: Actor): boolean {
  return (
    !!actor.role &&
    permissionScope(
      { role: actor.role, professionalId: actor.professionalId },
      'treatments.manage',
    ) === 'own'
  );
}

/** El profesional debe estar activo y realizar el servicio del tratamiento. */
function assertProfessionalFor(
  professional: TreatmentProfessionalRef | null,
  serviceId: string,
  serviceName: string,
): TreatmentProfessionalRef {
  if (!professional || !professional.active) {
    throw new DomainError('failed-precondition', 'El profesional no existe o está inactivo.', {
      field: 'professionalId',
    });
  }
  if (!professional.serviceIds.includes(serviceId)) {
    throw new DomainError(
      'failed-precondition',
      `${professional.displayName} no realiza «${serviceName}». Elige otro profesional o agrega el servicio a su ficha.`,
      { field: 'professionalId' },
    );
  }
  return professional;
}

/** Un cliente no tiene dos tratamientos activos del mismo servicio. */
async function assertNoActiveDuplicate(
  tx: TreatmentsTx,
  clientId: string,
  serviceId: string,
  serviceName: string,
  selfId: string | null,
) {
  const existing = (await tx.getClientTreatments(clientId)).find(
    (t) => t.id !== selfId && t.serviceId === serviceId && t.status === 'ACTIVO',
  );
  if (existing) {
    throw new DomainError(
      'already-exists',
      `El cliente ya tiene un tratamiento activo de «${serviceName}». Continúa ese o finalízalo antes de abrir otro.`,
      { field: 'serviceId', treatmentId: existing.id },
    );
  }
}

/* ---------- Crear ---------- */

export async function createTreatment(
  gateway: TreatmentsGateway,
  actor: Actor,
  data: unknown,
): Promise<CreateTreatmentResult> {
  const input = parseInput(createTreatmentInputSchema, data);
  // Con alcance propio, el profesional solo abre tratamientos a su nombre.
  requireRecordAccess(actor, 'treatments.manage', [input.professionalId]);

  const treatmentId = await gateway.run(async (tx) => {
    const [client, service, professional] = await Promise.all([
      tx.getClient(input.clientId),
      tx.getService(input.serviceId),
      tx.getProfessional(input.professionalId),
    ]);
    if (!client) throw new DomainError('not-found', 'El cliente no existe.');
    if (isOwnScope(actor) && !client.assignedProfessionalIds.includes(actor.professionalId ?? '')) {
      throw new DomainError('permission-denied', 'Solo puedes abrir tratamientos a tus pacientes.');
    }
    if (client.status !== 'ACTIVO') {
      throw new DomainError(
        'failed-precondition',
        'El cliente está inactivo. Reactívalo desde su perfil para abrirle un tratamiento.',
        { field: 'clientId' },
      );
    }
    if (!service || !service.active) {
      throw new DomainError('failed-precondition', 'El servicio no existe o está inactivo.', {
        field: 'serviceId',
      });
    }
    const pro = assertProfessionalFor(professional, service.id, service.name);
    await assertNoActiveDuplicate(tx, client.id, service.id, service.name, null);

    const id = tx.createTreatment({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      professionalId: pro.id,
      professionalName: pro.displayName,
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      startDate: input.startDate,
      plannedSessions: input.plannedSessions,
      completedSessions: 0,
      status: 'ACTIVO',
      statusReason: null,
      notes: input.notes,
      createdBy: actor.uid ?? null,
    });
    tx.updateClient(client.id, { addProfessionalId: pro.id, activeDelta: 1 });
    return id;
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'treatment.create',
    entity: 'treatments',
    entityId: treatmentId,
  });
  return { treatmentId };
}

/* ---------- Editar ---------- */

async function loadTreatment(tx: TreatmentsTx, id: string): Promise<StoredTreatment> {
  const t = await tx.getTreatment(id);
  if (!t) throw new DomainError('not-found', 'El tratamiento no existe.');
  return t;
}

export async function updateTreatment(
  gateway: TreatmentsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  const input = parseInput(updateTreatmentInputSchema, data);

  await gateway.run(async (tx) => {
    const current = await loadTreatment(tx, input.treatmentId);
    requireRecordAccess(actor, 'treatments.manage', [current.professionalId]);
    requireRecordAccess(actor, 'treatments.manage', [input.professionalId]);
    if (current.status === 'FINALIZADO') {
      throw new DomainError(
        'failed-precondition',
        'El tratamiento está finalizado. Reactívalo para editarlo.',
      );
    }

    const changesProfessional = input.professionalId !== current.professionalId;
    const [open, professional] = await Promise.all([
      tx.countOpenAppointments(current.id),
      changesProfessional ? tx.getProfessional(input.professionalId) : Promise.resolve(null),
    ]);
    const min = minPlannedSessions(current.completedSessions, open);
    if (input.plannedSessions < min) {
      throw new DomainError(
        'invalid-argument',
        `Mínimo ${min}: ya hay ${current.completedSessions} ${current.completedSessions === 1 ? 'sesión realizada' : 'sesiones realizadas'} y ${open} ${open === 1 ? 'agendada' : 'agendadas'}.`,
        { field: 'plannedSessions' },
      );
    }
    const pro = changesProfessional
      ? assertProfessionalFor(professional, current.serviceId, current.serviceName)
      : null;

    tx.updateTreatment(current.id, {
      plannedSessions: input.plannedSessions,
      notes: input.notes,
      ...(pro ? { professionalId: pro.id, professionalName: pro.displayName } : {}),
    });
    if (pro) tx.updateClient(current.clientId, { addProfessionalId: pro.id });
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: 'treatment.update',
    entity: 'treatments',
    entityId: input.treatmentId,
  });
}

/* ---------- Estado ---------- */

export async function changeTreatmentStatus(
  gateway: TreatmentsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  const input = parseInput(changeTreatmentStatusInputSchema, data);
  const target = TREATMENT_ACTION_TARGET[input.action];

  await gateway.run(async (tx) => {
    const current = await loadTreatment(tx, input.treatmentId);
    requireRecordAccess(actor, 'treatments.manage', [current.professionalId]);
    const open = await tx.countOpenAppointments(current.id);

    const allowed = canApplyTreatmentAction(current, input.action, open);
    if (!allowed.ok) throw new DomainError('failed-precondition', allowed.reason);
    if (treatmentActionNeedsReason(current, input.action) && !input.reason) {
      throw new DomainError('invalid-argument', 'Indica el motivo.', { field: 'reason' });
    }
    if (target === 'ACTIVO') {
      const client = await tx.getClient(current.clientId);
      if (client?.status !== 'ACTIVO') {
        throw new DomainError(
          'failed-precondition',
          'El cliente está inactivo. Reactívalo desde su perfil antes de reactivar el tratamiento.',
        );
      }
      await assertNoActiveDuplicate(
        tx,
        current.clientId,
        current.serviceId,
        current.serviceName,
        current.id,
      );
    }

    const delta = (target === 'ACTIVO' ? 1 : 0) - (current.status === 'ACTIVO' ? 1 : 0);
    tx.updateTreatment(current.id, {
      status: target,
      statusReason: input.reason,
      statusChanged: true,
    });
    if (delta !== 0) tx.updateClient(current.clientId, { activeDelta: delta });
  });

  await gateway.audit({
    actor: auditActor(actor),
    action: `treatment.${input.action.toLowerCase()}`,
    entity: 'treatments',
    entityId: input.treatmentId,
    meta: input.reason ? { reason: input.reason } : undefined,
  });
}
