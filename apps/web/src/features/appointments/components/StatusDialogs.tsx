import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@kinesalud/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import {
  useChangeAppointmentStatus,
  useCorrectAppointmentStatus,
  type AgendaAppointment,
} from '../api/appointments';

const QUICK_REASONS = [
  'Solicitud del cliente',
  'Cliente enfermo',
  'Profesional no disponible',
  'Duplicada',
];

/** Cancelar con motivo obligatorio (con motivos frecuentes a un toque). */
export function CancelAppointmentDialog({
  appointment,
  onClose,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
}) {
  const toast = useToast();
  const change = useChangeAppointmentStatus();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invalid = reason.trim().length < 3;

  const submit = async () => {
    if (invalid) {
      setError('Indica el motivo de la cancelación.');
      return;
    }
    try {
      await change.mutateAsync({ appointmentId: appointment.id, action: 'CANCELAR', reason });
      toast.success('Cita cancelada', 'El horario queda libre para otra cita.');
      onClose();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && !change.isPending && onClose()}
      title="¿Cancelar esta cita?"
      description={`${appointment.clientName} · ${appointment.serviceName}. El horario quedará libre y la cita se conserva en el historial como cancelada.`}
      confirmLabel="Cancelar cita"
      cancelLabel="Volver"
      destructive
      loading={change.isPending}
      onConfirm={() => void submit()}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos frecuentes">
          {QUICK_REASONS.map((r) => (
            <Button
              key={r}
              type="button"
              variant={reason === r ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={reason === r}
              onClick={() => {
                setReason(r);
                setError(null);
              }}
            >
              {r}
            </Button>
          ))}
        </div>
        <FormField label="Motivo" required error={error ?? undefined}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={reason}
              maxLength={200}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
          )}
        </FormField>
      </div>
    </ConfirmDialog>
  );
}

/** Corrección administrativa de un estado final, con motivo auditado. */
export function CorrectStatusDialog({
  appointment,
  onClose,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
}) {
  const toast = useToast();
  const correct = useCorrectAppointmentStatus();
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const statusError = showErrors && !status ? 'Elige el estado correcto.' : undefined;
  const reasonError =
    showErrors && reason.trim().length < 3 ? 'Indica el motivo de la corrección.' : undefined;

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (!status || reason.trim().length < 3) return;
    try {
      await correct.mutateAsync({ appointmentId: appointment.id, status, reason });
      toast.success('Estado corregido', 'El cambio quedó registrado en el historial.');
      onClose();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !correct.isPending && onClose()}
      title="Corregir estado"
      description={`Estado actual: ${APPOINTMENT_STATUS_LABELS[appointment.status]}. Usa esta opción solo para corregir un registro equivocado.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={correct.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={correct.isPending}>
            Corregir estado
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {error && <InlineAlert tone="danger" title={error} />}
        <FormField label="Estado correcto" required error={statusError}>
          {(p) => (
            <Select
              {...p}
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
            >
              <option value="" disabled>
                Selecciona un estado
              </option>
              {APPOINTMENT_STATUSES.filter((s) => s !== appointment.status).map((s) => (
                <option key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Motivo"
          required
          hint="Queda en el historial de la cita y en la auditoría."
          error={reasonError}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
