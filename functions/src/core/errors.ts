/**
 * Error de dominio independiente del transporte. Los adaptadores (callable,
 * y en el futuro HTTP para el chatbot) lo traducen a su formato. El mensaje
 * está pensado para mostrarse al usuario final, en español.
 */
export type DomainErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
