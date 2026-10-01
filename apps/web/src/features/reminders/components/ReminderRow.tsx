import {
  REMINDER_STATUS_LABELS,
  reminderMessage,
  whatsappUrl,
  type ReminderOutcome,
  type ReminderStatus,
} from '@kinesalud/shared';
import {
  CircleCheck,
  CircleX,
  Clock,
  MessageCircle,
  Phone,
  PhoneOff,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import {
  capitalizeFirst,
  formatDateTime,
  formatDayLong,
  formatPhone,
  formatTime,
} from '@/utils/format';
import { useHandleReminder, type ReminderItem } from '../api/reminders';

const STATUS_VISUALS: Record<ReminderStatus, { tone: BadgeTone; icon: LucideIcon }> = {
  PROGRAMADO: { tone: 'neutral', icon: Clock },
  ENVIADO: { tone: 'warning', icon: MessageCircle },
  SIN_RESPUESTA: { tone: 'warning', icon: PhoneOff },
  CONFIRMADO: { tone: 'success', icon: CircleCheck },
  FALLIDO: { tone: 'danger', icon: TriangleAlert },
  CANCELADO: { tone: 'neutral', icon: CircleX },
};

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const { tone, icon: Icon } = STATUS_VISUALS[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" />}>
      {REMINDER_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Un recordatorio: datos de la cita, contacto con el cliente (WhatsApp con el
 * mensaje listo o llamada) y el resultado del contacto.
 */
export function ReminderRow({
  reminder: r,
  clinicName,
  actionable,
}: {
  reminder: ReminderItem;
  clinicName: string;
  /** Muestra los botones de contacto y de resultado. */
  actionable: boolean;
}) {
  const toast = useToast();
  const handle = useHandleReminder();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReminderOutcome | null>(null);

  const message = reminderMessage(r, clinicName);
  const submit = async (outcome: ReminderOutcome, note?: string) => {
    setPending(outcome);
    try {
      await handle.mutateAsync({ reminderId: r.id, outcome, note: note ?? null });
      toast.success(
        outcome === 'CONFIRMADO'
          ? 'Cita confirmada'
          : outcome === 'CANCELADO'
            ? 'Cita cancelada'
            : 'Marcado sin respuesta',
        `${r.clientName} · ${capitalizeFirst(formatDayLong(r.appointmentDate))} ${formatTime(r.appointmentStartAt)}`,
      );
      setCancelling(false);
    } catch (err) {
      const e = toAppError(err);
      if (outcome === 'CANCELADO') setReasonError(e.message);
      else toast.error('No se pudo registrar el resultado', e.message);
    } finally {
      setPending(null);
    }
  };

  return (
    <article className="flex flex-col gap-3 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-fg">{r.clientName}</h3>
          <p className="text-body-sm text-fg-muted">
            <Link
              to={`/agenda?fecha=${r.appointmentDate}&cita=${r.appointmentId}`}
              className="underline-offset-2 hover:text-primary hover:underline"
            >
              {capitalizeFirst(formatDayLong(r.appointmentDate))} ·{' '}
              {formatTime(r.appointmentStartAt)}
            </Link>{' '}
            · {r.serviceName} · {r.professionalName}
          </p>
          {r.clientPhone && (
            <p className="tabular text-caption text-fg-subtle">Tel. {formatPhone(r.clientPhone)}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={r.type === 'CONFIRMACION' ? 'info' : 'neutral'}>
            {r.type === 'CONFIRMACION' ? 'Pedir confirmación' : 'Solo recordar'}
          </Badge>
          <ReminderStatusBadge status={r.status} />
        </div>
      </div>

      {r.status === 'PROGRAMADO' && (
        <p className="text-caption text-fg-subtle">
          Pasa a la cola el {formatDateTime(r.scheduledFor)}.
        </p>
      )}
      {(r.status === 'CONFIRMADO' || r.status === 'CANCELADO') && r.handledAt && (
        <p className="text-caption text-fg-subtle">
          {r.handledBy?.name ? `${r.handledBy.name} · ` : ''}
          {formatDateTime(r.handledAt)}
          {r.outcomeNote ? ` · ${r.outcomeNote}` : ''}
        </p>
      )}
      {r.status === 'FALLIDO' && r.lastError && (
        <p className="text-caption text-danger">No se pudo procesar: {r.lastError}</p>
      )}

      {actionable && (
        <div className="flex flex-wrap items-center gap-2">
          {r.clientPhoneE164 && (
            <>
              <Button asChild size="sm" variant="secondary">
                <a
                  href={whatsappUrl(r.clientPhoneE164, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Escribir por WhatsApp a ${r.clientName} (se abre en otra pestaña)`}
                >
                  <MessageCircle aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={`tel:${r.clientPhoneE164}`} aria-label={`Llamar a ${r.clientName}`}>
                  <Phone aria-hidden="true" />
                  Llamar
                </a>
              </Button>
            </>
          )}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
          <Button
            size="sm"
            onClick={() => void submit('CONFIRMADO')}
            loading={pending === 'CONFIRMADO'}
            disabled={pending !== null}
          >
            <CircleCheck aria-hidden="true" />
            {r.type === 'CONFIRMACION' ? 'Confirmó' : 'Avisado'}
          </Button>
          {r.status !== 'SIN_RESPUESTA' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void submit('SIN_RESPUESTA')}
              loading={pending === 'SIN_RESPUESTA'}
              disabled={pending !== null}
            >
              <PhoneOff aria-hidden="true" />
              No respondió
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCancelling(true)}
            disabled={pending !== null}
          >
            <CircleX aria-hidden="true" />
            Canceló
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cancelling}
        onOpenChange={(o) => !o && !handle.isPending && setCancelling(false)}
        title="¿El cliente cancela la cita?"
        description={`${r.clientName} · ${capitalizeFirst(formatDayLong(r.appointmentDate))} ${formatTime(r.appointmentStartAt)}. La cita se cancela y el horario queda libre.`}
        confirmLabel="Cancelar cita"
        cancelLabel="Volver"
        destructive
        loading={pending === 'CANCELADO'}
        onConfirm={() => {
          if (reason.trim().length < 3) {
            setReasonError('Indica el motivo de la cancelación.');
            return;
          }
          void submit('CANCELADO', reason);
        }}
      >
        <FormField label="Motivo" required error={reasonError ?? undefined}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={200}
              value={reason}
              placeholder="Viaja ese día, se siente mejor…"
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }}
            />
          )}
        </FormField>
      </ConfirmDialog>
    </article>
  );
}
