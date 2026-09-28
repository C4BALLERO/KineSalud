import type { ClinicSettingsDoc, DateKey } from '@kinesalud/shared';
import type { AppError } from '@/lib/errors';
import {
  useClinicSettings,
  useRooms,
  useServices,
  type RoomItem,
  type ServiceItem,
} from '@/features/settings/api/catalog';
import {
  useExceptions,
  useProfessionals,
  type ExceptionItem,
  type ProfessionalItem,
} from '@/features/staff/api/staff';

export interface AgendaCatalogs {
  professionals: ProfessionalItem[];
  exceptions: ExceptionItem[];
  rooms: RoomItem[];
  services: ServiceItem[];
  /** null si el consultorio aún no tiene horario configurado. */
  clinic: ClinicSettingsDoc | null;
}

export type AgendaCatalogsState =
  | { status: 'loading' }
  | { status: 'error'; error: AppError; retry: () => void }
  | { status: 'success'; data: AgendaCatalogs };

/** Profesionales, ausencias (desde `from`), espacios, servicios y horario del consultorio. */
export function useAgendaCatalogs(from: DateKey): AgendaCatalogsState {
  const professionals = useProfessionals();
  const exceptions = useExceptions(null, from);
  const rooms = useRooms();
  const services = useServices();
  const clinic = useClinicSettings();

  const lists = [professionals, exceptions, rooms, services] as const;
  const failed = [...lists, clinic].find((q) => q.status === 'error');
  if (failed && failed.status === 'error') {
    return {
      status: 'error',
      error: failed.error,
      retry: () => [...lists, clinic].forEach((q) => q.retry()),
    };
  }
  if (
    professionals.status !== 'success' ||
    exceptions.status !== 'success' ||
    rooms.status !== 'success' ||
    services.status !== 'success' ||
    clinic.status === 'loading'
  ) {
    return { status: 'loading' };
  }
  return {
    status: 'success',
    data: {
      professionals: professionals.data,
      exceptions: exceptions.data,
      rooms: rooms.data,
      services: services.data,
      clinic: clinic.status === 'success' ? clinic.data : null,
    },
  };
}
