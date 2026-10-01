import { describe, expect, it } from 'vitest';
import { toAppError } from './errors';

function functionsError(code: string, message: string, details?: unknown) {
  return Object.assign(new Error(message), { code, details });
}

describe('errores del servidor', () => {
  it('muestra el mensaje de dominio sin el código HTTP que agrega el SDK', () => {
    const err = toAppError(
      functionsError('functions/failed-precondition', 'La caja está cerrada. [400]', {
        field: 'x',
      }),
    );
    expect(err.message).toBe('La caja está cerrada.');
    expect(err.field).toBe('x');
  });

  it('los errores desconocidos no muestran detalles técnicos', () => {
    expect(toAppError(functionsError('functions/internal', 'stack [500]')).message).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});
