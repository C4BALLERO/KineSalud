import { DomainError } from './errors';

/** Lo que importa de la cuenta en Firebase Authentication para validar la sesión. */
export interface AuthAccountState {
  disabled: boolean;
  /** Momento (UTC) desde el que valen los tokens; se mueve al revocar las sesiones. */
  tokensValidAfterTime?: string | null;
}

/**
 * Rechaza tokens de cuentas deshabilitadas o con las sesiones revocadas.
 *
 * Un token de Firebase dura hasta 1 hora y lleva los claims con que se emitió.
 * Al desactivar una cuenta se deshabilita en Authentication y se revocan sus
 * sesiones: sin esta comprobación, ese token podría seguir ejecutando comandos
 * hasta vencer. Es la misma regla que `verifyIdToken(token, true)`.
 */
export async function assertSessionActive(
  token: { auth_time?: unknown },
  account: () => Promise<AuthAccountState>,
): Promise<void> {
  const state = await account();
  if (state.disabled) {
    throw new DomainError('permission-denied', 'Tu cuenta está desactivada.');
  }
  const validAfter = state.tokensValidAfterTime ? Date.parse(state.tokensValidAfterTime) : NaN;
  const authTime = typeof token.auth_time === 'number' ? token.auth_time * 1000 : 0;
  if (!Number.isNaN(validAfter) && authTime < validAfter) {
    throw new DomainError('unauthenticated', 'Tu sesión expiró. Vuelve a iniciar sesión.');
  }
}
