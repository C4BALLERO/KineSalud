import type {
  AppointmentStatus,
  DailyIncomeDoc,
  DailyStatsDoc,
  DateKey,
  PaymentMethod,
  TreatmentCategory,
} from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export interface AppointmentFact {
  professionalId: string;
  category: TreatmentCategory;
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
}

export interface PaymentFact {
  status: string;
  method: PaymentMethod;
  amountCents: number;
  professionalId: string;
  category: TreatmentCategory;
}

/** Puerto de lectura de los datos originales y escritura de los resúmenes diarios. */
export interface ReportsGateway {
  appointmentsOn(date: DateKey): Promise<AppointmentFact[]>;
  /** Clientes registrados en el día del consultorio. */
  countClientsCreatedOn(date: DateKey): Promise<number>;
  paymentsOn(date: DateKey): Promise<PaymentFact[]>;
  saveDailyStats(doc: DailyStatsDoc): Promise<void>;
  saveDailyIncome(doc: DailyIncomeDoc): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}
