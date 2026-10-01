import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import { db } from '../core/firebase';

/** Aviso para el personal (nunca contiene información clínica). */
export interface StaffMessage {
  userIds: string[];
  title: string;
  body: string;
  /** Ruta de la app que abre el aviso, p. ej. "/recordatorios". */
  link: string;
}

/**
 * Canal de notificación desacoplado del dominio. En la v1: la bandeja de la
 * app (in-app) y push al navegador del personal (FCM). WhatsApp, SMS o correo
 * al cliente se agregan en la etapa 2 implementando esta misma interfaz.
 */
export interface NotificationChannel {
  readonly name: string;
  send(message: StaffMessage): Promise<void>;
}

/** Bandeja in-app: un documento `notifications` por persona. */
export const inAppChannel: NotificationChannel = {
  name: 'IN_APP',
  async send({ userIds, title, body, link }) {
    if (userIds.length === 0) return;
    const batch = db.batch();
    for (const userId of userIds) {
      batch.set(db.collection('notifications').doc(), {
        userId,
        title,
        body,
        link,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  },
};

function absoluteLink(link: string): string {
  if (/^https:\/\//.test(link)) return link;
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '';
  return `https://${project}.web.app${link}`;
}

const INVALID_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Push al navegador (Firebase Cloud Messaging) en los dispositivos que cada
 * persona activó desde "Mi cuenta". Los tokens vencidos se eliminan.
 */
export const fcmChannel: NotificationChannel = {
  name: 'PUSH',
  async send({ userIds, title, body, link }) {
    const devices = (
      await Promise.all(
        userIds.map((uid) => db.collection('users').doc(uid).collection('devices').get()),
      )
    )
      .flatMap((snap) => snap.docs)
      .filter((d) => typeof d.get('token') === 'string');
    if (devices.length === 0) return;

    const result = await getMessaging().sendEachForMulticast({
      tokens: devices.map((d) => d.get('token') as string),
      notification: { title, body },
      // FCM exige una URL HTTPS absoluta: se usa el dominio de Hosting del proyecto.
      webpush: { fcmOptions: { link: absoluteLink(link) } },
    });
    const stale = devices.filter((_, i) => {
      const r = result.responses[i];
      return r && !r.success && INVALID_TOKEN.has(r.error?.code ?? '');
    });
    await Promise.all(stale.map((d) => d.ref.delete()));
    if (result.failureCount > stale.length) {
      logger.warn('Algunos avisos push no se entregaron', { failures: result.failureCount });
    }
  },
};

export const STAFF_CHANNELS: NotificationChannel[] = [inAppChannel, fcmChannel];
