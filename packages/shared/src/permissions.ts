import type { Role } from './enums';

/**
 * Permisos del sistema. La UI los usa para mostrar u ocultar acciones y las
 * Cloud Functions para autorizar comandos. Las Security Rules de Firestore
 * replican la misma matriz (ver docs/roles-permisos.md).
 */
export const PERMISSIONS = [
  'users.manage',
  'settings.manage',
  'staff.read',
  'staff.manage',
  'clients.read',
  'clients.write',
  'appointments.read',
  'appointments.manage',
  'attendance.mark',
  'treatments.read',
  'treatments.manage',
  'clinical.read',
  'clinical.write',
  'reminders.manage',
  'reports.view',
  'reports.viewWorkload',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Alcance de un permiso:
 * - `all`: sobre cualquier registro.
 * - `own`: solo sobre registros asignados al profesional de la sesión.
 */
export type PermissionScope = 'all' | 'own';

type PermissionMap = Partial<Record<Permission, PermissionScope>>;

export const ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
  ADMINISTRADOR: {
    'users.manage': 'all',
    'settings.manage': 'all',
    'staff.read': 'all',
    'staff.manage': 'all',
    'clients.read': 'all',
    'clients.write': 'all',
    'appointments.read': 'all',
    'appointments.manage': 'all',
    'attendance.mark': 'all',
    'treatments.read': 'all',
    'treatments.manage': 'all',
    'clinical.read': 'all',
    'clinical.write': 'all',
    'reminders.manage': 'all',
    'reports.view': 'all',
    'reports.viewWorkload': 'all',
    'audit.view': 'all',
  },
  RECEPCIONISTA: {
    'staff.read': 'all',
    'clients.read': 'all',
    'clients.write': 'all',
    'appointments.read': 'all',
    'appointments.manage': 'all',
    'attendance.mark': 'all',
    'treatments.read': 'all',
    'treatments.manage': 'all',
    'reminders.manage': 'all',
    'reports.view': 'all',
  },
  PROFESIONAL: {
    'staff.read': 'own',
    'clients.read': 'own',
    'appointments.read': 'own',
    'appointments.manage': 'own',
    'attendance.mark': 'own',
    'treatments.read': 'own',
    'treatments.manage': 'own',
    'clinical.read': 'own',
    'clinical.write': 'own',
  },
};

/** Datos mínimos de la sesión necesarios para autorizar. */
export interface AccessSubject {
  role: Role;
  /** Ficha de profesional vinculada (PROFESIONAL, o ADMINISTRADOR que también atiende). */
  professionalId?: string | null;
}

const SCOPE_RANK: Record<PermissionScope, number> = { own: 1, all: 2 };

/**
 * Devuelve el alcance efectivo de un permiso para el sujeto, o `null` si no
 * lo tiene. Un ADMINISTRADOR vinculado a una ficha de profesional suma además
 * los permisos de PROFESIONAL sobre su propia agenda.
 */
export function permissionScope(
  subject: AccessSubject,
  permission: Permission,
): PermissionScope | null {
  const scopes: PermissionScope[] = [];
  const base = ROLE_PERMISSIONS[subject.role][permission];
  if (base) scopes.push(base);

  if (subject.role !== 'PROFESIONAL' && subject.professionalId) {
    const asProfessional = ROLE_PERMISSIONS.PROFESIONAL[permission];
    if (asProfessional) scopes.push(asProfessional);
  }

  if (scopes.length === 0) return null;
  return scopes.reduce((best, s) => (SCOPE_RANK[s] > SCOPE_RANK[best] ? s : best));
}

export function hasPermission(subject: AccessSubject, permission: Permission): boolean {
  return permissionScope(subject, permission) !== null;
}

/**
 * Comprueba un permiso contra un registro concreto. Con alcance `own`, el
 * registro debe pertenecer al profesional de la sesión.
 */
export function canAccessRecord(
  subject: AccessSubject,
  permission: Permission,
  recordProfessionalIds: readonly string[],
): boolean {
  const scope = permissionScope(subject, permission);
  if (scope === 'all') return true;
  if (scope === 'own') {
    return !!subject.professionalId && recordProfessionalIds.includes(subject.professionalId);
  }
  return false;
}
