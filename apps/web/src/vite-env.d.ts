/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_FUNCTIONS_REGION?: string;
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  /** Despliegue gratuito: base del servidor HTTP de comandos (p. ej. "/api"). */
  readonly VITE_API_URL?: string;
  readonly VITE_APPCHECK_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
