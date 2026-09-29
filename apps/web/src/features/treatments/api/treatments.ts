import type {
  ChangeTreatmentStatusInput,
  CreateTreatmentInput,
  CreateTreatmentResult,
  TreatmentDoc,
  TreatmentStatus,
  UpdateTreatmentInput,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import {
  collection,
  doc,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';
import { toAgendaAppointment } from '@/features/appointments/api/appointments';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

export type TreatmentItem = Omit<
  TreatmentDoc<Date>,
  'createdAt' | 'updatedAt' | 'statusChangedAt' | 'nextAppointmentAt' | 'lastSessionAt'
> & {
  id: string;
  statusChangedAt: Date | null;
  createdAt: Date | null;
};

export function toTreatment(id: string, d: DocumentData): TreatmentItem {
  const t = d as TreatmentDoc<Timestamp | null>;
  return {
    id,
    clientId: t.clientId,
    clientName: t.clientName,
    professionalId: t.professionalId,
    professionalName: t.professionalName,
    serviceId: t.serviceId,
    serviceName: t.serviceName,
    category: t.category,
    startDate: t.startDate,
    plannedSessions: t.plannedSessions,
    completedSessions: t.completedSessions ?? 0,
    status: t.status,
    statusReason: t.statusReason ?? null,
    statusChangedAt: t.statusChangedAt?.toDate() ?? null,
    notes: t.notes ?? null,
    createdBy: t.createdBy ?? null,
    createdAt: t.createdAt?.toDate() ?? null,
  };
}

/**
 * Tratamientos por estado (`null` = todos). Con `professionalId`, solo los de
 * ese profesional (obligatorio para el rol PROFESIONAL según las reglas). Solo
 * filtros de igualdad: no requieren índices compuestos; el orden se hace en la UI.
 */
export function useTreatments(professionalId: string | null, status: TreatmentStatus | null) {
  const constraints: QueryConstraint[] = [
    ...(professionalId ? [where('professionalId', '==', professionalId)] : []),
    ...(status ? [where('status', '==', status)] : []),
  ];
  return useLiveQuery(
    `treatments|${professionalId ?? 'all'}|${status ?? 'todos'}`,
    () => query(collection(db, 'treatments'), ...constraints),
    (d) => toTreatment(d.id, d.data()),
  );
}

export function useTreatment(id: string | undefined) {
  return useLiveDoc(
    id ? `treatments/${id}` : null,
    () => doc(db, 'treatments', id!),
    (snap) => toTreatment(snap.id, snap.data()!),
  );
}

/** Citas vinculadas al tratamiento (el profesional, solo las suyas). */
export function useTreatmentAppointments(
  treatmentId: string | null,
  professionalId: string | null,
) {
  return useLiveQuery(
    treatmentId ? `appointments|treatment|${treatmentId}|${professionalId ?? 'all'}` : null,
    () =>
      query(
        collection(db, 'appointments'),
        where('treatmentId', '==', treatmentId),
        ...(professionalId ? [where('professionalId', '==', professionalId)] : []),
      ),
    (d) => toAgendaAppointment(d.id, d.data()),
  );
}

/* ---------- Comandos ---------- */

export function useCreateTreatment() {
  return useMutation({
    mutationFn: (input: CreateTreatmentInput) =>
      callFunction<CreateTreatmentInput, CreateTreatmentResult>('treatments-create', input),
  });
}

export function useUpdateTreatment() {
  return useMutation({
    mutationFn: (input: UpdateTreatmentInput) =>
      callFunction<UpdateTreatmentInput>('treatments-update', input),
  });
}

export function useChangeTreatmentStatus() {
  return useMutation({
    mutationFn: (input: ChangeTreatmentStatusInput) =>
      callFunction<ChangeTreatmentStatusInput>('treatments-changeStatus', input),
  });
}
