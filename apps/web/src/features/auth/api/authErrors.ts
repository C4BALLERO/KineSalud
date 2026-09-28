/**
 * Mensajes de Firebase Auth para el usuario. Por seguridad, credenciales
 * incorrectas y correo inexistente producen el mismo mensaje (no se revela
 * si una cuenta existe).
 */
export function authErrorMessage(
  err: unknown,
  context: 'login' | 'reset' | 'change-password' = 'login',
): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
    case 'auth/invalid-login-credentials':
      return context === 'change-password'
        ? 'La contraseña actual no es correcta.'
        : 'Correo o contraseña incorrectos.';
    case 'auth/user-disabled':
      return 'Tu cuenta está desactivada. Contacta al administrador del consultorio.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera unos minutos o restablece tu contraseña.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'El enlace expiró o ya fue utilizado. Solicita uno nuevo.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, vuelve a iniciar sesión y repite el cambio.';
    default:
      return context === 'login'
        ? 'No pudimos iniciar sesión. Inténtalo de nuevo.'
        : 'No pudimos completar la operación. Inténtalo de nuevo.';
  }
}
