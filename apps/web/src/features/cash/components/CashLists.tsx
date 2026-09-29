import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@kinesalud/shared';
import { Banknote, CreditCard, QrCode, Undo2, type LucideIcon } from 'lucide-react';
import { AppointmentStatusBadge } from '@/components/domain/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import { cn } from '@/utils/cn';
import { formatDayShort, formatMoney, formatTime } from '@/utils/format';
import type { Payment } from '../api/cash';

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  EFECTIVO: Banknote,
  QR: QrCode,
  TARJETA: CreditCard,
};

export function MethodBadge({ method }: { method: PaymentMethod }) {
  const Icon = METHOD_ICONS[method];
  return (
    <Badge tone="neutral" icon={<Icon aria-hidden="true" />}>
      {PAYMENT_METHOD_LABELS[method]}
    </Badge>
  );
}

/** Cita por cobrar: hora, cliente, servicio, precio y botón "Cobrar". */
export function ChargeRow({
  appointment: a,
  showDate,
  onCharge,
  disabled,
}: {
  appointment: AgendaAppointment;
  /** En sesiones de días anteriores se muestra el día además de la hora. */
  showDate?: boolean;
  onCharge: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5">
      <div className="w-14 shrink-0">
        <p className="tabular text-body-sm font-semibold text-fg">{formatTime(a.startAt)}</p>
        {showDate && (
          <p className="text-caption text-fg-subtle capitalize">{formatDayShort(a.date)}</p>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-fg">{a.clientName}</span>
          <AppointmentStatusBadge status={a.status} />
        </p>
        <p className="truncate text-caption text-fg-muted">
          {a.serviceName} · {a.professionalName}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="tabular text-body-sm font-semibold text-fg">
          {a.priceCents !== null ? formatMoney(a.priceCents) : 'Sin precio'}
        </span>
        <Button
          size="sm"
          onClick={onCharge}
          disabled={disabled}
          aria-label={`Cobrar a ${a.clientName}, ${a.serviceName}`}
        >
          Cobrar
        </Button>
      </div>
    </div>
  );
}

/** Cobro registrado: medio de pago, monto y, en efectivo, recibido y cambio. */
export function PaymentRow({
  payment: p,
  onVoid,
}: {
  payment: Payment;
  /** Solo en la caja abierta. */
  onVoid?: () => void;
}) {
  const voided = p.status === 'ANULADO';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5">
      <p className="tabular w-14 shrink-0 text-body-sm text-fg-muted">
        {p.paidAt ? formatTime(p.paidAt) : '—'}
      </p>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-medium text-fg', voided && 'text-fg-muted')}>
          {p.clientName}
        </p>
        <p className="truncate text-caption text-fg-muted">
          {p.serviceName}
          {p.discountCents > 0 && ` · descuento ${formatMoney(p.discountCents)}`}
          {p.method === 'EFECTIVO' &&
            p.receivedCents !== null &&
            p.changeCents !== null &&
            p.changeCents > 0 &&
            ` · recibió ${formatMoney(p.receivedCents)}, cambio ${formatMoney(p.changeCents)}`}
          {p.reference && ` · op. ${p.reference}`}
        </p>
        {voided && p.voidReason && (
          <p className="truncate text-caption text-danger">Anulado: {p.voidReason}</p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {voided ? (
          <Badge tone="danger" icon={<Undo2 aria-hidden="true" />}>
            Anulado
          </Badge>
        ) : (
          <MethodBadge method={p.method} />
        )}
        <span
          className={cn(
            'tabular min-w-20 text-right text-body-sm font-semibold text-fg',
            voided && 'text-fg-subtle line-through',
          )}
        >
          {formatMoney(p.amountCents)}
        </span>
        {onVoid && !voided && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onVoid}
            aria-label={`Anular el cobro de ${p.clientName}`}
          >
            Anular
          </Button>
        )}
      </div>
    </div>
  );
}
