import type {
  ClinicalActor,
  ClinicalRecordDoc,
  SessionNoteDoc,
  TreatmentPlanDoc,
} from '@kinesalud/shared';
import type { AuditEntry } from '../audit';
import type { BookingTx, StoredAppointment } from '../appointments/appointmentsGateway';

export interface ClinicalClientRef {
  id: string;
  assignedProfessionalIds: string[];
}

export interface ClinicalTreatmentRef {
  id: string;
  clientId: string;
  professionalId: string;
}

export type StoredRecord = Omit<ClinicalRecordDoc<Date | null>, 'clientId'>;
export type StoredPlan = Omit<TreatmentPlanDoc<Date | null>, 'treatmentId'>;
export type StoredNote = SessionNoteDoc<Date | null>;
export type NewNote = Omit<SessionNoteDoc, 'createdAt' | 'updatedAt'>;

/** Operaciones de la transacción de "registrar sesión" (cita + contadores + nota). */
export interface SessionTx extends BookingTx {
  getNote(clientId: string, appointmentId: string): Promise<StoredNote | null>;
  createNote(clientId: string, note: NewNote): void;
}

/** Puerto de persistencia de la información clínica (colección privada). */
export interface ClinicalGateway {
  getClient(id: string): Promise<ClinicalClientRef | null>;
  getTreatment(id: string): Promise<ClinicalTreatmentRef | null>;
  getAppointment(id: string): Promise<StoredAppointment | null>;

  getRecord(clientId: string): Promise<StoredRecord | null>;
  saveRecord(
    clientId: string,
    data: { background: string | null; alerts: string | null; updatedBy: ClinicalActor },
  ): Promise<void>;
  getPlan(clientId: string, treatmentId: string): Promise<StoredPlan | null>;
  savePlan(
    clientId: string,
    treatmentId: string,
    data: {
      assessment: string | null;
      goals: string | null;
      indications: string | null;
      updatedBy: ClinicalActor;
    },
  ): Promise<void>;
  /** Notas del cliente; con `treatmentId`, solo las de ese tratamiento. */
  listNotes(clientId: string, treatmentId?: string): Promise<StoredNote[]>;
  getNote(clientId: string, appointmentId: string): Promise<StoredNote | null>;
  updateNote(
    clientId: string,
    appointmentId: string,
    changes: Pick<
      SessionNoteDoc,
      'observations' | 'evolution' | 'recommendations' | 'painBefore' | 'painAfter'
    >,
  ): Promise<void>;

  runSession<T>(work: (tx: SessionTx) => Promise<T>): Promise<T>;
  audit(entry: AuditEntry): Promise<void>;
}
