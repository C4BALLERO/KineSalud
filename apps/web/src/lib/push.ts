import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { db, firebaseApp, usingEmulators } from './firebase';

/**
 * Notificaciones push del navegador para el personal (Firebase Cloud
 * Messaging). Requieren la clave pública "Web Push" del proyecto
 * (VITE_FIREBASE_VAPID_KEY, ver docs/despliegue.md); sin ella, o en los
 * emuladores, la opción no se ofrece.
 */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

export type PushAvailability = 'available' | 'unsupported' | 'not-configured';

export async function pushAvailability(): Promise<PushAvailability> {
  if (usingEmulators || !VAPID_KEY) return 'not-configured';
  if (!('Notification' in window) || !(await isSupported())) return 'unsupported';
  return 'available';
}

function workerUrl(): string {
  const o = firebaseApp.options;
  const params = new URLSearchParams({
    apiKey: o.apiKey ?? '',
    projectId: o.projectId ?? '',
    messagingSenderId: o.messagingSenderId ?? '',
    appId: o.appId ?? '',
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

/** Id del documento del dispositivo: un hash corto del token (los tokens son largos). */
async function deviceId(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const STORAGE_KEY = 'kinesalud.push.deviceId';

export function pushEnabledHere(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY) && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** Pide permiso, obtiene el token y lo registra en `users/{uid}/devices`. */
export async function enablePush(uid: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      'El navegador no dio permiso para notificaciones. Puedes habilitarlo desde el candado de la barra de direcciones.',
    );
  }
  const registration = await navigator.serviceWorker.register(workerUrl());
  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  const id = await deviceId(token);
  await setDoc(doc(db, 'users', uid, 'devices', id), {
    token,
    userAgent: navigator.userAgent.slice(0, 200),
    createdAt: serverTimestamp(),
  });
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* sin almacenamiento local: solo se pierde el recordatorio de "activado" */
  }
}

export async function disablePush(uid: string): Promise<void> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorado */
  }
  await deleteToken(getMessaging(firebaseApp)).catch(() => undefined);
  if (id) await deleteDoc(doc(db, 'users', uid, 'devices', id));
}
