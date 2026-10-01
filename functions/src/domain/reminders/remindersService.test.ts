import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import type { NotificationChannel, StaffMessage } from '../../notifications/channels';
import type { AppointmentsGateway } from '../appointments/appointmentsGateway';
import type { AuditEntry } from '../audit';
import type { ReminderAppointment, RemindersGateway, StoredReminder } from './remindersGateway';
import { handleReminder, processDueReminders, syncReminder } from './remindersService';

vi.mock('../appointments/appointmentsService', () => ({
  changeAppointmentStatus: vi.fn(async () => undefined),
}));
const { changeAppointmentStatus } = await import('../appointments/appointmentsService');

const NOW = new Date('2026-09-28T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

class InMemoryReminders implements RemindersGateway {
  reminders = new Map<string, StoredReminder>();
  appointments = new Map<string, ReminderAppointment>();
  audits: AuditEntry[] = [];
  lead = 24;

  async getReminder(id: string) {
    const r = this.reminders.get(id);
    return r ? { ...r } : null;
  }
  async saveReminder(id: string, changes: Partial<StoredReminder>) {
    this.reminders.set(id, { ...(this.reminders.get(id) as StoredReminder), ...changes, id });
  }
  async getAppointment(id: string) {
    return this.appointments.get(id) ?? null;
  }
  async getClientContact() {
    return { phone: '71234567', phoneE164: '+59171234567' };
  }
  async getLeadHours() {
    return this.lead;
  }
  async listDue(now: Date) {
    return [...this.reminders.values()].filter(
      (r) => r.status === 'PROGRAMADO' && r.scheduledFor <= now,
    );
  }
  async listFrontDeskUserIds() {
    return ['u-recep', 'u-admin'];
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}

function appt(over: Partial<ReminderAppointment> = {}): ReminderAppointment {
  return {
    id: 'cita-1',
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalName: 'Lic. Diego Pérez',
    serviceName: 'Fisioterapia lumbar',
    date: '2026-09-30',
    startAt: hours(48),
    status: 'PENDIENTE',
    ...over,
  };
}

const recep: Actor = {
  type: 'USER',
  uid: 'u-recep',
  role: 'RECEPCIONISTA',
  name: 'Lucía',
  channel: 'web',
};
const diego: Actor = {
  type: 'USER',
  uid: 'u-diego',
  role: 'PROFESIONAL',
  professionalId: 'diego',
  channel: 'web',
};

let gw: InMemoryReminders;
beforeEach(() => {
  gw = new InMemoryReminders();
  vi.mocked(changeAppointmentStatus).mockClear();
});

describe('programación del recordatorio', () => {
  it('una cita nueva programa su recordatorio 24 h antes, con el teléfono del cliente', async () => {
    await syncReminder(gw, 'cita-1', appt(), NOW);
    expect(gw.reminders.get('cita-1')).toMatchObject({
      status: 'PROGRAMADO',
      type: 'CONFIRMACION',
      scheduledFor: hours(24),
      clientPhoneE164: '+59171234567',
    });
  });

  it('una cita más próxima que la anticipación queda para gestionar ya', async () => {
    await syncReminder(gw, 'cita-1', appt({ startAt: hours(3) }), NOW);
    expect(gw.reminders.get('cita-1')?.scheduledFor).toEqual(NOW);
  });

  it('reprogramar reinicia el recordatorio; cancelar lo anula', async () => {
    await syncReminder(gw, 'cita-1', appt(), NOW);
    gw.reminders.get('cita-1')!.status = 'SIN_RESPUESTA';
    await syncReminder(gw, 'cita-1', appt({ startAt: hours(72) }), NOW);
    expect(gw.reminders.get('cita-1')).toMatchObject({
      status: 'PROGRAMADO',
      scheduledFor: hours(48),
    });

    await syncReminder(gw, 'cita-1', appt({ startAt: hours(72), status: 'CANCELADA' }), NOW);
    expect(gw.reminders.get('cita-1')?.status).toBe('CANCELADO');
  });

  it('confirmar la cita en la agenda no reinicia un recordatorio ya resuelto', async () => {
    await syncReminder(gw, 'cita-1', appt(), NOW);
    gw.reminders.get('cita-1')!.status = 'CONFIRMADO';
    await syncReminder(gw, 'cita-1', appt({ status: 'CONFIRMADA' }), NOW);
    expect(gw.reminders.get('cita-1')).toMatchObject({
      status: 'CONFIRMADO',
      appointmentStatus: 'CONFIRMADA',
      type: 'RECORDATORIO',
    });
  });
});

describe('cola de recordatorios', () => {
  it('pasa los vencidos a "por gestionar", anula los de citas cerradas y avisa una sola vez', async () => {
    await syncReminder(gw, 'cita-1', appt({ startAt: hours(5) }), NOW);
    await syncReminder(gw, 'cita-2', appt({ id: 'cita-2', startAt: hours(6) }), NOW);
    gw.appointments.set('cita-1', appt({ startAt: hours(5) }));
    gw.appointments.set('cita-2', appt({ id: 'cita-2', startAt: hours(6), status: 'CANCELADA' }));

    const sent: StaffMessage[] = [];
    const ok: NotificationChannel = { name: 'IN_APP', send: async (m) => void sent.push(m) };
    const broken: NotificationChannel = {
      name: 'PUSH',
      send: async () => {
        throw new Error('sin conexión');
      },
    };
    const result = await processDueReminders(gw, [ok, broken], NOW);

    expect(result).toEqual({ queued: 1, cancelled: 1, failed: 0 });
    expect(gw.reminders.get('cita-1')).toMatchObject({
      status: 'ENVIADO',
      attempts: 1,
      sentAt: NOW,
    });
    expect(gw.reminders.get('cita-2')?.status).toBe('CANCELADO');
    expect(sent).toEqual([
      {
        userIds: ['u-recep', 'u-admin'],
        title: '1 recordatorio para gestionar',
        body: expect.any(String),
        link: '/recordatorios',
      },
    ]);
  });
});

describe('gestión por recepción', () => {
  const appointmentsGw = {} as AppointmentsGateway;

  beforeEach(async () => {
    await syncReminder(gw, 'cita-1', appt(), NOW);
    gw.reminders.get('cita-1')!.status = 'ENVIADO';
    gw.appointments.set('cita-1', appt());
  });

  it('"confirmó" confirma la cita pendiente y registra quién lo gestionó', async () => {
    await handleReminder(
      gw,
      appointmentsGw,
      recep,
      { reminderId: 'cita-1', outcome: 'CONFIRMADO' },
      NOW,
    );
    expect(changeAppointmentStatus).toHaveBeenCalledWith(
      appointmentsGw,
      recep,
      { appointmentId: 'cita-1', action: 'CONFIRMAR' },
      NOW,
    );
    expect(gw.reminders.get('cita-1')).toMatchObject({
      status: 'CONFIRMADO',
      handledBy: { uid: 'u-recep', name: 'Lucía' },
    });
    expect(gw.audits[0]?.action).toBe('reminder.confirmado');
  });

  it('"canceló" exige motivo y cancela la cita; "no respondió" no la toca', async () => {
    await expect(
      handleReminder(
        gw,
        appointmentsGw,
        recep,
        { reminderId: 'cita-1', outcome: 'CANCELADO' },
        NOW,
      ),
    ).rejects.toThrow(/motivo/);
    await handleReminder(
      gw,
      appointmentsGw,
      recep,
      { reminderId: 'cita-1', outcome: 'SIN_RESPUESTA' },
      NOW,
    );
    expect(changeAppointmentStatus).not.toHaveBeenCalled();
    await handleReminder(
      gw,
      appointmentsGw,
      recep,
      { reminderId: 'cita-1', outcome: 'CANCELADO', note: 'Viaja ese día' },
      NOW,
    );
    expect(changeAppointmentStatus).toHaveBeenCalledWith(
      appointmentsGw,
      recep,
      { appointmentId: 'cita-1', action: 'CANCELAR', reason: 'Viaja ese día' },
      NOW,
    );
  });

  it('el profesional no gestiona recordatorios y uno resuelto no se vuelve a gestionar', async () => {
    await expect(
      handleReminder(
        gw,
        appointmentsGw,
        diego,
        { reminderId: 'cita-1', outcome: 'CONFIRMADO' },
        NOW,
      ),
    ).rejects.toBeInstanceOf(DomainError);
    gw.reminders.get('cita-1')!.status = 'CONFIRMADO';
    await expect(
      handleReminder(
        gw,
        appointmentsGw,
        recep,
        { reminderId: 'cita-1', outcome: 'CONFIRMADO' },
        NOW,
      ),
    ).rejects.toThrow(/ya fue resuelto/);
  });
});
