import {
  buildClientSearchKeywords,
  createClientInputSchema,
  normalizeSearchText,
  setClientStatusInputSchema,
  updateClientInputSchema,
  type ClientData,
  type CreateClientResult,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requirePermission } from '../../core/guards';
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

export async function createClient(
  gateway: ClientsGateway,
  actor: Actor,
  data: unknown,
): Promise<CreateClientResult> {
  requirePermission(actor, 'clients.write');
  const input = parseInput(createClientInputSchema, data);
  const clientId = await gateway.create(toClientFields(input), actor.uid ?? null);
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
  requirePermission(actor, 'clients.write');
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
