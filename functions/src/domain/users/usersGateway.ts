import type { AuthClaims, Role } from '@kinesalud/shared';
import type { AuditEntry } from '../audit';

export interface StoredUser {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
  professionalId: string | null;
  claimsVersion: number;
}

/**
 * Puerto de acceso a Firebase Auth y Firestore para el servicio de usuarios.
 * Separarlo permite probar las reglas de negocio sin emuladores.
 */
export interface UsersGateway {
  /** Crea la cuenta en Auth. Lanza DomainError('already-exists') si el correo existe. */
  createAuthUser(input: { email: string; displayName: string }): Promise<string>;
  deleteAuthUser(uid: string): Promise<void>;
  updateAuthUser(uid: string, changes: { displayName?: string; disabled?: boolean }): Promise<void>;
  setClaims(uid: string, claims: AuthClaims): Promise<void>;
  revokeSessions(uid: string): Promise<void>;
  getUser(uid: string): Promise<StoredUser | null>;
  saveUser(user: StoredUser, options: { isNew: boolean }): Promise<void>;
  countActiveAdmins(): Promise<number>;
  audit(entry: AuditEntry): Promise<void>;
}
