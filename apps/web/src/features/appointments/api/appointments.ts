import type {
  AppointmentDoc,
  AppointmentEventDoc,
  ChangeAppointmentStatusInput,
  CorrectAppointmentStatusInput,
  CreateAppointmentInput,
  CreateAppointmentResult,
  DateKey,
  RescheduleAppointmentInput,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import {
  collection,
  doc,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

/** Cita tal como la usa la agenda (fechas ya convertidas). */
export type AgendaAppointment = Omit<AppointmentDoc<Date>, 'createdAt' | 'updatedAt' | 'source'> & {
  id: string;
};

export function toAgendaAppointment(id: string, d: DocumentData): AgendaAppointment {
  const a = d as AppointmentDoc<Timestamp>;
  return {
    id,
    clientId: a.clientId,
    clientName: a.clientName,
    professionalId: a.professionalId,
    professionalName: a.professionalName,
    roomId: a.roomId,
    roomName: a.roomName,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
    category: a.category,
    treatmentId: a.treatmentId ?? null,
    sessionNumber: a.sessionNumber ?? null,
    date: a.date,
    startAt: a.startAt.toDate(),
    endAt: a.endAt.toDate(),
    status: a.status,
    cancelReason: a.cancelReason ?? null,
    bufferMin: a.bufferMin ?? 0,
    notes: a.notes ?? null,
    priceCents: a.priceCents ?? null,
    paymentStatus: a.paymentStatus ?? 'POR_COBRAR',
    paymentId: a.paymentId ?? null,
    sessionRecorded: a.sessionRecorded === true,
    createdBy: a.createdBy ?? null,
  };
}

/**
 * Citas entre dos fechas en tiempo real. Con `professionalId`, solo las de ese
 * profesional (obligatorio para el rol PROFESIONAL según las reglas).
 */
export function useAgendaAppointments(
  professionalId: string | null,
  from: DateKey,
  to: DateKey,
  enabled = true,
) {
  return useLiveQuery(
    enabled ? `agenda|${professionalId ?? 'all'}|${from}|${to}` : null,
    () =>
      query(
        collection(db, 'appointments'),
        ...(professionalId ? [where('professionalId', '==', professionalId)] : []),
        where('date', '>=', from),
        where('date', '<=', to),
        orderBy('date'),
        orderBy('startAt'),
      ),
    (d) => toAgendaAppointment(d.id, d.data()),
  );
}

export function useAppointment(id: string | null) {
  return useLiveDoc(
    id ? `appointments/${id}` : null,
    () => doc(db, 'appointments', id!),
    (snap) => toAgendaAppointment(snap.id, snap.data()!),
  );
}

export type AppointmentEvent = Omit<AppointmentEventDoc, 'at'> & { id: string; at: Date | null };

export function useAppointmentEvents(id: string | null) {
  return useLiveQuery(
    id ? `appointments/${id}/events` : null,
    () => query(collection(db, 'appointments', id!, 'events'), orderBy('at', 'desc')),
    (d): AppointmentEvent => {
      const e = d.data() as AppointmentEventDoc<Timestamp | null>;
      return { ...e, id: d.id, at: e.at?.toDate() ?? null };
    },
  );
}

/** Tratamientos activos del cliente (para vincular la cita a una sesión). */
export function useClientActiveTreatments(clientId: string | null) {
  return useLiveQuery(
    clientId ? `treatments|active|client|${clientId}` : null,
    () =>
      query(
        collection(db, 'treatments'),
        where('clientId', '==', clientId),
        where('status', '==', 'ACTIVO'),
      ),
    (d) => {
      const t = d.data();
      return {
        id: d.id,
        serviceId: t.serviceId as string,
        serviceName: t.serviceName as string,
        professionalId: t.professionalId as string,
        professionalName: t.professionalName as string,
        plannedSessions: t.plannedSessions as number,
        completedSessions: t.completedSessions as number,
      };
    },
  );
}

/* ---------- Comandos (la agenda se actualiza sola por las suscripciones) ---------- */

export function useCreateAppointment() {
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) =>
      callFunction<CreateAppointmentInput, CreateAppointmentResult>('appointments-create', input),
  });
}

export function useRescheduleAppointment() {
  return useMutation({
    mutationFn: (input: RescheduleAppointmentInput) =>
      callFunction<RescheduleAppointmentInput>('appointments-reschedule', input),
  });
}

export function useChangeAppointmentStatus() {
  return useMutation({
    mutationFn: (input: ChangeAppointmentStatusInput) =>
      callFunction<ChangeAppointmentStatusInput>('appointments-changeStatus', input),
  });
}

export function useCorrectAppointmentStatus() {
  return useMutation({
    mutationFn: (input: CorrectAppointmentStatusInput) =>
      callFunction<CorrectAppointmentStatusInput>('appointments-correctStatus', input),
  });
}
