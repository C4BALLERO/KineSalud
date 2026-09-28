import type { ClinicSettingsDoc, ProfessionalDoc, RoomDoc, ServiceDoc } from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export type StoredRoom = RoomDoc & { id: string };
export type StoredService = ServiceDoc & { id: string };
export type ProfessionalSchedule = Pick<
  ProfessionalDoc,
  'displayName' | 'active' | 'weeklySchedule' | 'serviceIds' | 'categories'
> & { id: string };

/** Puerto de persistencia de la configuración del consultorio y sus catálogos. */
export interface SettingsGateway {
  saveClinic(doc: ClinicSettingsDoc): Promise<void>;
  listProfessionals(): Promise<ProfessionalSchedule[]>;
  listRooms(): Promise<StoredRoom[]>;
  /** Crea (id null) o reemplaza un espacio; devuelve su id. */
  saveRoom(id: string | null, doc: RoomDoc): Promise<string>;
  listServices(): Promise<StoredService[]>;
  saveService(id: string | null, doc: ServiceDoc): Promise<string>;
  audit(entry: AuditEntry): Promise<void>;
}
