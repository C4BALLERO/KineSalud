import type { ClientStatus, CiExtension } from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

/** Campos administrativos que escribe el servicio (sin estadísticas ni fechas). */
export interface ClientFields {
  firstName: string;
  lastName: string;
  lastNameLower: string;
  ci: string;
  ciExt: CiExtension | null;
  phone: string;
  phoneE164: string;
  email: string | null;
  birthDate: string | null;
  address: string | null;
  adminNotes: string | null;
  searchKeywords: string[];
}

export interface StoredClient extends ClientFields {
  id: string;
  status: ClientStatus;
  /** Profesionales que lo atienden (ven al cliente entre sus pacientes). */
  assignedProfessionalIds?: string[];
}

/**
 * Puerto de persistencia de clientes. Las operaciones que tocan el CI son
 * transaccionales: el índice `clientCiIndex/{ci}` garantiza que sea único.
 */
export interface ClientsGateway {
  /** Lanza DomainError('already-exists', …, { clientId }) si el CI ya está registrado. */
  create(
    fields: ClientFields,
    createdBy: string | null,
    assignedProfessionalIds?: string[],
  ): Promise<string>;
  /** Agrega un profesional a los que atienden al cliente. */
  assignProfessional(clientId: string, professionalId: string): Promise<void>;
  get(clientId: string): Promise<StoredClient | null>;
  /** Actualiza y, si el CI cambió, mueve su entrada en el índice (misma transacción). */
  update(clientId: string, fields: ClientFields, previousCi: string): Promise<void>;
  setStatus(clientId: string, status: ClientStatus): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}
