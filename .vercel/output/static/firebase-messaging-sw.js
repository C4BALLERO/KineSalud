/* global importScripts, firebase, self, URL */
// Service worker de notificaciones push (Firebase Cloud Messaging).
// La configuración pública del proyecto llega en la URL de registro
// (ver src/lib/push.ts): así este archivo estático no depende del build.
// Las notificaciones solo avisan al personal ("N recordatorios para
// gestionar"); nunca llevan información clínica.
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  // Con la app en segundo plano, el SDK muestra la notificación del mensaje y,
  // al hacer clic, abre `webpush.fcmOptions.link`.
  firebase.messaging();
}
