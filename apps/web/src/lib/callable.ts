import { httpsCallable } from 'firebase/functions';
import { toAppError } from './errors';
import { functions } from './firebase';

/**
 * Invoca un comando de Cloud Functions. Los errores se normalizan a AppError
 * con un mensaje apto para mostrar al usuario.
 */
export async function callFunction<Input, Output = void>(name: string, input: Input): Promise<Output> {
  try {
    const result = await httpsCallable<Input, Output>(functions, name)(input);
    return result.data;
  } catch (err) {
    throw toAppError(err);
  }
}
