import type { ClientStatus, ServiceDoc, TreatmentDoc } from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export type StoredTreatment = Omit<
  TreatmentDoc<Date>,
  'createdAt' | 'updatedAt' | 'statusChangedAt' | 'nextAppointmentAt' | 'lastSessionAt'
> & { id: string };

export type NewTreatment = Omit<
  TreatmentDoc,
  'createdAt' | 'updatedAt' | 'statusChangedAt' | 'nextAppointmentAt' | 'lastSessionAt'
>;

export interface TreatmentClientRef {
  id: string;
  firstName: string;
  lastName: string;
  status: ClientStatus;
  assignedProfessionalIds: string[];
}

export interface TreatmentProfessionalRef {
  id: string;
  displayName: string;
  active: boolean;
  serviceIds: string[];
}

/** Operaciones dentro de una transacción; las lecturas van antes de las escrituras. */
export interface TreatmentsTx {
  getClient(id: string): Promise<TreatmentClientRef | null>;
  getService(id: string): Promise<(ServiceDoc & { id: string }) | null>;
  getProfessional(id: string): Promise<TreatmentProfessionalRef | null>;
  getTreatment(id: string): Promise<StoredTreatment | null>;
  /** Tratamientos del cliente (pocos por cliente: se filtran en memoria). */
  getClientTreatments(clientId: string): Promise<StoredTreatment[]>;
  /** Citas pendientes o confirmadas vinculadas al tratamiento. */
  countOpenAppointments(treatmentId: string): Promise<number>;

  createTreatment(doc: NewTreatment): string;
  updateTreatment(
    id: string,
    changes: Partial<
      Pick<
        TreatmentDoc,
        | 'professionalId'
        | 'professionalName'
        | 'plannedSessions'
        | 'notes'
        | 'status'
        | 'statusReason'
      >
    > & {
      statusChanged?: boolean;
    },
  ): void;
  updateClient(id: string, changes: { addProfessionalId?: string; activeDelta?: number }): void;
}

export interface TreatmentsGateway {
  run<T>(work: (tx: TreatmentsTx) => Promise<T>): Promise<T>;
  audit(entry: AuditEntry): Promise<void>;
}
