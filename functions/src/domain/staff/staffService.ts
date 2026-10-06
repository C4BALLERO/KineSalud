import {
  addExceptionInputSchema,
  createProfessionalInputSchema,
  daysOutsideHours,
  exceptionsOverlap,
  formatWeekdays,
  linkAccountInputSchema,
  professionalDisplayName,
  removeExceptionInputSchema,
  setProfessionalActiveInputSchema,
  setMyServicesInputSchema,
  setScheduleInputSchema,
  toDateKey,
  updateProfessionalInputSchema,
  type AddExceptionResult,
  type CreateProfessionalResult,
  type ProfessionalData,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requirePermission } from '../../core/guards';
import { auditActor } from '../audit';
import type { UsersGateway } from '../users/usersGateway';
import { claimsOf } from '../users/usersService';
import type { StaffGateway, StoredProfessional } from './staffGateway';

async function loadProfessional(gateway: StaffGateway, id: string): Promise<StoredProfessional> {
  const professional = await gateway.getProfessional(id);
  if (!professional) throw new DomainError('not-found', 'El profesional no existe.');
  return professional;
}

/** Los servicios deben existir y pertenecer a las áreas del profesional. */
async function assertServices(
  gateway: StaffGateway,
  data: Pick<ProfessionalData, 'categories' | 'serviceIds'>,
): Promise<void> {
  if (data.serviceIds.length === 0) return;
  const services = await gateway.getServices(data.serviceIds);
  if (services.length !== data.serviceIds.length) {
    throw new DomainError('invalid-argument', 'Uno de los servicios elegidos ya no existe.', {
      field: 'serviceIds',
    });
  }
  const outside = services.find((s) => !data.categories.includes(s.category));
  if (outside) {
    throw new DomainError(
      'invalid-argument',
      `"${outside.name}" no pertenece a las áreas de atención elegidas.`,
      { field: 'serviceIds' },
    );
  }
}

const profileFields = (data: ProfessionalData) => ({
  ...data,
  displayName: professionalDisplayName(data),
});

const TRACKED = [
  'title',
  'firstName',
  'lastName',
  'phone',
  'categories',
  'specialties',
  'serviceIds',
] as const;

