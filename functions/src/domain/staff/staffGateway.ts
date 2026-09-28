import type {
  DateKey,
  ExceptionType,
  ProfessionalDoc,
  ProfessionalExceptionDoc,
  TreatmentCategory,
  WeeklySchedule,
} from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export interface StoredProfessional extends ProfessionalDoc {
  id: string;
}

export interface ServiceRef {
  id: string;
  name: string;
  category: TreatmentCategory;
}

export interface StoredException {
  id: string;
  professionalId: string;
  dateFrom: DateKey;
  dateTo: DateKey;
  type: ExceptionType;
}

/** Puerto de persistencia del módulo Personal. */
export interface StaffGateway {
  getProfessional(id: string): Promise<StoredProfessional | null>;
  createProfessional(doc: ProfessionalDoc): Promise<string>;
  updateProfessional(id: string, changes: Partial<ProfessionalDoc>): Promise<void>;
  /** Servicios existentes entre los ids pedidos (los inexistentes se omiten). */
  getServices(ids: string[]): Promise<ServiceRef[]>;
  /** Horario de atención del consultorio (`settings/clinic`), si está configurado. */
  getOpeningHours(): Promise<WeeklySchedule | null>;
  /** Ausencias del profesional que terminan en `fromDate` o después. */
  listExceptions(professionalId: string, fromDate: DateKey): Promise<StoredException[]>;
  getException(id: string): Promise<StoredException | null>;
  addException(doc: Omit<ProfessionalExceptionDoc, 'createdAt'>): Promise<string>;
  deleteException(id: string): Promise<void>;
  /** Citas pendientes o confirmadas del profesional entre dos fechas (incluidas). */
  countActiveAppointments(professionalId: string, from: DateKey, to: DateKey): Promise<number>;
  audit(entry: AuditEntry): Promise<void>;
}
