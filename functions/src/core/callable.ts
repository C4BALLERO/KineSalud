import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import type { Actor } from './actor';
import { DomainError } from './errors';
import { actorFromAuth } from './guards';

/** Comando de dominio con el Actor ya resuelto. */
export type CommandHandler<T = unknown> = (actor: Actor, data: unknown) => Promise<T>;

/**
 * Adaptador callable: autentica, construye el Actor y traduce errores de
 * dominio a HttpsError. Los errores inesperados se registran y se devuelven
 * como `internal` sin filtrar detalles técnicos al cliente.
 *
 * Expone además `run`, el comando sin el transporte: lo reutiliza el
 * adaptador HTTP del despliegue gratuito (ver api/http) sin duplicar lógica.
 */
export function callable<T>(handler: CommandHandler<T>) {
  const fn = onCall(async (request) => {
    try {
      const actor = actorFromAuth(request.auth);
      return await handler(actor, request.data);
    } catch (err) {
      if (err instanceof DomainError) {
        throw new HttpsError(err.code, err.message, err.details);
      }
      logger.error('Error inesperado en función callable', err);
      throw new HttpsError('internal', 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    }
  });
  return Object.assign(fn, { run: handler });
}
