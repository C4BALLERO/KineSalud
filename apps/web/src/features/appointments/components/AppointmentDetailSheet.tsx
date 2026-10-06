import {
  APPOINTMENT_ACTION_LABELS,
  APPOINTMENT_EVENT_LABELS,
  APPOINTMENT_STATUS_LABELS,
  canAccessRecord,
  canCharge,
  canRecordSession,
  hasPermission,
  PAYMENT_METHOD_LABELS,
  type AppointmentAction,
} from '@kinesalud/shared';
import {
  CalendarClock,
  CheckCheck,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardPen,
  Clock,
  PencilLine,
  UserRound,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { Badge } from '@/components/ui/Badge';
import { AppointmentStatusBadge } from '@/components/domain/StatusBadge';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Sheet } from '@/components/ui/Sheet';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useRequiredSession } from '@/features/auth/session';
import { usePayment } from '@/features/cash/api/cash';
import { PaymentDialog } from '@/features/cash/components/PaymentDialog';
import { useNow } from '@/hooks/useNow';
import { toAppError } from '@/lib/errors';
import {
  capitalizeFirst,
  formatDateTime,
  formatDayLong,
  formatMoney,
  formatTime,
} from '@/utils/format';
import {
  useAppointment,
  useAppointmentEvents,
  useChangeAppointmentStatus,
  type AgendaAppointment,
  type AppointmentEvent,
} from '../api/appointments';
import { availableActions, canRescheduleNow, type AppointmentPermissions } from '../model';
import { RescheduleDialog } from './RescheduleDialog';
import { CancelAppointmentDialog, CorrectStatusDialog } from './StatusDialogs';

const ACTION_ICONS: Record<AppointmentAction, LucideIcon> = {
  CONFIRMAR: CircleCheck,
  ATENDER: CheckCheck,
  NO_ASISTIO: UserX,
  CANCELAR: CircleX,
};

type OpenDialog = 'cancel' | 'reschedule' | 'correct' | 'charge' | null;

/**
 * Detalle de la cita en un panel lateral: datos, acciones según el estado y
 * el rol, e historial. En escritorio deja visible la agenda de fondo.
 */
