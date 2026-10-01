import type {
  ClientClinicalView,
  RecordSessionResult,
  SaveClinicalRecordInput,
  SaveTreatmentPlanInput,
  SessionNoteInput,
  SessionNoteView,
  TreatmentClinicalView,
} from '@kinesalud/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@/lib/callable';

/*
 * La información clínica no se lee con suscripciones de Firestore (las reglas
 * lo impiden): cada lectura pasa por una Cloud Function que verifica el
 * acceso y la registra en la auditoría. Tras cada cambio se invalida la caché.
 */

const CLINICAL = ['clinical'] as const;

export function useClientClinical(clientId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...CLINICAL, 'client', clientId],
    queryFn: () =>
      callFunction<{ clientId: string }, ClientClinicalView>('clinical-getClient', {
        clientId: clientId!,
      }),
    enabled: enabled && !!clientId,
  });
}

export function useTreatmentClinical(treatmentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...CLINICAL, 'treatment', treatmentId],
    queryFn: () =>
      callFunction<{ treatmentId: string }, TreatmentClinicalView>('clinical-getTreatment', {
        treatmentId: treatmentId!,
      }),
    enabled: enabled && !!treatmentId,
  });
}

export function useSessionNote(appointmentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...CLINICAL, 'session', appointmentId],
    queryFn: () =>
      callFunction<
        { appointmentId: string },
        { note: SessionNoteView | null; alerts: string | null }
      >('clinical-getSession', { appointmentId: appointmentId! }),
    enabled: enabled && !!appointmentId,
  });
}

function useClinicalMutation<Input, Output = void>(name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => callFunction<Input, Output>(name, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLINICAL }),
  });
}

export const useSaveClinicalRecord = () =>
  useClinicalMutation<SaveClinicalRecordInput>('clinical-saveRecord');
export const useSaveTreatmentPlan = () =>
  useClinicalMutation<SaveTreatmentPlanInput>('clinical-savePlan');
export const useRecordSession = () =>
  useClinicalMutation<SessionNoteInput, RecordSessionResult>('clinical-recordSession');
export const useUpdateSession = () =>
  useClinicalMutation<SessionNoteInput>('clinical-updateSession');
