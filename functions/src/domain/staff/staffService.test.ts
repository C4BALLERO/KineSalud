import { addDays, toDateKey, type AuthClaims, type ProfessionalDoc } from '@kinesalud/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type { StoredUser, UsersGateway } from '../users/usersGateway';
import type { StaffGateway, StoredException, StoredProfessional } from './staffGateway';
import {
  addException,
  createProfessional,
  linkAccount,
  removeException,
  setMyServices,
  setSchedule,
  updateProfessional,
} from './staffService';

class InMemoryStaff implements StaffGateway {
  professionals = new Map<string, StoredProfessional>();
  exceptions = new Map<string, StoredException>();
  services = [
    { id: 'srv-fisio', name: 'Fisioterapia lumbar', category: 'FISIOTERAPIA' as const },
    { id: 'srv-facial', name: 'Limpieza facial', category: 'ESTETICA' as const },
    { id: 'srv-cervical', name: 'Fisioterapia cervical', category: 'FISIOTERAPIA' as const },
  ];
  opening: ProfessionalDoc['weeklySchedule'] | null = {
    mon: [{ start: '08:00', end: '12:00' }],
  };
  activeAppointments = 0;
  audits: AuditEntry[] = [];
  private seq = 0;

  async getProfessional(id: string) {
    return this.professionals.get(id) ?? null;
  }
  async createProfessional(doc: ProfessionalDoc) {
    const id = `pro-${++this.seq}`;
    this.professionals.set(id, { id, ...doc });
    return id;
  }
  async updateProfessional(id: string, changes: Partial<ProfessionalDoc>) {
    this.professionals.set(id, { ...this.professionals.get(id)!, ...changes });
  }
  async getServices(ids: string[]) {
    return this.services.filter((s) => ids.includes(s.id));
  }
  async getOpeningHours() {
    return this.opening;
  }
  async listExceptions(professionalId: string, fromDate: string) {
    return [...this.exceptions.values()].filter(
      (e) => e.professionalId === professionalId && e.dateTo >= fromDate,
    );
  }
  async getException(id: string) {
    return this.exceptions.get(id) ?? null;
  }
  async addException(doc: Omit<StoredException, 'id'>) {
    const id = `exc-${++this.seq}`;
    this.exceptions.set(id, { id, ...doc });
    return id;
  }
  async deleteException(id: string) {
    this.exceptions.delete(id);
  }
  async countActiveAppointments() {
    return this.activeAppointments;
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

class InMemoryUsers implements Pick<UsersGateway, 'getUser' | 'setClaims' | 'saveUser'> {
  users = new Map<string, StoredUser>();
  claims = new Map<string, AuthClaims>();
  async getUser(uid: string) {
    return this.users.get(uid) ?? null;
  }
  async setClaims(uid: string, claims: AuthClaims) {
    this.claims.set(uid, claims);
  }
  async saveUser(user: StoredUser) {
    this.users.set(user.uid, user);
  }
}

const admin: Actor = { type: 'USER', uid: 'u-admin', role: 'ADMINISTRADOR', channel: 'web' };
const recep: Actor = { type: 'USER', uid: 'u-recep', role: 'RECEPCIONISTA', channel: 'web' };
const input = {
  title: 'Lic.',
  firstName: 'Diego',
  lastName: 'Pérez',
  phone: '71234567',
  categories: ['FISIOTERAPIA'],
  serviceIds: ['srv-fisio'],
};

function expectDomainError(promise: Promise<unknown>, code: string, message?: string | RegExp) {
  return expect(promise).rejects.toSatisfy((err: unknown) => {
    if (!(err instanceof DomainError) || err.code !== code) return false;
    if (message instanceof RegExp) return message.test(err.message);
    return message === undefined || err.message === message;
  });
}

let staff: InMemoryStaff;
let users: InMemoryUsers;
let proId: string;

beforeEach(async () => {
  staff = new InMemoryStaff();
  users = new InMemoryUsers();
  ({ professionalId: proId } = await createProfessional(staff, admin, input));
});

describe('fichas de profesionales', () => {
  it('crea la ficha activa, sin horario ni cuenta, con su nombre para la agenda', () => {
    expect(staff.professionals.get(proId)).toMatchObject({
      displayName: 'Lic. Diego Pérez',
      active: true,
      userId: null,
      weeklySchedule: {},
    });
    expect(staff.audits.at(-1)?.action).toBe('professional.create');
  });

  it('solo el administrador gestiona el personal', async () => {
    await expectDomainError(createProfessional(staff, recep, input), 'permission-denied');
  });

  it('rechaza servicios de un área que el profesional no atiende', async () => {
    await expectDomainError(
      createProfessional(staff, admin, { ...input, serviceIds: ['srv-facial'] }),
      'invalid-argument',
      /no pertenece a las áreas/,
    );
    await expectDomainError(
      createProfessional(staff, admin, { ...input, serviceIds: ['no-existe'] }),
      'invalid-argument',
    );
  });

  it('audita solo los campos que cambiaron', async () => {
    await updateProfessional(staff, admin, { ...input, professionalId: proId, phone: '71111111' });
    expect(staff.audits.at(-1)).toMatchObject({
      action: 'professional.update',
      meta: { fields: ['phone'] },
    });
    const count = staff.audits.length;
    await updateProfessional(staff, admin, { ...input, professionalId: proId, phone: '71111111' });
    expect(staff.audits).toHaveLength(count);
  });
});

describe('servicios que ofrece el profesional', () => {
  const self = (): Actor => ({
    type: 'USER',
    uid: 'u-diego',
    role: 'PROFESIONAL',
    professionalId: proId,
    channel: 'web',
  });

  it('marca sus servicios y audita qué agregó y qué quitó', async () => {
    await setMyServices(staff, self(), { serviceIds: ['srv-cervical', 'srv-cervical'] });
    expect(staff.professionals.get(proId)?.serviceIds).toEqual(['srv-cervical']);
    expect(staff.audits.at(-1)).toMatchObject({
      action: 'professional.services',
      entityId: proId,
      meta: { added: ['srv-cervical'], removed: ['srv-fisio'] },
    });
    const count = staff.audits.length;
    await setMyServices(staff, self(), { serviceIds: ['srv-cervical'] });
    expect(staff.audits).toHaveLength(count);
  });

  it('solo elige servicios de sus áreas de atención', async () => {
    await expectDomainError(
      setMyServices(staff, self(), { serviceIds: ['srv-facial'] }),
      'invalid-argument',
      /no pertenece a las áreas/,
    );
  });

  it('exige una cuenta vinculada a una ficha', async () => {
    await expectDomainError(
      setMyServices(staff, recep, { serviceIds: ['srv-fisio'] }),
      'permission-denied',
    );
  });
});

describe('horario', () => {
  it('guarda un horario dentro del horario del consultorio', async () => {
    await setSchedule(staff, admin, {
      professionalId: proId,
      weeklySchedule: { mon: [{ start: '08:00', end: '11:00' }] },
    });
    expect(staff.professionals.get(proId)?.weeklySchedule).toEqual({
      mon: [{ start: '08:00', end: '11:00' }],
    });
  });

  it('rechaza días fuera del horario de atención', async () => {
    await expectDomainError(
      setSchedule(staff, admin, {
        professionalId: proId,
        weeklySchedule: { tue: [{ start: '08:00', end: '11:00' }] },
      }),
      'invalid-argument',
      'El horario del martes sale del horario de atención del consultorio.',
    );
  });
});

describe('ausencias', () => {
  const today = toDateKey(new Date());

  it('registra la ausencia e informa las citas afectadas', async () => {
    staff.activeAppointments = 3;
    const result = await addException(staff, admin, {
      professionalId: proId,
      type: 'VACACIONES',
      dateFrom: addDays(today, 1),
      dateTo: addDays(today, 5),
    });
    expect(result.affectedAppointments).toBe(3);
    expect(staff.exceptions.get(result.exceptionId)?.type).toBe('VACACIONES');
  });

  it('no permite ausencias superpuestas', async () => {
    await addException(staff, admin, {
      professionalId: proId,
      type: 'VACACIONES',
      dateFrom: addDays(today, 1),
      dateTo: addDays(today, 5),
    });
    await expectDomainError(
      addException(staff, admin, {
        professionalId: proId,
        type: 'PERMISO',
        dateFrom: addDays(today, 5),
        dateTo: addDays(today, 6),
      }),
      'failed-precondition',
    );
  });

  it('las ausencias terminadas quedan en el historial', async () => {
    staff.exceptions.set('old', {
      id: 'old',
      professionalId: proId,
      type: 'PERMISO',
      dateFrom: addDays(today, -3),
      dateTo: addDays(today, -2),
    });
    await expectDomainError(
      removeException(staff, admin, { exceptionId: 'old' }),
      'failed-precondition',
    );
  });
});

describe('vincular cuenta', () => {
  const user = (uid: string, over: Partial<StoredUser> = {}): StoredUser => ({
    uid,
    displayName: uid,
    email: `${uid}@kinesalud.test`,
    role: 'PROFESIONAL',
    active: true,
    professionalId: null,
    claimsVersion: 1,
    ...over,
  });
  const link = (uid: string | null) =>
    linkAccount(staff, users as unknown as UsersGateway, admin, { professionalId: proId, uid });

  it('vincula la cuenta y actualiza su claim', async () => {
    users.users.set('u1', user('u1'));
    await link('u1');
    expect(staff.professionals.get(proId)?.userId).toBe('u1');
    expect(users.claims.get('u1')).toMatchObject({ professionalId: proId, cv: 2 });
  });

  it('al cambiar de cuenta, desvincula la anterior', async () => {
    users.users.set('u1', user('u1'));
    users.users.set('u2', user('u2'));
    await link('u1');
    await link('u2');
    expect(users.users.get('u1')?.professionalId).toBeNull();
    expect(users.claims.get('u1')?.professionalId).toBeNull();
    expect(users.users.get('u2')?.professionalId).toBe(proId);
    await link(null);
    expect(staff.professionals.get(proId)?.userId).toBeNull();
    expect(users.users.get('u2')?.professionalId).toBeNull();
  });

  it('rechaza recepción, cuentas inactivas y cuentas ya vinculadas', async () => {
    users.users.set('r', user('r', { role: 'RECEPCIONISTA' }));
    users.users.set('off', user('off', { active: false }));
    users.users.set('otra', user('otra', { professionalId: 'pro-otro' }));
    await expectDomainError(link('r'), 'failed-precondition');
    await expectDomainError(link('off'), 'failed-precondition');
    await expectDomainError(link('otra'), 'already-exists');
  });
});
