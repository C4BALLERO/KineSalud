import {
  buildClientSearchKeywords,
  createClientInputSchema,
  normalizeSearchText,
  permissionScope,
  setClientStatusInputSchema,
  updateClientInputSchema,
  type ClientData,
  type CreateClientResult,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import {
  parseInput,
  requireClinicWide,
  requirePermission,
  requireRecordAccess,
} from '../../core/guards';
import { auditActor } from '../audit';
import type { ClientFields, ClientsGateway } from './clientsGateway';

/** Deriva los campos almacenados (búsqueda, orden, E.164) a partir de los datos validados. */
export function toClientFields(data: ClientData): ClientFields {
  return {
    ...data,
    lastNameLower: normalizeSearchText(`${data.lastName} ${data.firstName}`),
    phoneE164: `+591${data.phone}`,
    searchKeywords: buildClientSearchKeywords(data),
  };
}

const TRACKED: (keyof ClientFields)[] = [
  'firstName',
  'lastName',
  'ci',
  'ciExt',
  'phone',
  'email',
  'birthDate',
  'address',
  'adminNotes',
];

/** El actor solo trabaja sobre sus propios pacientes (profesional sin alcance total). */
function ownProfessional(actor: Actor): string | null {
  if (!actor.role) return null;
  const scope = permissionScope(
    { role: actor.role, professionalId: actor.professionalId },
    'clients.write',
  );
  return scope === 'own' ? (actor.professionalId ?? null) : null;
}

const sameName = (a: { firstName: string; lastName: string }, b: typeof a) =>
  normalizeSearchText(`${a.firstName} ${a.lastName}`) ===
  normalizeSearchText(`${b.firstName} ${b.lastName}`);

export async function createClient(
  gateway: ClientsGateway,
  actor: Actor,
  data: unknown,
): Promise<CreateClientResult> {
  requirePermission(actor, 'clients.write');
  const own = ownProfessional(actor);
  if (actor.role === 'PROFESIONAL' && !own) {
    throw new DomainError(
      'permission-denied',
      'Tu cuenta no está vinculada a una ficha de profesional. Pide a la administración que la vincule.',
    );
  }
  const input = parseInput(createClientInputSchema, data);
  const fields = toClientFields(input);

  let clientId: string;
  try {
    // El profesional que registra a un paciente pasa a atenderlo.
    clientId = await gateway.create(fields, actor.uid ?? null, own ? [own] : []);
  } catch (err) {
    const existingId =
      err instanceof DomainError && err.code === 'already-exists'
        ? (err.details as { clientId?: string } | undefined)?.clientId
        : undefined;
    if (!own || !existingId) throw err;
    // El profesional no ve a los pacientes de otros: si el carnet ya existe con el
    // mismo nombre, se lo suma a sus pacientes en lugar de duplicarlo.
    const existing = await gateway.get(existingId);
    if (!existing || !sameName(existing, input)) {
      throw new DomainError(
        'already-exists',
        'Ese carnet ya está registrado con otro nombre. Revisa los datos o consulta con recepción.',
        { field: 'ci' },
      );
    }
    if (!existing.assignedProfessionalIds?.includes(own)) {
      await gateway.assignProfessional(existingId, own);
    }
    await gateway.audit({
      actor: auditActor(actor),
      action: 'client.link',
      entity: 'clients',
      entityId: existingId,
      meta: { professionalId: own },
    });
    return { clientId: existingId, linked: true };
  }

  await gateway.audit({
    actor: auditActor(actor),
    action: 'client.create',
    entity: 'clients',
    entityId: clientId,
  });
  return { clientId };
}

export async function updateClient(
  gateway: ClientsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'clients.write');
  const { clientId, ...input } = parseInput(updateClientInputSchema, data);
  const current = await gateway.get(clientId);
  if (!current) throw new DomainError('not-found', 'El cliente no existe.');
  // El profesional edita solo a sus pacientes.
  requireRecordAccess(actor, 'clients.write', current.assignedProfessionalIds ?? []);

  const fields = toClientFields(input);
  const changed = TRACKED.filter((k) => JSON.stringify(current[k]) !== JSON.stringify(fields[k]));
  if (changed.length === 0) return;

  await gateway.update(clientId, fields, current.ci);
  await gateway.audit({
    actor: auditActor(actor),
    action: 'client.update',
    entity: 'clients',
    entityId: clientId,
    meta: { fields: changed },
  });
}

export async function setClientStatus(
  gateway: ClientsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requireClinicWide(
    actor,
    'clients.write',
    'Solo recepción o administración pueden activar o desactivar clientes.',
  );
  const { clientId, status } = parseInput(setClientStatusInputSchema, data);
  const current = await gateway.get(clientId);
  if (!current) throw new DomainError('not-found', 'El cliente no existe.');
  if (current.status === status) return;

  await gateway.setStatus(clientId, status);
  await gateway.audit({
    actor: auditActor(actor),
    action: status === 'ACTIVO' ? 'client.activate' : 'client.deactivate',
    entity: 'clients',
    entityId: clientId,
  });
}
