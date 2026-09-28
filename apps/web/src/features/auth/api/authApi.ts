import {
  confirmPasswordReset,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/** Operaciones de autenticación. Los componentes no usan Firebase directamente. */

export async function signIn(email: string, password: string): Promise<void> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  // Registro de último acceso (permitido por las reglas solo sobre el propio documento).
  updateDoc(doc(db, 'users', user.uid), { lastLoginAt: serverTimestamp() }).catch(() => undefined);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

/**
 * Envía el enlace para crear o restablecer la contraseña. Si el correo no
 * existe se ignora el error, para no revelar qué cuentas existen.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/login` });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') return;
    throw err;
  }
}

/** Valida el código del enlace y devuelve el correo al que pertenece. */
export function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

export function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

/** Cambia la contraseña propia; exige la actual (reautenticación). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email)
    throw Object.assign(new Error('Sin sesión'), { code: 'auth/requires-recent-login' });
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  );
  await updatePassword(user, newPassword);
}
