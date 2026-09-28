import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

/**
 * Inicialización única de Firebase. En desarrollo se conecta por defecto a
 * Firebase Emulator Suite (VITE_USE_EMULATORS=false para usar el proyecto real).
 */
const env = import.meta.env;
export const usingEmulators =
  env.VITE_USE_EMULATORS !== undefined ? env.VITE_USE_EMULATORS === 'true' : env.DEV;

const config: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || (usingEmulators ? 'demo-api-key' : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-kinesalud',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!usingEmulators && !config.apiKey) {
  throw new Error(
    'Falta la configuración de Firebase. Copia apps/web/.env.example a .env.local y completa los valores.',
  );
}

export const firebaseApp: FirebaseApp = initializeApp(config);
export const auth: Auth = getAuth(firebaseApp);
auth.languageCode = 'es';
export const db: Firestore = getFirestore(firebaseApp);
export const functions: Functions = getFunctions(
  firebaseApp,
  env.VITE_FIREBASE_FUNCTIONS_REGION || 'southamerica-east1',
);

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
