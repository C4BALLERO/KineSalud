import type {
  AppointmentDoc,
  AppointmentEventDoc,
  ClientStatus,
  DateKey,
  ExceptionType,
  ProfessionalDoc,
  RoomDoc,
  ServiceDoc,
  TreatmentStatus,
  WeeklySchedule,
} from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export type StoredAppointment = Omit<AppointmentDoc<Date>, 'createdAt' | 'updatedAt'> & {
  id: string;
};

export type ProfessionalRef = Pick<
  ProfessionalDoc,
  'displayName' | 'active' | 'weeklySchedule' | 'serviceIds'
> & { id: string };

export interface ClientRef {
  id: string;
  firstName: string;
  lastName: string;
  status: ClientStatus;
}

export interface TreatmentRef {
  id: string;
  clientId: string;
  serviceId: string;
  status: TreatmentStatus;
  plannedSessions: number;
  completedSessions: number;
}

export type NewAppointment = Omit<AppointmentDoc<Date>, 'createdAt' | 'updatedAt'>;
export type NewEvent = Omit<AppointmentEventDoc, 'at'>;

/**
 * Operaciones dentro de una transacción. Todas las lecturas se hacen antes de
 * cualquier escritura (requisito de Firestore).
 */
export interface BookingTx {
  /**
   * Lee el candado del día. Toda escritura de la transacción lo actualiza, así
   * dos reservas simultáneas del mismo día entran en conflicto y una se reintenta
   * viendo la cita de la otra (las consultas solas no bloquean inserciones).
   */
  lockDay(date: DateKey): Promise<void>;
  getClinic(): Promise<{ openingHours: WeeklySchedule; slotMinutes: number } | null>;
  getProfessionals(): Promise<ProfessionalRef[]>;
  /** Ausencias que cubren la fecha. */
  getExceptions(
    date: DateKey,
  ): Promise<{ professionalId: string; dateFrom: string; dateTo: string; type: ExceptionType }[]>;
  getRooms(): Promise<(RoomDoc & { id: string })[]>;
  getService(id: string): Promise<(ServiceDoc & { id: string }) | null>;
  getClient(id: string): Promise<ClientRef | null>;
  getTreatment(id: string): Promise<TreatmentRef | null>;
  /** Citas pendientes o confirmadas vinculadas al tratamiento. */
  countOpenTreatmentAppointments(treatmentId: string): Promise<number>;
  getDayAppointments(date: DateKey): Promise<StoredAppointment[]>;
  getAppointment(id: string): Promise<StoredAppointment | null>;

  createAppointment(doc: NewAppointment): string;
  updateAppointment(id: string, changes: Partial<NewAppointment>): void;
  addEvent(appointmentId: string, event: NewEvent): void;
  updateClient(
    id: string,
    changes: { addProfessionalId?: string; noShowDelta?: number; lastVisitAt?: Date },
  ): void;
  updateTreatment(id: string, changes: { completedDelta: number }): void;
}

export interface AppointmentsGateway {
  run<T>(work: (tx: BookingTx) => Promise<T>): Promise<T>;
  audit(entry: AuditEntry): Promise<void>;
}
