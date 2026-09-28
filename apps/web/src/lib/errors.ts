/** Error listo para mostrar al usuario (mensaje en español, sin detalles técnicos). */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Datos adicionales del dominio, p. ej. `{ field: 'ci', clientId }`. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  /** Campo del formulario al que corresponde el error, si el servidor lo indicó. */
  get field(): string | undefined {
    const field = this.details?.field;
    return typeof field === 'string' ? field : undefined;
  }
}

const NETWORK_MESSAGE = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

function codeOf(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : '';
}

function detailsOf(err: unknown): Record<string, unknown> | undefined {
  const details = typeof err === 'object' && err !== null ? (err as { details?: unknown }).details : undefined;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined;
}

/**
 * Convierte errores de Cloud Functions y Firestore en AppError. Las Functions
 * ya devuelven mensajes de dominio en español; se reutilizan tal cual.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const code = codeOf(err);
  const message = err instanceof Error ? err.message : '';

  switch (code) {
    case 'functions/invalid-argument':
    case 'functions/not-found':
    case 'functions/already-exists':
    case 'functions/failed-precondition':
    case 'functions/permission-denied':
      return new AppError(code, message || GENERIC_MESSAGE, detailsOf(err));
    case 'functions/unauthenticated':
      return new AppError(code, 'Tu sesión expiró. Vuelve a iniciar sesión.');
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'unavailable':
    case 'auth/network-request-failed':
      return new AppError(code, NETWORK_MESSAGE);
    case 'permission-denied':
      return new AppError(code, 'No tienes permiso para ver esta información.');
    default:
      return new AppError(code || 'unknown', GENERIC_MESSAGE);
  }
}
