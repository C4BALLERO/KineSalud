import { createContext, useContext } from 'react';
import type { AccessSubject, Role } from '@kinesalud/shared';

/** Usuario autenticado tal como lo necesita la interfaz. */
export interface Session extends AccessSubject {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  professionalId: string | null;
}

/**
 * - `loading`: resolviendo el estado inicial de Firebase Auth.
 * - `signed-out`: sin sesión.
 * - `signed-in`: sesión válida con rol y cuenta activa.
 * - `blocked`: autenticado pero sin rol asignado o con la cuenta desactivada.
 */
export type SessionStatus = 'loading' | 'signed-out' | 'signed-in' | 'blocked';
export type BlockedReason = 'no-role' | 'inactive';

export interface SessionContextValue {
  status: SessionStatus;
  session: Session | null;
  blockedReason: BlockedReason | null;
  /** true si la sesión terminó por "Cerrar sesión" (no por expiración o desactivación). */
  signedOutExplicitly: boolean;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de un proveedor de sesión');
  return ctx;
}

/** Sesión autenticada; solo para componentes bajo una ruta protegida. */
export function useRequiredSession(): Session {
  const { session } = useSession();
  if (!session) throw new Error('No hay sesión activa');
  return session;
}
