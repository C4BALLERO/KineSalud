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
  /** Citas y tratamientos que usan el servicio (historial que impide borrarlo). */
  countServiceUsage(serviceId: string): Promise<{ appointments: number; treatments: number }>;
  deleteService(id: string): Promise<void>;
  /** Reemplaza los servicios de varios profesionales en una sola escritura atómica. */
  saveProfessionalServices(updates: { id: string; serviceIds: string[] }[]): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}
