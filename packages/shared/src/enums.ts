/**
 * Enumeraciones del dominio. Los códigos se mantienen en español porque así
 * están definidos en el documento del Proyecto de Grado; las etiquetas son el
 * texto que ve el usuario.
 */

export const ROLES = ['ADMINISTRADOR', 'RECEPCIONISTA', 'PROFESIONAL'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  RECEPCIONISTA: 'Recepcionista',
  PROFESIONAL: 'Profesional',
};

export const APPOINTMENT_STATUSES = [
  'PENDIENTE',
  'CONFIRMADA',
  'ATENDIDA',
  'CANCELADA',
  'NO_ASISTIO',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

/** Estados que ocupan el horario del profesional, del espacio y del cliente. */
export const BLOCKING_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'PENDIENTE',
  'CONFIRMADA',
  'ATENDIDA',
];

export const TREATMENT_CATEGORIES = ['FISIOTERAPIA', 'REHABILITACION', 'ESTETICA'] as const;
export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number];

export const TREATMENT_CATEGORY_LABELS: Record<TreatmentCategory, string> = {
  FISIOTERAPIA: 'Fisioterapia',
  REHABILITACION: 'Rehabilitación',
  ESTETICA: 'Estética',
};

export const TREATMENT_STATUSES = ['ACTIVO', 'FINALIZADO', 'SUSPENDIDO'] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  ACTIVO: 'Activo',
  FINALIZADO: 'Finalizado',
  SUSPENDIDO: 'Suspendido',
};

export const CLIENT_STATUSES = ['ACTIVO', 'INACTIVO'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ROOM_KINDS = ['CAMILLA', 'CABINA_ESTETICA', 'GIMNASIO'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export const ROOM_KIND_LABELS: Record<RoomKind, string> = {
  CAMILLA: 'Camilla',
  CABINA_ESTETICA: 'Cabina de estética',
  GIMNASIO: 'Gimnasio',
};

export const REMINDER_TYPES = ['RECORDATORIO', 'CONFIRMACION', 'CANCELACION'] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

/** WHATSAPP, SMS y EMAIL quedan reservados para etapas futuras. */
export const REMINDER_CHANNELS = ['IN_APP', 'PUSH', 'WHATSAPP', 'SMS', 'EMAIL'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_STATUSES = [
  'PROGRAMADO',
  'ENVIADO',
  'CONFIRMADO',
  'FALLIDO',
  'CANCELADO',
] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/** Origen de una operación: preparado para el chatbot de la etapa 2. */
export const ACTOR_TYPES = ['USER', 'CHATBOT', 'SYSTEM'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
