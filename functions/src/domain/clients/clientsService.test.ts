import { beforeEach, describe, expect, it } from 'vitest';
import type { ClientStatus } from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type { ClientFields, ClientsGateway, StoredClient } from './clientsGateway';
import { createClient, setClientStatus, updateClient } from './clientsService';

class InMemoryClientsGateway implements ClientsGateway {
  clients = new Map<string, StoredClient>();
  ciIndex = new Map<string, string>();
  audits: AuditEntry[] = [];
  private seq = 0;

  private assertCiFree(ci: string, ownerId?: string) {
    const existing = this.ciIndex.get(ci);
    if (existing && existing !== ownerId) {
      throw new DomainError(
        'already-exists',
        'Ya existe un cliente registrado con este número de carnet.',
        {
          field: 'ci',
          clientId: existing,
        },
      );
    }
  }
  async create(fields: ClientFields, _createdBy: string | null, assigned: string[] = []) {
    this.assertCiFree(fields.ci);
    const id = `cli-${++this.seq}`;
    this.ciIndex.set(fields.ci, id);
    this.clients.set(id, {
      id,
      ...fields,
      status: 'ACTIVO',
      assignedProfessionalIds: [...assigned],
    });
    return id;
  }
  async assignProfessional(id: string, professionalId: string) {
    const c = this.clients.get(id)!;
    const ids = new Set([...(c.assignedProfessionalIds ?? []), professionalId]);
    this.clients.set(id, { ...c, assignedProfessionalIds: [...ids] });
  }
  async get(id: string) {
    return this.clients.get(id) ?? null;
  }
  async update(id: string, fields: ClientFields, previousCi: string) {
    if (fields.ci !== previousCi) {
      this.assertCiFree(fields.ci, id);
      this.ciIndex.delete(previousCi);
      this.ciIndex.set(fields.ci, id);
    }
    this.clients.set(id, { ...this.clients.get(id)!, ...fields });
  }
  async setStatus(id: string, status: ClientStatus) {
    this.clients.set(id, { ...this.clients.get(id)!, status });
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

const recep: Actor = { type: 'USER', uid: 'u-recep', role: 'RECEPCIONISTA', channel: 'web' };
const prof: Actor = {
  type: 'USER',
  uid: 'u-prof',
  role: 'PROFESIONAL',
  professionalId: 'p1',
  channel: 'web',
};

const carla = {
  firstName: 'Carla',
  lastName: 'Rojas Vda.',
  ci: '3400000',
  ciExt: 'CB',
  phone: '71234567',
};

describe('clientsService', () => {
  let gw: InMemoryClientsGateway;
  beforeEach(() => {
    gw = new InMemoryClientsGateway();
  });

  it('registra un cliente con campos derivados y auditoría', async () => {
    const { clientId } = await createClient(gw, recep, carla);
    const stored = gw.clients.get(clientId)!;
    expect(stored).toMatchObject({
      firstName: 'Carla',
      phoneE164: '+59171234567',
      lastNameLower: 'rojas vda. carla',
      status: 'ACTIVO',
    });
    expect(stored.searchKeywords).toEqual(expect.arrayContaining(['car', 'roj', '340', '712']));
    expect(gw.audits.at(-1)).toMatchObject({ action: 'client.create', entityId: clientId });
  });

  it('rechaza un CI duplicado e indica el cliente existente', async () => {
    const { clientId } = await createClient(gw, recep, carla);
    await expect(createClient(gw, recep, { ...carla, firstName: 'Otra' })).rejects.toMatchObject({
      code: 'already-exists',
      details: { field: 'ci', clientId },
    });
  });

  it('el PROFESIONAL registra pacientes que quedan asignados a su ficha', async () => {
    const { clientId, linked } = await createClient(gw, prof, carla);
    expect(linked).toBeUndefined();
    expect(gw.clients.get(clientId)?.assignedProfessionalIds).toEqual(['p1']);
    expect(gw.audits.at(-1)).toMatchObject({ action: 'client.create', entityId: clientId });
  });

  it('si el carnet ya existe con el mismo nombre, el PROFESIONAL lo suma a sus pacientes', async () => {
    const { clientId } = await createClient(gw, recep, carla);
    const res = await createClient(gw, prof, {
      ...carla,
      firstName: 'CARLA',
      lastName: 'Rojas vda.',
    });
    expect(res).toEqual({ clientId, linked: true });
    expect(gw.clients.get(clientId)?.assignedProfessionalIds).toEqual(['p1']);
    expect(gw.audits.at(-1)).toMatchObject({ action: 'client.link', entityId: clientId });
  });

  it('si el carnet ya existe con otro nombre, el PROFESIONAL no ve al cliente ajeno', async () => {
    await createClient(gw, recep, carla);
    const err = await createClient(gw, prof, { ...carla, firstName: 'Luis' }).catch((e) => e);
    expect(err).toMatchObject({ code: 'already-exists', details: { field: 'ci' } });
    expect(err.details.clientId).toBeUndefined();
  });

  it('el PROFESIONAL sin ficha vinculada no registra pacientes', async () => {
    const sinFicha: Actor = { ...prof, professionalId: undefined };
    await expect(createClient(gw, sinFicha, carla)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('el PROFESIONAL edita solo a sus pacientes y no los desactiva', async () => {
    const mine = await createClient(gw, prof, carla);
    const other = await createClient(gw, recep, { ...carla, ci: '5500000', firstName: 'Luis' });
    await expect(
      updateClient(gw, prof, { clientId: mine.clientId, ...carla, email: 'c@correo.bo' }),
    ).resolves.toBeUndefined();
    await expect(
      updateClient(gw, prof, { clientId: other.clientId, ...carla, ci: '5500000' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      setClientStatus(gw, prof, { clientId: mine.clientId, status: 'INACTIVO' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('valida los datos con el esquema compartido', async () => {
    await expect(createClient(gw, recep, { ...carla, phone: '12' })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Ingresa un celular de 8 dígitos o un fijo de 7.',
    });
  });

  it('al cambiar el CI mueve el índice y libera el anterior', async () => {
    const { clientId } = await createClient(gw, recep, carla);
    await updateClient(gw, recep, { clientId, ...carla, ci: '5500000' });
    expect(gw.ciIndex.get('5500000')).toBe(clientId);
    expect(gw.ciIndex.has('3400000')).toBe(false);
    // El CI liberado puede usarse para otro cliente.
    await expect(createClient(gw, recep, { ...carla, firstName: 'Luis' })).resolves.toBeDefined();
  });

  it('no permite cambiar el CI a uno que ya usa otro cliente', async () => {
    const a = await createClient(gw, recep, carla);
    await createClient(gw, recep, { ...carla, ci: '5500000', firstName: 'Luis' });
    await expect(
      updateClient(gw, recep, { clientId: a.clientId, ...carla, ci: '5500000' }),
    ).rejects.toMatchObject({
      code: 'already-exists',
    });
  });

  it('solo audita los campos que cambiaron', async () => {
    const { clientId } = await createClient(gw, recep, carla);
    await updateClient(gw, recep, { clientId, ...carla, email: 'carla@correo.bo' });
    expect(gw.audits.at(-1)).toMatchObject({
      action: 'client.update',
      meta: { fields: ['email'] },
    });
    const before = gw.audits.length;
    await updateClient(gw, recep, { clientId, ...carla, email: 'carla@correo.bo' });
    expect(gw.audits.length).toBe(before);
  });

  it('desactiva y reactiva sin borrar el historial', async () => {
    const { clientId } = await createClient(gw, recep, carla);
    await setClientStatus(gw, recep, { clientId, status: 'INACTIVO' });
    expect(gw.clients.get(clientId)?.status).toBe('INACTIVO');
    expect(gw.audits.at(-1)?.action).toBe('client.deactivate');
    await setClientStatus(gw, recep, { clientId, status: 'ACTIVO' });
    expect(gw.audits.at(-1)?.action).toBe('client.activate');
  });

  it('responde not-found para clientes inexistentes', async () => {
    await expect(
      setClientStatus(gw, recep, { clientId: 'nadie', status: 'INACTIVO' }),
    ).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});
