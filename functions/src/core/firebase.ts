import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Inicialización única del Admin SDK.
 * - En Cloud Functions y en los emuladores, las credenciales vienen del entorno.
 * - En el despliegue gratuito (Vercel, fuera de Google Cloud) se usan las de una
 *   cuenta de servicio guardada como variable de entorno secreta
 *   `FIREBASE_SERVICE_ACCOUNT` (el JSON completo). Nunca se sube al repositorio.
 */
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    const parsed = JSON.parse(serviceAccount) as { project_id: string };
    initializeApp({ credential: cert(parsed as never), projectId: parsed.project_id });
  } else {
    initializeApp();
  }
}

export const adminAuth = getAuth();
export const db = getFirestore();
