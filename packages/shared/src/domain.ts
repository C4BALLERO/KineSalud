/**
 * Forma de los documentos de Firestore (ver docs/firestore.md). El parámetro
 * `Ts` es el tipo de marca de tiempo: `Timestamp` del SDK web o del Admin SDK.
 * Solo contiene datos administrativos: lo clínico vive en `clinicalRecords`.
 */
import type {
  AppointmentStatus,
  ClientStatus,
  RoomKind,
  TreatmentCategory,
  TreatmentStatus,
} from './enums';
import { weekdayOf, type DateKey, type Weekday } from './time';

/** Tramo horario local "HH:mm"–"HH:mm". */
export interface TimeRange {
  start: string;
  end: string;
}

export type WeeklySchedule = Partial<Record<Weekday, TimeRange[]>>;

export const APPOINTMENT_SOURCES = ['WEB', 'CHATBOT', 'SYSTEM'] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export interface ProfessionalDoc {
  firstName: string;
  lastName: string;
  /** Nombre para mostrar, p. ej. "Lic. Diego Pérez". */
  displayName: string;
  specialties: string[];
  categories: TreatmentCategory[];
  serviceIds: string[];
  phone: string | null;
  active: boolean;
  /** Cuenta de acceso vinculada (un profesional puede no tener cuenta). */
  userId: string | null;
  weeklySchedule: WeeklySchedule;
}

export interface RoomDoc {
  name: string;
  kind: RoomKind;
  capacity: number;
  allowedCategories: TreatmentCategory[];
  active: boolean;
}

export interface ServiceDoc {
  name: string;
  category: TreatmentCategory;
  durationMin: number;
  bufferMin: number;
  defaultSessions: number;
  roomKinds: RoomKind[];
  active: boolean;
}

export interface ClientDoc<Ts = unknown> {
  firstName: string;
  lastName: string;
  ci: string;
  ciExt: string | null;
  phone: string;
  phoneE164: string;
  email: string | null;
  birthDate: DateKey | null;
  address: string | null;
  adminNotes: string | null;
  status: ClientStatus;
  assignedProfessionalIds: string[];
  searchKeywords: string[];
  stats: { lastVisitAt: Ts | null; activeTreatments: number; noShowCount: number };
  createdAt: Ts;
}

export interface AppointmentDoc<Ts = unknown> {
  clientId: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  roomId: string;
  roomName: string;
  serviceId: string;
  serviceName: string;
  category: TreatmentCategory;
  treatmentId: string | null;
  sessionNumber: number | null;
  /** Día local del consultorio (clave de consulta por día). */
  date: DateKey;
  startAt: Ts;
  endAt: Ts;
  status: AppointmentStatus;
  source: AppointmentSource;
  cancelReason: string | null;
}

export interface TreatmentDoc<Ts = unknown> {
  clientId: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  category: TreatmentCategory;
  startDate: DateKey;
  plannedSessions: number;
  completedSessions: number;
  status: TreatmentStatus;
  nextAppointmentAt: Ts | null;
  lastSessionAt: Ts | null;
}

/**
 * ¿El profesional atiende ese día según su horario semanal? Las excepciones
 * (vacaciones, permisos) se incorporan con el módulo Personal (Fase 9).
 */
export function worksOn(
  professional: Pick<ProfessionalDoc, 'active' | 'weeklySchedule'>,
  day: DateKey,
): boolean {
  if (!professional.active) return false;
  return (professional.weeklySchedule[weekdayOf(day)]?.length ?? 0) > 0;
}

/** Sesiones que faltan para completar un tratamiento. */
export function remainingSessions(
  t: Pick<TreatmentDoc, 'plannedSessions' | 'completedSessions'>,
): number {
  return Math.max(0, t.plannedSessions - t.completedSessions);
}
