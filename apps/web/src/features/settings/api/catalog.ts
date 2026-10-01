import type {
  ClinicSettingsDoc,
  ClinicSettingsInput,
  DeleteServiceInput,
  RoomDoc,
  RoomInput,
  SaveCatalogResult,
  ServiceDoc,
  ServiceInput,
  SetCatalogActiveInput,
  SetServiceProfessionalsInput,
  UpdateClinicResult,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

/**
 * Catálogos del consultorio: horario de atención, espacios y servicios. Se
 * leen en tiempo real (son pocos documentos) y se escriben vía Functions.
 */

export type RoomItem = RoomDoc & { id: string };
export type ServiceItem = ServiceDoc & { id: string };

export function useClinicSettings() {
  return useLiveDoc(
    'settings/clinic',
    () => doc(db, 'settings', 'clinic'),
    (snap) => snap.data() as ClinicSettingsDoc,
  );
}

export function useRooms() {
  return useLiveQuery(
    'rooms',
    () => query(collection(db, 'rooms'), orderBy('name')),
    (d): RoomItem => ({ id: d.id, ...(d.data() as RoomDoc) }),
  );
}

export function useServices() {
  return useLiveQuery(
    'services',
    () => query(collection(db, 'services'), orderBy('name')),
    (d): ServiceItem => ({ id: d.id, ...(d.data() as ServiceDoc) }),
  );
}

/* ---------- Comandos (los datos se actualizan solos por las suscripciones) ---------- */

export function useUpdateClinic() {
  return useMutation({
    mutationFn: (input: ClinicSettingsInput) =>
      callFunction<ClinicSettingsInput, UpdateClinicResult>('settings-updateClinic', input),
  });
}

export function useSaveRoom() {
  return useMutation({
    mutationFn: (input: RoomInput) =>
      callFunction<RoomInput, SaveCatalogResult>('settings-saveRoom', input),
  });
}

export function useSetRoomActive() {
  return useMutation({
    mutationFn: (input: SetCatalogActiveInput) =>
      callFunction<SetCatalogActiveInput>('settings-setRoomActive', input),
  });
}

export function useSaveService() {
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      callFunction<ServiceInput, SaveCatalogResult>('settings-saveService', input),
  });
}

export function useSetServiceActive() {
  return useMutation({
    mutationFn: (input: SetCatalogActiveInput) =>
      callFunction<SetCatalogActiveInput>('settings-setServiceActive', input),
  });
}

export function useDeleteService() {
  return useMutation({
    mutationFn: (input: DeleteServiceInput) =>
      callFunction<DeleteServiceInput>('settings-deleteService', input),
  });
}

export function useSetServiceProfessionals() {
  return useMutation({
    mutationFn: (input: SetServiceProfessionalsInput) =>
      callFunction<SetServiceProfessionalsInput>('settings-setServiceProfessionals', input),
  });
}
