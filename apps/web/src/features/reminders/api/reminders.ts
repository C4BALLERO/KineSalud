import type {
  HandleReminderInput,
  NotificationDoc,
  ReminderDoc,
  ReminderStatus,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

export type ReminderItem = Omit<
  ReminderDoc<Date>,
  'appointmentStartAt' | 'scheduledFor' | 'sentAt' | 'handledAt' | 'createdAt' | 'updatedAt'
> & {
  id: string;
  appointmentStartAt: Date;
  scheduledFor: Date;
  sentAt: Date | null;
  handledAt: Date | null;
};

const toDate = (t: Timestamp | null | undefined) => t?.toDate() ?? null;

function toReminder(id: string, d: DocumentData): ReminderItem {
  const r = d as ReminderDoc<Timestamp | null>;
  return {
    ...r,
    id,
    appointmentStartAt: toDate(r.appointmentStartAt)!,
    scheduledFor: toDate(r.scheduledFor)!,
    sentAt: toDate(r.sentAt),
    handledAt: toDate(r.handledAt),
    clientPhone: r.clientPhone ?? null,
    clientPhoneE164: r.clientPhoneE164 ?? null,
    handledBy: r.handledBy ?? null,
    outcomeNote: r.outcomeNote ?? null,
    lastError: r.lastError ?? null,
  };
}

/** Por gestionar: vencidos, sin respuesta o fallidos, por fecha de la cita. */
export function usePendingReminders(enabled = true) {
  return useLiveQuery(
    enabled ? 'reminders|pending' : null,
    () =>
      query(
        collection(db, 'reminders'),
        where('status', 'in', ['ENVIADO', 'SIN_RESPUESTA', 'FALLIDO'] satisfies ReminderStatus[]),
        orderBy('appointmentStartAt'),
      ),
    (d) => toReminder(d.id, d.data()),
  );
}

export function useScheduledReminders(enabled = true) {
  return useLiveQuery(
    enabled ? 'reminders|scheduled' : null,
    () =>
      query(
        collection(db, 'reminders'),
        where('status', '==', 'PROGRAMADO'),
        orderBy('scheduledFor'),
        limit(100),
      ),
    (d) => toReminder(d.id, d.data()),
  );
}

export function useHandledReminders(enabled = true) {
  return useLiveQuery(
    enabled ? 'reminders|handled' : null,
    () =>
      query(
        collection(db, 'reminders'),
        where('status', 'in', ['CONFIRMADO', 'CANCELADO'] satisfies ReminderStatus[]),
        orderBy('handledAt', 'desc'),
        limit(50),
      ),
    (d) => toReminder(d.id, d.data()),
  );
}

export function useHandleReminder() {
  return useMutation({
    mutationFn: (input: HandleReminderInput) =>
      callFunction<HandleReminderInput>('reminders-handle', input),
  });
}

export function useRunRemindersNow() {
  return useMutation({
    mutationFn: () =>
      callFunction<Record<string, never>, { queued: number; cancelled: number; failed: number }>(
        'reminders-runNow',
        {},
      ),
  });
}

/* ---------- Notificaciones in-app ---------- */

export type NotificationItem = Omit<NotificationDoc<Date>, 'createdAt'> & {
  id: string;
  createdAt: Date | null;
};

export function useMyNotifications(uid: string | null) {
  return useLiveQuery(
    uid ? `notifications|${uid}` : null,
    () =>
      query(
        collection(db, 'notifications'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
    (d): NotificationItem => {
      const n = d.data() as NotificationDoc<Timestamp | null>;
      return { ...n, id: d.id, createdAt: toDate(n.createdAt) };
    },
  );
}

/** Las reglas solo permiten este cambio: marcar como leída una notificación propia. */
export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 1) {
    await updateDoc(doc(db, 'notifications', ids[0]!), { read: true });
    return;
  }
  const batch = writeBatch(db);
  for (const id of ids) batch.update(doc(db, 'notifications', id), { read: true });
  await batch.commit();
}
