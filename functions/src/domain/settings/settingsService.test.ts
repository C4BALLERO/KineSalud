import type { ClinicSettingsDoc, RoomDoc, ServiceDoc } from '@kinesalud/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { AuditEntry } from '../audit';
import type {
  ProfessionalSchedule,
  SettingsGateway,
  StoredRoom,
  StoredService,
} from './settingsGateway';
import { saveRoom, saveService, setRoomActive, updateClinicSettings } from './settingsService';

class InMemorySettings implements SettingsGateway {
  clinic: ClinicSettingsDoc | null = null;
  professionals: ProfessionalSchedule[] = [];
  rooms = new Map<string, StoredRoom>();
  services = new Map<string, StoredService>();
  audits: AuditEntry[] = [];
  private seq = 0;

  async saveClinic(doc: ClinicSettingsDoc) {
    this.clinic = doc;
  }
  async listProfessionals() {
    return this.professionals;
  }
  async listRooms() {
    return [...this.rooms.values()];
  }
  async saveRoom(id: string | null, doc: RoomDoc) {
    const roomId = id ?? `room-${++this.seq}`;
    this.rooms.set(roomId, { id: roomId, ...doc });
    return roomId;
  }
  async listServices() {
    return [...this.services.values()];
  }
  async saveService(id: string | null, doc: ServiceDoc) {
    const serviceId = id ?? `srv-${++this.seq}`;
    this.services.set(serviceId, { id: serviceId, ...doc });
    return serviceId;
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

const admin: Actor = { type: 'USER', uid: 'u-admin', role: 'ADMINISTRADOR', channel: 'web' };
const recep: Actor = { type: 'USER', uid: 'u-recep', role: 'RECEPCIONISTA', channel: 'web' };
const morning = [{ start: '08:00', end: '12:00' }];

let gw: InMemorySettings;
beforeEach(() => {
  gw = new InMemorySettings();
});

describe('horario del consultorio', () => {
  const input = { name: 'Kinesalud y Vida', slotMinutes: 15, reminderLeadHours: 24 };

  it('guarda y avisa qué profesionales quedan fuera del nuevo horario', async () => {
    gw.professionals = [
      {
        id: 'p1',
        displayName: 'Lic. Ana',
        active: true,
        weeklySchedule: { mon: morning },
        serviceIds: [],
        categories: [],
      },
      {
        id: 'p2',
        displayName: 'Lic. Jorge',
        active: true,
        weeklySchedule: { sat: morning },
        serviceIds: [],
        categories: [],
      },
    ];
    const result = await updateClinicSettings(gw, admin, {
      ...input,
      openingHours: { mon: morning },
    });
    expect(result.professionalsOutside).toEqual(['Lic. Jorge']);
    expect(gw.clinic?.timezone).toBe('America/La_Paz');
  });

  it('exige al menos un día de atención y permiso de administración', async () => {
    await expect(updateClinicSettings(gw, admin, { ...input, openingHours: {} })).rejects.toThrow(
      'El consultorio debe atender al menos un día.',
    );
    await expect(
      updateClinicSettings(gw, recep, { ...input, openingHours: { mon: morning } }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe('espacios', () => {
  const room = { name: 'Camilla 1', kind: 'CAMILLA', allowedCategories: ['FISIOTERAPIA'] };

  it('crea activo y rechaza nombres repetidos sin importar mayúsculas ni tildes', async () => {
    const { id } = await saveRoom(gw, admin, room);
    expect(gw.rooms.get(id)).toMatchObject({ active: true, capacity: 1 });
    await expect(saveRoom(gw, admin, { ...room, name: 'CAMILLA 1' })).rejects.toThrow(
      'Ya existe un espacio con ese nombre.',
    );
    // Guardar el mismo espacio con su nombre no es un duplicado.
    await expect(saveRoom(gw, admin, { ...room, roomId: id })).resolves.toEqual({ id });
  });

  it('desactivar conserva los datos y se audita', async () => {
    const { id } = await saveRoom(gw, admin, room);
    await setRoomActive(gw, admin, { id, active: false });
    expect(gw.rooms.get(id)).toMatchObject({ name: 'Camilla 1', active: false });
    expect(gw.audits.at(-1)?.action).toBe('room.deactivate');
  });
});

describe('servicios', () => {
  const service = {
    name: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    durationMin: 45,
    bufferMin: 15,
    defaultSessions: 10,
    roomKinds: ['CAMILLA'],
  };

  it('no cambia el área si lo ofrece un profesional que no la atiende', async () => {
    const { id } = await saveService(gw, admin, service);
    gw.professionals = [
      {
        id: 'p1',
        displayName: 'Lic. Diego Pérez',
        active: true,
        weeklySchedule: {},
        serviceIds: [id],
        categories: ['FISIOTERAPIA'],
      },
    ];
    await expect(
      saveService(gw, admin, { ...service, serviceId: id, category: 'ESTETICA' }),
    ).rejects.toThrow(/lo ofrece Lic. Diego Pérez/);
    await expect(
      saveService(gw, admin, { ...service, serviceId: id, durationMin: 60 }),
    ).resolves.toEqual({ id });
  });
});
