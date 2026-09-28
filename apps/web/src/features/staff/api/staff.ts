import type {
  AddExceptionInput,
  AddExceptionResult,
  CreateProfessionalResult,
  DateKey,
  LinkAccountInput,
  ProfessionalDoc,
  ProfessionalExceptionDoc,
  ProfessionalInput,
  RemoveExceptionInput,
  SetProfessionalActiveInput,
  SetScheduleInput,
  UpdateProfessionalInput,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

export type ProfessionalItem = ProfessionalDoc & { id: string };

export type ExceptionItem = Omit<ProfessionalExceptionDoc, 'createdAt'> & { id: string };

function toProfessional(id: string, data: ProfessionalDoc): ProfessionalItem {
  // Fichas creadas antes de la Fase 9 pueden no tener título.
  return { ...data, id, title: data.title ?? null, weeklySchedule: data.weeklySchedule ?? {} };
}

/** Todas las fichas (el personal de un consultorio es pequeño). */
export function useProfessionals() {
  return useLiveQuery(
    'professionals',
    () => query(collection(db, 'professionals'), orderBy('lastName')),
    (d) => toProfessional(d.id, d.data() as ProfessionalDoc),
  );
}

export function useProfessional(id: string | undefined) {
  return useLiveDoc(
    id ? `professionals/${id}` : null,
    () => doc(db, 'professionals', id!),
    (snap) => toProfessional(snap.id, snap.data() as ProfessionalDoc),
  );
}

/**
 * Ausencias que terminan desde `from` en adelante; de un profesional o, con
 * `null`, de todo el personal (para el directorio y el dashboard).
 */
export function useExceptions(professionalId: string | null, from: DateKey, enabled = true) {
  return useLiveQuery(
    enabled ? `exceptions|${professionalId ?? 'all'}|${from}` : null,
    () =>
      query(
        collection(db, 'professionalExceptions'),
        ...(professionalId ? [where('professionalId', '==', professionalId)] : []),
        where('dateTo', '>=', from),
        orderBy('dateTo'),
      ),
    (d): ExceptionItem => {
      const e = d.data() as ProfessionalExceptionDoc;
      return {
        id: d.id,
        professionalId: e.professionalId,
        dateFrom: e.dateFrom,
        dateTo: e.dateTo,
        type: e.type,
        note: e.note ?? null,
        createdBy: e.createdBy ?? null,
      };
    },
  );
}

/* ---------- Comandos ---------- */

export function useCreateProfessional() {
  return useMutation({
    mutationFn: (input: ProfessionalInput) =>
      callFunction<ProfessionalInput, CreateProfessionalResult>('staff-create', input),
  });
}

export function useUpdateProfessional() {
  return useMutation({
    mutationFn: (input: UpdateProfessionalInput) =>
      callFunction<UpdateProfessionalInput>('staff-update', input),
  });
}

export function useSetProfessionalActive() {
  return useMutation({
    mutationFn: (input: SetProfessionalActiveInput) =>
      callFunction<SetProfessionalActiveInput>('staff-setActive', input),
  });
}

export function useSetSchedule() {
  return useMutation({
    mutationFn: (input: SetScheduleInput) =>
      callFunction<SetScheduleInput>('staff-setSchedule', input),
  });
}

export function useAddException() {
  return useMutation({
    mutationFn: (input: AddExceptionInput) =>
      callFunction<AddExceptionInput, AddExceptionResult>('staff-addException', input),
  });
}

export function useRemoveException() {
  return useMutation({
    mutationFn: (input: RemoveExceptionInput) =>
      callFunction<RemoveExceptionInput>('staff-removeException', input),
  });
}

export function useLinkAccount() {
  return useMutation({
    mutationFn: (input: LinkAccountInput) =>
      callFunction<LinkAccountInput>('staff-linkAccount', input),
  });
}
