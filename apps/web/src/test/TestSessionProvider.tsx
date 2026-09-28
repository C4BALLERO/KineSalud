import type { Role } from '@kinesalud/shared';
import type { ReactNode } from 'react';
import { UiProviders } from '@/app/providers';
import { SessionContext, type SessionContextValue } from '@/features/auth/session';
import { TEST_USERS } from './testUsers';

/** Sesión simulada para pruebas de componentes (sin Firebase). */
export function TestSessionProvider({
  asRole,
  value,
  children,
}: {
  /** Rol de la sesión simulada; si se omite, no hay sesión. */
  asRole?: Role;
  value?: Partial<SessionContextValue>;
  children: ReactNode;
}) {
  const ctx: SessionContextValue = {
    status: asRole ? 'signed-in' : 'signed-out',
    session: asRole ? TEST_USERS[asRole] : null,
    blockedReason: null,
    signOut: async () => undefined,
    ...value,
  };
  return (
    <SessionContext.Provider value={ctx}>
      <UiProviders>{children}</UiProviders>
    </SessionContext.Provider>
  );
}
