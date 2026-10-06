import { permissionScope } from '@kinesalud/shared';
import { useSession } from '@/features/auth/session';

export interface BookingScope {
  /** Puede agendar citas (en todo el consultorio o en su propia agenda). */
  canBook: boolean;
  /** Profesional cuya agenda propia administra; null si administra todo el consultorio. */
  ownAgenda: string | null;
}

/**
 * Recepción y administración agendan en todo el consultorio; el profesional,
 * solo en su propia agenda (y necesita una ficha vinculada a su cuenta).
 */
export function useBookingScope(): BookingScope {
  const { session } = useSession();
  const scope = session ? permissionScope(session, 'appointments.manage') : null;
  if (scope === 'all') return { canBook: true, ownAgenda: null };
  const ownAgenda = scope === 'own' ? (session?.professionalId ?? null) : null;
  return { canBook: !!ownAgenda, ownAgenda };
}
