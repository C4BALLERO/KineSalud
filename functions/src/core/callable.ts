import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import type { Actor } from './actor';
import { DomainError } from './errors';
import { actorFromAuth } from './guards';

/**
 * Adaptador callable: autentica, construye el Actor y traduce errores de
 * dominio a HttpsError. Los errores inesperados se registran y se devuelven
 * como `internal` sin filtrar detalles técnicos al cliente.
 */
export function callable<T>(
  handler: (actor: Actor, data: unknown, request: CallableRequest) => Promise<T>,
) {
  return onCall(async (request) => {
    try {
      const actor = actorFromAuth(request.auth);
      return await handler(actor, request.data, request);
    } catch (err) {
      if (err instanceof DomainError) {
        throw new HttpsError(err.code, err.message, err.details);
      }
      logger.error('Error inesperado en función callable', err);
      throw new HttpsError('internal', 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    }
  });
}