export function AppointmentDetailSheet({
  appointmentId,
  onClose,
}: {
  appointmentId: string | null;
  onClose: () => void;
}) {
  const appointment = useAppointment(appointmentId);
  const title =
    appointment.status === 'success' ? appointment.data.clientName : 'Detalle de la cita';

  return (
    <Sheet
      open={appointmentId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={
        appointment.status === 'success'
          ? `${capitalizeFirst(formatDayLong(appointment.data.date))} · ${formatTime(appointment.data.startAt)} – ${formatTime(appointment.data.endAt)}`
          : undefined
      }
      width="md"
    >
      {appointment.status === 'loading' && (
        <div className="flex flex-col gap-4 p-5" aria-busy="true">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}
      {appointment.status === 'error' && (
        <ErrorState description={appointment.error.message} onRetry={appointment.retry} />
      )}
      {appointment.status === 'not-found' && (
        <EmptyState
          icon={<CalendarClock />}
          title="Cita no encontrada"
          description="Puede que el enlace sea incorrecto o que no tengas acceso a esta cita."
        />
      )}
      {appointment.status === 'success' && <Detail appointment={appointment.data} />}
    </Sheet>
  );
}

function Detail({ appointment: a }: { appointment: AgendaAppointment }) {
  const session = useRequiredSession();
  const now = useNow();
  const toast = useToast();
  const change = useChangeAppointmentStatus();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [pending, setPending] = useState<AppointmentAction | null>(null);

  const permissions: AppointmentPermissions = {
    canManage: canAccessRecord(session, 'appointments.manage', [a.professionalId]),
    canConfirm: canAccessRecord(session, 'appointments.manage', [a.professionalId]),
    canMarkAttendance: canAccessRecord(session, 'attendance.mark', [a.professionalId]),
    canCorrect: hasPermission(session, 'appointments.correct'),
  };
  const actions = availableActions(a, permissions, now);
  const reschedulable = canRescheduleNow(a, permissions);
  const closed = actions.length === 0 && !reschedulable;
  const disabledReason = actions.find((s) => !s.enabled)?.reason ?? null;
  const cancelAction = actions.find((s) => s.action === 'CANCELAR');
  const seesPayment = canAccessRecord(session, 'payments.read', [a.professionalId]);
  const writesClinical = canAccessRecord(session, 'clinical.write', [a.professionalId]);
  const sessionCheck = canRecordSession(a, now);
  const managesPayments = hasPermission(session, 'payments.manage');

  const run = async (action: AppointmentAction) => {
    if (action === 'CANCELAR') return setDialog('cancel');
    setPending(action);
    try {
      await change.mutateAsync({ appointmentId: a.id, action });
      toast.success(
        action === 'CONFIRMAR'
          ? 'Cita confirmada'
          : action === 'ATENDER'
            ? 'Asistencia registrada'
            : 'Inasistencia registrada',
      );
    } catch (err) {
      toast.error('No se pudo actualizar la cita', toAppError(err).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <AppointmentStatusBadge status={a.status} />
        <CategoryTag category={a.category} />
      </div>

      <KeyValueList
        columns={1}
        items={[
          {
            label: 'Cliente',
            value: (
              <Link
                to={`/clientes/${a.clientId}`}
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
              >
                <UserRound aria-hidden="true" className="size-4" />
                {a.clientName}
              </Link>
            ),
          },
          {
            label: 'Servicio',
            value: `${a.serviceName}${a.sessionNumber ? ` · sesión ${a.sessionNumber}` : ''}`,
          },
          { label: 'Profesional', value: a.professionalName },
          { label: 'Espacio', value: a.roomName },
          ...(a.notes ? [{ label: 'Nota', value: a.notes }] : []),
          ...(a.cancelReason ? [{ label: 'Motivo de cancelación', value: a.cancelReason }] : []),
        ]}
      />

      {writesClinical && (a.sessionRecorded || sessionCheck.ok) && (
        <section
          aria-label="Sesión clínica"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
        >
          <p className="text-body-sm text-fg">
            {a.sessionRecorded
              ? 'La sesión ya está registrada.'
              : a.status === 'ATENDIDA'
                ? 'Falta registrar la sesión.'
                : 'Registra la sesión al atender: la cita quedará como atendida.'}
          </p>
          <Button asChild size="sm" variant={a.sessionRecorded ? 'secondary' : 'primary'}>
            <Link to={`/citas/${a.id}/sesion`}>
              <ClipboardPen aria-hidden="true" />
              {a.sessionRecorded ? 'Ver sesión' : 'Registrar sesión'}
            </Link>
          </Button>
        </section>
      )}

      {seesPayment && (
        <PaymentSection
          appointment={a}
          onCharge={managesPayments ? () => setDialog('charge') : undefined}
        />
      )}

      {!closed && (
        <section aria-label="Acciones" className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {actions
              .filter((s) => s.action !== 'CANCELAR')
              .map((s) => {
                const Icon = ACTION_ICONS[s.action];
                return (
                  <Button
                    key={s.action}
                    variant={s.action === 'NO_ASISTIO' ? 'secondary' : 'primary'}
                    disabled={!s.enabled || (pending !== null && pending !== s.action)}
                    loading={pending === s.action}
                    onClick={() => void run(s.action)}
                    aria-describedby={s.reason ? 'action-reason' : undefined}
                  >
                    <Icon aria-hidden="true" />
                    {APPOINTMENT_ACTION_LABELS[s.action]}
                  </Button>
                );
              })}
            {reschedulable && (
              <Button variant="secondary" onClick={() => setDialog('reschedule')}>
                <CalendarClock aria-hidden="true" />
                Reprogramar
              </Button>
            )}
            {cancelAction && (
              <Button
                variant="secondary"
                disabled={!cancelAction.enabled}
                onClick={() => setDialog('cancel')}
              >
                <CircleX aria-hidden="true" />
                Cancelar cita
              </Button>
            )}
          </div>
          {disabledReason && (
            <p id="action-reason" className="text-caption text-fg-subtle">
              {disabledReason}
            </p>
          )}
        </section>
      )}
      {closed && permissions.canCorrect && (
        <Button variant="secondary" className="w-fit" onClick={() => setDialog('correct')}>
          <PencilLine aria-hidden="true" />
          Corregir estado
        </Button>
      )}

      <History appointmentId={a.id} />

      {dialog === 'cancel' && (
        <CancelAppointmentDialog appointment={a} onClose={() => setDialog(null)} />
      )}
      {dialog === 'reschedule' && (
        <RescheduleDialog appointment={a} onClose={() => setDialog(null)} />
      )}
      {dialog === 'correct' && (
        <CorrectStatusDialog appointment={a} onClose={() => setDialog(null)} />
      )}
      {dialog === 'charge' && <PaymentDialog appointment={a} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** Estado de pago de la cita y, para recepción o administración, el botón "Cobrar". */
function PaymentSection({
  appointment: a,
  onCharge,
}: {
  appointment: AgendaAppointment;
  onCharge?: () => void;
}) {
  const payment = usePayment(a.paymentStatus === 'PAGADA' ? a.paymentId : null);
  if (a.paymentStatus !== 'PAGADA' && !canCharge(a)) return null;

  return (
    <section
      aria-labelledby="payment-title"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          id="payment-title"
          className="flex items-center gap-2 text-body-sm font-semibold text-fg"
        >
          Pago
          {a.paymentStatus === 'PAGADA' ? (
            <Badge tone="success" icon={<CircleDollarSign aria-hidden="true" />}>
              Pagada
            </Badge>
          ) : (
            <Badge tone="warning" icon={<Clock aria-hidden="true" />}>
              Por cobrar
            </Badge>
          )}
        </h3>
        <p className="text-caption text-fg-muted">
          {a.paymentStatus === 'PAGADA'
            ? payment.status === 'success'
              ? `${formatMoney(payment.data.amountCents)} · ${PAYMENT_METHOD_LABELS[payment.data.method]}${payment.data.paidAt ? ` · ${formatDateTime(payment.data.paidAt)}` : ''}${payment.data.discountCents > 0 ? ` · descuento ${formatMoney(payment.data.discountCents)}` : ''}`
              : 'Cargando el cobro…'
            : a.priceCents !== null
              ? `Precio: ${formatMoney(a.priceCents)}`
              : 'Se cobra al precio actual del servicio.'}
        </p>
      </div>
      {a.paymentStatus !== 'PAGADA' && onCharge && (
        <Button size="sm" onClick={onCharge}>
          <CircleDollarSign aria-hidden="true" />
          Cobrar
        </Button>
      )}
    </section>
  );
}

function eventDetail(e: AppointmentEvent): string | null {
  if (e.type === 'REPROGRAMADA' && e.from && e.to) {
    const from = `${e.from.date ? formatDayLong(e.from.date) : ''} ${e.from.start ?? ''}`.trim();
    const to = `${e.to.date ? formatDayLong(e.to.date) : ''} ${e.to.start ?? ''}`.trim();
    const who =
      e.from.professionalName && e.from.professionalName !== e.to.professionalName
        ? ` (${e.from.professionalName} → ${e.to.professionalName})`
        : '';
    return `De ${from} a ${to}${who}`;
  }
  if (e.type === 'CORREGIDA' && e.from && e.to) {
    return `${APPOINTMENT_STATUS_LABELS[e.from.status]} → ${APPOINTMENT_STATUS_LABELS[e.to.status]}`;
  }
  return null;
}

function History({ appointmentId }: { appointmentId: string }) {
  const events = useAppointmentEvents(appointmentId);
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h3 id="history-title" className="text-h3 text-fg">
        Historial
      </h3>
      {events.status === 'loading' && <ListSkeleton rows={2} label="Cargando historial…" />}
      {events.status === 'error' && (
        <p className="text-body-sm text-fg-muted">No se pudo cargar el historial.</p>
      )}
      {events.status === 'success' &&
        (events.data.length === 0 ? (
          <p className="text-body-sm text-fg-subtle">
            Sin movimientos registrados (cita de datos de demostración).
          </p>
        ) : (
          <ol className="flex flex-col gap-3 border-l border-border pl-4">
            {events.data.map((e) => {
              const detail = eventDetail(e);
              return (
                <li key={e.id} className="relative flex flex-col gap-0.5">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-border-strong"
                  />
                  <span className="text-body-sm font-medium text-fg">
                    {APPOINTMENT_EVENT_LABELS[e.type]}
                  </span>
                  {detail && <span className="text-caption text-fg-muted">{detail}</span>}
                  {e.reason && (
                    <span className="text-caption text-fg-muted">Motivo: {e.reason}</span>
                  )}
                  <span className="text-caption text-fg-subtle">
                    {e.at ? formatDateTime(e.at) : 'Ahora'}
                    {e.actor.name ? ` · ${e.actor.name}` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        ))}
    </section>
  );
}
