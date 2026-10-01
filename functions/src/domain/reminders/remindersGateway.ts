import type { AppointmentStatus, ReminderDoc } from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export type StoredReminder = Omit<ReminderDoc<Date>, 'createdAt' | 'updatedAt'> & { id: string };

export interface ReminderAppointment {
  id: string;
  clientId: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  date: string;
  startAt: Date;
  status: AppointmentStatus;
}

/** Puerto de persistencia de los recordatorios. */
export interface RemindersGateway {
  getReminder(id: string): Promise<StoredReminder | null>;
  /** Crea o actualiza (merge) el recordatorio de una cita. */
  saveReminder(id: string, changes: Partial<Omit<StoredReminder, 'id'>>): Promise<void>;
  getAppointment(id: string): Promise<ReminderAppointment | null>;
  getClientContact(clientId: string): Promise<{ phone: string | null; phoneE164: string | null }>;
  /** Horas de anticipación configuradas en el consultorio (24 por defecto). */
  getLeadHours(): Promise<number>;
  /** Programados cuya hora ya llegó. */
  listDue(now: Date, max: number): Promise<StoredReminder[]>;
  /** Recepción y administración activas: reciben los avisos. */
  listFrontDeskUserIds(): Promise<string[]>;
  audit(entry: AuditEntry): Promise<void>;
}
