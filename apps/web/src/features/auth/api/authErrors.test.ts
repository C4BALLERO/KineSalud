import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './authErrors';

describe('authErrorMessage', () => {
  it('no revela si el correo existe', () => {
    const wrongPassword = authErrorMessage({ code: 'auth/wrong-password' });
    const unknownUser = authErrorMessage({ code: 'auth/user-not-found' });
    expect(wrongPassword).toBe(unknownUser);
    expect(wrongPassword).toBe('Correo o contraseña incorrectos.');
  });

  it('explica las cuentas desactivadas', () => {
    expect(authErrorMessage({ code: 'auth/user-disabled' })).toMatch(/desactivada/);
  });

  it('adapta el mensaje al cambio de contraseña', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' }, 'change-password')).toBe(
      'La contraseña actual no es correcta.',
    );
  });

  it('usa un mensaje genérico para errores desconocidos', () => {
    expect(authErrorMessage(new Error('boom'))).toBe(
      'No pudimos iniciar sesión. Inténtalo de nuevo.',
    );
  });
});
