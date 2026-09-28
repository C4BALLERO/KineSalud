import type { Actor } from '../core/actor';

/** Entrada de auditoría (colección `auditLogs`, solo escritura desde el servidor). */
export interface AuditEntry {
  actor: Pick<Actor, 'type' | 'uid' | 'role' | 'channel'>;
  action: string;
  entity: string;
  entityId: string;
  meta?: Record<string, unknown>;
}

export function auditActor(actor: Actor): AuditEntry['actor'] {
  return { type: actor.type, uid: actor.uid, role: actor.role, channel: actor.channel };
}
