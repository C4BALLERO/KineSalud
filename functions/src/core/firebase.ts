import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Inicialización única del Admin SDK (en el emulador toma las variables de entorno). */
if (getApps().length === 0) initializeApp();

export const adminAuth = getAuth();
export const db = getFirestore();
