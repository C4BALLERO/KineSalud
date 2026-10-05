import { addDays, clinicDateTime, type DateKey, type Role } from '@kinesalud/shared';
import { collection, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db } from '@/lib/firebase';

export interface AuditLogItem {
  id: string;
  at: Date | null;
  action: string;
  entity: string;
  entityId: string;
  actor: { type: string; uid: string | null; role: Role | null; channel: string | null };
  meta: Record<string, unknown> | undefined;
}

/** Tope de entradas por consulta: un rango muy amplio se acota por fechas. */
export const AUDIT_PAGE_SIZE = 300;

/**
 * Entradas de auditoría de un rango de días (hora del consultorio), de la más
 * reciente a la más antigua. Las reglas solo la permiten al ADMINISTRADOR.
 */
export function useAuditLogs(from: DateKey, to: DateKey) {
  return useLiveQuery(
    `audit:${from}:${to}`,
    () =>
      query(
        collection(db, 'auditLogs'),
        where('at', '>=', Timestamp.fromDate(clinicDateTime(from, '00:00'))),
        where('at', '<', Timestamp.fromDate(clinicDateTime(addDays(to, 1), '00:00'))),
        orderBy('at', 'desc'),
        limit(AUDIT_PAGE_SIZE),
      ),
    (d): AuditLogItem => {
      const data = d.data();
      const actor = (data.actor ?? {}) as Record<string, unknown>;
      return {
        id: d.id,
        at: (data.at as Timestamp | null)?.toDate() ?? null,
        action: String(data.action ?? ''),
        entity: String(data.entity ?? ''),
        entityId: String(data.entityId ?? ''),
        actor: {
          type: String(actor.type ?? ''),
          uid: typeof actor.uid === 'string' ? actor.uid : null,
          role: typeof actor.role === 'string' ? (actor.role as Role) : null,
          channel: typeof actor.channel === 'string' ? actor.channel : null,
        },
        meta: data.meta as Record<string, unknown> | undefined,
      };
    },
  );
}
