import type { ActorType, Role } from '@kinesalud/shared';

/**
 * Quién ejecuta un comando de dominio. Todos los servicios de dominio reciben
 * un Actor, así la misma lógica sirve para la web (USER), las tareas internas
 * (SYSTEM) y, en la etapa 2, el chatbot (CHATBOT).
 */
export interface Actor {
  type: ActorType;
  uid?: string;
  role?: Role;
  professionalId?: string | null;
  /** Nombre visible (claim `name` del token), para el historial de las citas. */
  name?: string | null;
  /** Canal de origen, p. ej. "web" o, a futuro, "whatsapp". */
  channel: string;
}

export const SYSTEM_ACTOR: Actor = { type: 'SYSTEM', channel: 'system' };
