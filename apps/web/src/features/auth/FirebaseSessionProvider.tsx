import { onIdTokenChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { ROLES, type Role } from '@kinesalud/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';
import { auth, db } from '@/lib/firebase';
import { signOut as authSignOut } from './api/authApi';
import {
  SessionContext,
  type BlockedReason,
  type Session,
  type SessionContextValue,
  type SessionStatus,
} from './session';

interface State {
  status: SessionStatus;
  session: Session | null;
  blockedReason: BlockedReason | null;
  /** Versión de claims del token vigente. */
  claimsVersion: number;
}

const SIGNED_OUT: State = {
  status: 'signed-out',
  session: null,
  blockedReason: null,
  claimsVersion: 0,
};

async function stateFromUser(user: User): Promise<State> {
  const { claims } = await user.getIdTokenResult();
  const role = claims.role;
  const base = { claimsVersion: typeof claims.cv === 'number' ? claims.cv : 0 };
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
    return { ...base, status: 'blocked', session: null, blockedReason: 'no-role' };
  }
  if (claims.active !== true) {
    return { ...base, status: 'blocked', session: null, blockedReason: 'inactive' };
  }
  return {
    ...base,
    status: 'signed-in',
    blockedReason: null,
    session: {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName || user.email || 'Usuario',
      role: role as Role,
      professionalId: typeof claims.professionalId === 'string' ? claims.professionalId : null,
    },
  };
}

/**
 * Sesión real con Firebase Authentication.
 * - El rol y el estado provienen de custom claims (asignados por Cloud Functions).
 * - Escucha el documento `users/{uid}`: si el administrador cambia el rol o
 *   desactiva la cuenta, refresca el token o cierra la sesión de inmediato.
 */
export function FirebaseSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ ...SIGNED_OUT, status: 'loading' });

  useEffect(
    () =>
      onIdTokenChanged(auth, async (user) => {
        if (!user) {
          queryClient.clear();
          setState(SIGNED_OUT);
          return;
        }
        try {
          setState(await stateFromUser(user));
        } catch {
          setState(SIGNED_OUT);
        }
      }),
    [],
  );

  const uid = state.session?.uid ?? null;
  const claimsVersion = state.claimsVersion;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.active === false) {
          void authSignOut();
        } else if (typeof data.claimsVersion === 'number' && data.claimsVersion > claimsVersion) {
          // Los claims cambiaron en el servidor: forzar un token nuevo.
          void auth.currentUser?.getIdToken(true);
        } else if (typeof data.displayName === 'string') {
          setState((s) =>
            s.session && s.session.displayName !== data.displayName
              ? { ...s, session: { ...s.session, displayName: data.displayName } }
              : s,
          );
        }
      },
      // Sin acceso a su propio documento: la cuenta fue desactivada.
      () => void authSignOut(),
    );
  }, [uid, claimsVersion]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status: state.status,
      session: state.session,
      blockedReason: state.blockedReason,
      signOut: authSignOut,
    }),
    [state.status, state.session, state.blockedReason],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
