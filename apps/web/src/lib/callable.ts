import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';
import { toAppError } from './errors';
import { functions } from './firebase';

/**
 * Servidor de comandos:
 * - sin `VITE_API_URL`: Cloud Functions (plan Blaze);
 * - con `VITE_API_URL` (p. ej. "/api"): el servidor HTTP del despliegue
 *   gratuito, que habla el mismo protocolo "callable" (ver functions/src/api/http).
 */
const API_URL = import.meta.env.VITE_API_URL || null;
export const usingHttpApi = API_URL !== null;

function endpoint(name: string) {
  if (!API_URL) return httpsCallable(functions, name);
  const base = new URL(API_URL, window.location.origin).href.replace(/\/$/, '');
  return httpsCallableFromURL(functions, `${base}/${name}`);
}

/**
 * Invoca un comando del servidor. Los errores se normalizan a AppError con un
 * mensaje apto para mostrar al usuario.
 */
export async function callFunction<Input, Output = void>(name: string, input: Input): Promise<Output> {
  try {
    const result = await endpoint(name)(input);
    return result.data as Output;
  } catch (err) {
    throw toAppError(err);
  }
}
