import {
  canApplyTreatmentAction,
  minPlannedSessions,
  TREATMENT_ACTION_LABELS,
  treatmentActionNeedsReason,
  type TreatmentAction,
} from '@kinesalud/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { useProfessionals } from '@/features/staff/api/staff';
import { toAppError } from '@/lib/errors';
import {
  useChangeTreatmentStatus,
  useUpdateTreatment,
  type TreatmentItem,
} from '../api/treatments';

/** Editar profesional, sesiones previstas y nota (el servicio y el cliente no cambian). */
export function EditTreatmentDialog({
  treatment: t,
  openAppointments,
  canReassign,
  onClose,
}: {
  treatment: TreatmentItem;
  openAppointments: number;
  /** Recepción y administración pueden cambiar el profesional; el profesional, no. */
  canReassign: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const update = useUpdateTreatment();
  const professionals = useProfessionals();
  const [professionalId, setProfessionalId] = useState(t.professionalId);
  const [planned, setPlanned] = useState(String(t.plannedSessions));
  const [notes, setNotes] = useState(t.notes ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null);

  const min = minPlannedSessions(t.completedSessions, openAppointments);
  const plannedNumber = Number(planned);
  const plannedError =
    (showErrors &&
      (!Number.isInteger(plannedNumber) || plannedNumber < min || plannedNumber > 50
        ? `Ingresa un número entre ${min} y 50.`
        : undefined)) ||
    (serverError?.field === 'plannedSessions' ? serverError.message : undefined);
  const eligible =
    professionals.status === 'success'
      ? professionals.data.filter(
          (p) => (p.active && p.serviceIds.includes(t.serviceId)) || p.id === t.professionalId,
        )
      : [];

  const submit = async () => {
    setShowErrors(true);
    setServerError(null);
    if (!Number.isInteger(plannedNumber) || plannedNumber < min || plannedNumber > 50) return;
    try {
      await update.mutateAsync({
        treatmentId: t.id,
        professionalId,
        plannedSessions: plannedNumber,
        notes,
      });
      toast.success('Tratamiento actualizado');
      onClose();
    } catch (err) {
      const e = toAppError(err);
      setServerError({ field: e.field, message: e.message });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !update.isPending && onClose()}
      title="Editar tratamiento"
      description={`${t.clientName} · ${t.serviceName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={update.isPending}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {serverError && serverError.field !== 'plannedSessions' && (
          <InlineAlert tone="danger">{serverError.message}</InlineAlert>
        )}
        {canReassign && (
          <FormField
            label="Profesional"
            required
            hint={
              openAppointments > 0
                ? 'Las citas ya agendadas mantienen su profesional; reprográmalas si hace falta.'
                : undefined
            }
          >
            {(p) => (
              <Select
                {...p}
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
              >
                {eligible.map((pro) => (
                  <option key={pro.id} value={pro.id}>
                    {pro.displayName}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
        <FormField
          label="Sesiones previstas"
          required
          error={plannedError}
          hint={`Mínimo ${min}: ${t.completedSessions} realizadas y ${openAppointments} agendadas.`}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={min}
              max={50}
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Nota administrativa"
          optional
          hint="No escribas aquí información clínica."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}

const COPY: Record<TreatmentAction, { title: string; description: string; done: string }> = {
  FINALIZAR: {
    title: '¿Finalizar el tratamiento?',
    description: 'Deja de figurar entre los activos. Se conserva con su historial.',
    done: 'Tratamiento finalizado',
  },
  SUSPENDER: {
    title: '¿Suspender el tratamiento?',
    description:
      'Queda en pausa: no se le pueden agendar sesiones hasta reactivarlo. Se conserva lo realizado.',
    done: 'Tratamiento suspendido',
  },
  REACTIVAR: {
    title: '¿Reactivar el tratamiento?',
    description: 'Vuelve a estar activo y se le pueden agendar sesiones.',
    done: 'Tratamiento reactivado',
  },
};

/** Finalizar, suspender o reactivar, con motivo cuando corresponde. */
export function TreatmentStatusDialog({
  treatment: t,
  action,
  openAppointments,
  onClose,
}: {
  treatment: TreatmentItem;
  action: TreatmentAction;
  openAppointments: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const change = useChangeTreatmentStatus();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const needsReason = treatmentActionNeedsReason(t, action);
  const check = canApplyTreatmentAction(t, action, openAppointments);
  const copy = COPY[action];

  const early =
    action === 'FINALIZAR' && t.completedSessions < t.plannedSessions
      ? ` Se realizaron ${t.completedSessions} de ${t.plannedSessions} sesiones: indica por qué termina antes.`
      : '';

  const submit = async () => {
    if (needsReason && reason.trim() === '') {
      setError('Indica el motivo.');
      return;
    }
    try {
      await change.mutateAsync({ treatmentId: t.id, action, reason });
      toast.success(copy.done);
      onClose();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  // Bloqueado (p. ej. citas agendadas): se explica el motivo en lugar de ofrecer la acción.
  if (!check.ok) {
    return (
      <Dialog
        open
        size="sm"
        onOpenChange={(o) => !o && onClose()}
        title={`No se puede ${TREATMENT_ACTION_LABELS[action].toLowerCase().replace(' tratamiento', '')} todavía`}
        footer={<Button onClick={onClose}>Entendido</Button>}
      >
        <InlineAlert tone="warning">{check.reason}</InlineAlert>
      </Dialog>
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && !change.isPending && onClose()}
      title={copy.title}
      description={`${t.clientName} · ${t.serviceName}. ${copy.description}${early}`}
      confirmLabel={TREATMENT_ACTION_LABELS[action]}
      cancelLabel="Volver"
      destructive={action !== 'REACTIVAR'}
      loading={change.isPending}
      onConfirm={() => void submit()}
    >
      <FormField
        label="Motivo"
        required={needsReason}
        optional={!needsReason}
        error={error ?? undefined}
      >
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
          />
        )}
      </FormField>
    </ConfirmDialog>
  );
}
