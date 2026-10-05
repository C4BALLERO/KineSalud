/**
 * Cierre de sesión por inactividad: los equipos de recepción suelen ser
 * compartidos y la aplicación muestra datos de pacientes.
 */
export const IDLE_TIMEOUT_MS = 30 * 60_000;
/** Aviso previo con cuenta regresiva para seguir conectado. */
export const IDLE_WARNING_MS = 60_000;

export type IdleState =
  { kind: 'active' } | { kind: 'warning'; secondsLeft: number } | { kind: 'expired' };

export function idleState(
  lastActivity: number,
  now: number,
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
): IdleState {
  const left = lastActivity + timeoutMs - now;
  if (left <= 0) return { kind: 'expired' };
  if (left <= warningMs) return { kind: 'warning', secondsLeft: Math.ceil(left / 1000) };
  return { kind: 'active' };
}

/** La actividad más reciente entre esta pestaña y las demás (compartida por almacenamiento). */
export function latestActivity(local: number, shared: string | null): number {
  const parsed = shared ? Number(shared) : NaN;
  return Number.isFinite(parsed) ? Math.max(local, parsed) : local;
}