export async function createProfessional(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<CreateProfessionalResult> {
  requirePermission(actor, 'staff.manage');
  const input = parseInput(createProfessionalInputSchema, data);
  await assertServices(gateway, input);
  const professionalId = await gateway.createProfessional({
    ...profileFields(input),
    active: true,
    userId: null,
    weeklySchedule: {},
  });
  await gateway.audit({
    actor: auditActor(actor),
    action: 'professional.create',
    entity: 'professionals',
    entityId: professionalId,
  });
  return { professionalId };
}

export async function updateProfessional(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  const { professionalId, ...input } = parseInput(updateProfessionalInputSchema, data);
  const current = await loadProfessional(gateway, professionalId);
  await assertServices(gateway, input);

  const changed = TRACKED.filter(
    (k) => JSON.stringify(current[k] ?? null) !== JSON.stringify(input[k]),
  );
  if (changed.length === 0) return;

  await gateway.updateProfessional(professionalId, profileFields(input));
  await gateway.audit({
    actor: auditActor(actor),
    action: 'professional.update',
    entity: 'professionals',
    entityId: professionalId,
    meta: { fields: changed },
  });
}

/**
 * El profesional elige qué servicios ofrece, dentro de sus áreas de atención
 * (las áreas las define la administración). Solo esos servicios se le pueden
 * agendar.
 */
export async function setMyServices(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  if (!actor.role || !actor.professionalId) {
    throw new DomainError(
      'permission-denied',
      'Tu cuenta no está vinculada a una ficha de profesional. Pide a la administración que la vincule.',
    );
  }
  const { serviceIds } = parseInput(setMyServicesInputSchema, data);
  const current = await loadProfessional(gateway, actor.professionalId);
  await assertServices(gateway, { categories: current.categories, serviceIds });

  const sorted = (ids: readonly string[]) => [...ids].sort().join(',');
  if (sorted(current.serviceIds) === sorted(serviceIds)) return;

  await gateway.updateProfessional(current.id, { serviceIds });
  await gateway.audit({
    actor: auditActor(actor),
    action: 'professional.services',
    entity: 'professionals',
    entityId: current.id,
    meta: {
      added: serviceIds.filter((id) => !current.serviceIds.includes(id)),
      removed: current.serviceIds.filter((id) => !serviceIds.includes(id)),
    },
  });
}

export async function setProfessionalActive(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  const { professionalId, active } = parseInput(setProfessionalActiveInputSchema, data);
  const current = await loadProfessional(gateway, professionalId);
  if (current.active === active) return;

  await gateway.updateProfessional(professionalId, { active });
  await gateway.audit({
    actor: auditActor(actor),
    action: active ? 'professional.activate' : 'professional.deactivate',
    entity: 'professionals',
    entityId: professionalId,
  });
}

export async function setSchedule(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  const { professionalId, weeklySchedule } = parseInput(setScheduleInputSchema, data);
  await loadProfessional(gateway, professionalId);

  const opening = await gateway.getOpeningHours();
  if (opening) {
    const outside = daysOutsideHours(weeklySchedule, opening);
    if (outside.length > 0) {
      throw new DomainError(
        'invalid-argument',
        `El horario del ${formatWeekdays(outside).toLowerCase()} sale del horario de atención del consultorio.`,
        { field: 'weeklySchedule', days: outside },
      );
    }
  }

  await gateway.updateProfessional(professionalId, { weeklySchedule });
  await gateway.audit({
    actor: auditActor(actor),
    action: 'professional.schedule',
    entity: 'professionals',
    entityId: professionalId,
  });
}

export async function addException(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<AddExceptionResult> {
  requirePermission(actor, 'staff.manage');
  const input = parseInput(addExceptionInputSchema, data);
  await loadProfessional(gateway, input.professionalId);

  const existing = await gateway.listExceptions(input.professionalId, input.dateFrom);
  if (existing.some((e) => exceptionsOverlap(e, input))) {
    throw new DomainError(
      'failed-precondition',
      'Ya hay una ausencia registrada que se superpone con esas fechas.',
      { field: 'dateFrom' },
    );
  }

  const exceptionId = await gateway.addException({ ...input, createdBy: actor.uid ?? null });
  const affectedAppointments = await gateway.countActiveAppointments(
    input.professionalId,
    input.dateFrom,
    input.dateTo,
  );
  await gateway.audit({
    actor: auditActor(actor),
    action: 'professional.exception.add',
    entity: 'professionalExceptions',
    entityId: exceptionId,
    meta: { professionalId: input.professionalId, type: input.type },
  });
  return { exceptionId, affectedAppointments };
}

export async function removeException(
  gateway: StaffGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  const { exceptionId } = parseInput(removeExceptionInputSchema, data);
  const exception = await gateway.getException(exceptionId);
  if (!exception) throw new DomainError('not-found', 'La ausencia ya no existe.');
  if (exception.dateTo < toDateKey(new Date())) {
    throw new DomainError(
      'failed-precondition',
      'Esa ausencia ya terminó y forma parte del historial.',
    );
  }

  await gateway.deleteException(exceptionId);
  await gateway.audit({
    actor: auditActor(actor),
    action: 'professional.exception.remove',
    entity: 'professionalExceptions',
    entityId: exceptionId,
    meta: { professionalId: exception.professionalId },
  });
}

/**
 * Vincula una cuenta de acceso a la ficha (o la desvincula con `uid: null`).
 * Actualiza el claim `professionalId` de las cuentas afectadas; la web lo
 * detecta y refresca el token sin cerrar la sesión.
 */
export async function linkAccount(
  staff: StaffGateway,
  users: UsersGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  requirePermission(actor, 'users.manage');
  const { professionalId, uid } = parseInput(linkAccountInputSchema, data);
  const professional = await loadProfessional(staff, professionalId);
  if (professional.userId === uid) return;

  const next = uid ? await users.getUser(uid) : null;
  if (uid && !next) throw new DomainError('not-found', 'La cuenta no existe.');
  if (next) {
    if (next.role === 'RECEPCIONISTA') {
      throw new DomainError(
        'failed-precondition',
        'Solo las cuentas de profesionales o administradores pueden vincularse a una ficha.',
        { field: 'uid' },
      );
    }
    if (!next.active) {
      throw new DomainError('failed-precondition', 'La cuenta está desactivada.', {
        field: 'uid',
      });
    }
    if (next.professionalId && next.professionalId !== professionalId) {
      throw new DomainError(
        'already-exists',
        'Esta cuenta ya está vinculada a otra ficha de profesional.',
        { field: 'uid' },
      );
    }
  }

  const previous = professional.userId ? await users.getUser(professional.userId) : null;
  if (previous && previous.professionalId === professionalId) {
    const unlinked = {
      ...previous,
      professionalId: null,
      claimsVersion: previous.claimsVersion + 1,
    };
    await users.setClaims(unlinked.uid, claimsOf(unlinked));
    await users.saveUser(unlinked, { isNew: false });
  }
  if (next) {
    const linked = { ...next, professionalId, claimsVersion: next.claimsVersion + 1 };
    await users.setClaims(linked.uid, claimsOf(linked));
    await users.saveUser(linked, { isNew: false });
  }

  await staff.updateProfessional(professionalId, { userId: uid });
  await staff.audit({
    actor: auditActor(actor),
    action: uid ? 'professional.linkAccount' : 'professional.unlinkAccount',
    entity: 'professionals',
    entityId: professionalId,
    meta: { uid, previousUid: professional.userId },
  });
}
