import {
  changeFor,
  parseMoney,
  PAYMENT_METHOD_LABELS,
  suggestedReceived,
  type PaymentMethod,
} from '@kinesalud/shared';
import { doc } from 'firebase/firestore';
import { useState } from 'react';
import { Link } from 'react-router';
import { MoneyInput } from '@/components/domain/MoneyInput';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toast-context';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { toAppError } from '@/lib/errors';
import { db } from '@/lib/firebase';
import { cn } from '@/utils/cn';
import { capitalizeFirst, formatDayLong, formatMoney, formatTime } from '@/utils/format';
import { useCharge, useOpenSessionId } from '../api/cash';

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'QR', label: 'QR' },
  { value: 'TARJETA', label: 'Tarjeta' },
];

type Field = 'discount' | 'discountReason' | 'received';

/**
 * Cobro de una cita: total con descuento opcional, medio de pago y, en
 * efectivo, el monto recibido con el cambio a devolver calculado al instante.
 */
export function PaymentDialog({
  appointment: a,
  onClose,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
}) {
  const toast = useToast();
  const charge = useCharge();
  const register = useOpenSessionId();
  // Citas agendadas antes de configurar precios: se usa el precio actual del servicio.
  const service = useLiveDoc(
    a.priceCents === null ? `services/${a.serviceId}` : null,
    () => doc(db, 'services', a.serviceId),
    (snap) => (snap.get('priceCents') as number | null | undefined) ?? null,
  );
  const listPrice = a.priceCents ?? (service.status === 'success' ? service.data : null);
  const priceLoading = a.priceCents === null && service.status === 'loading';

  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO');
  const [withDiscount, setWithDiscount] = useState(false);
  const [discountText, setDiscountText] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [reference, setReference] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<{ field?: Field; message: string } | null>(null);

  const discount = withDiscount ? parseMoney(discountText) : 0;
  const amount = listPrice !== null && discount !== null ? listPrice - discount : null;
  const received = parseMoney(receivedText);
  const change = amount !== null && received !== null ? changeFor(amount, received) : null;

  const errors: Partial<Record<Field, string>> = {};
  if (withDiscount) {
    if (discount === null || discount === 0) errors.discount = 'Ingresa el monto del descuento.';
    else if (listPrice !== null && discount > listPrice)
      errors.discount = 'El descuento no puede superar el precio.';
    if (discountReason.trim() === '') errors.discountReason = 'Indica el motivo del descuento.';
  }
  if (method === 'EFECTIVO' && amount !== null && amount >= 0) {
    if (received === null) errors.received = 'Ingresa el monto que entregó el cliente.';
    else if (received < amount)
      errors.received = `No alcanza: faltan ${formatMoney(amount - received)}.`;
  }
  const errorOf = (f: Field) =>
    (showErrors ? errors[f] : undefined) ??
    (serverError?.field === f ? serverError.message : undefined);

  const cashClosed = register.status === 'success' && register.data === null;
  const blocked = cashClosed || listPrice === null || priceLoading;

  const submit = async () => {
    setShowErrors(true);
    setServerError(null);
    if (blocked || Object.keys(errors).length > 0 || amount === null || amount < 0) return;
    try {
      const result = await charge.mutateAsync({
        appointmentId: a.id,
        method,
        discountCents: discount ?? 0,
        discountReason: withDiscount ? discountReason : null,
        receivedCents: method === 'EFECTIVO' ? received : null,
        reference: method === 'EFECTIVO' ? null : reference,
      });
      toast.success(
        'Cobro registrado',
        result.changeCents
          ? `Entrega el cambio: ${formatMoney(result.changeCents)}.`
          : `${formatMoney(result.amountCents)} · ${PAYMENT_METHOD_LABELS[method]}.`,
      );
      onClose();
    } catch (err) {
      const e = toAppError(err);
      const field = e.field as string | undefined;
      setServerError({
        field:
          field === 'receivedCents'
            ? 'received'
            : field === 'discountCents'
              ? 'discount'
              : field === 'discountReason'
                ? 'discountReason'
                : undefined,
        message: e.message,
      });
    }
  };

  const general = serverError && !serverError.field ? serverError.message : null;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !charge.isPending && onClose()}
      title="Cobrar sesión"
      description={`${a.clientName} · ${a.serviceName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={charge.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={charge.isPending} disabled={blocked}>
            {amount !== null && amount >= 0 ? `Cobrar ${formatMoney(amount)}` : 'Cobrar'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-caption text-fg-muted">
          {capitalizeFirst(formatDayLong(a.date))} · {formatTime(a.startAt)} · {a.professionalName}
        </p>

        {cashClosed && (
          <InlineAlert
            tone="warning"
            title="La caja está cerrada"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link to="/caja">Ir a Caja</Link>
              </Button>
            }
          >
            Ábrela para registrar cobros.
          </InlineAlert>
        )}
        {!priceLoading && listPrice === null && (
          <InlineAlert tone="warning" title="El servicio no tiene precio">
            Pide a la administración que lo configure en Servicios.
          </InlineAlert>
        )}
        {general && <InlineAlert tone="danger">{general}</InlineAlert>}

        {/* Resumen del importe */}
        <dl className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted px-4 py-3 text-body-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Precio</dt>
            <dd className="tabular text-fg">
              {listPrice !== null ? formatMoney(listPrice) : priceLoading ? '…' : '—'}
            </dd>
          </div>
          {withDiscount && discount !== null && discount > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Descuento</dt>
              <dd className="tabular text-fg">−{formatMoney(discount)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2">
            <dt className="font-semibold text-fg">Total a cobrar</dt>
            <dd className="tabular text-h1 text-fg">
              {amount !== null && amount >= 0 ? formatMoney(amount) : '—'}
            </dd>
          </div>
        </dl>

        <Checkbox
          label="Aplicar descuento"
          checked={withDiscount}
          onCheckedChange={(v) => {
            setWithDiscount(v);
            setServerError(null);
          }}
        />
        {withDiscount && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <FormField label="Descuento" required error={errorOf('discount')}>
              {(p) => (
                <MoneyInput
                  {...p}
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Motivo" required error={errorOf('discountReason')}>
              {(p) => (
                <Input
                  {...p}
                  value={discountReason}
                  maxLength={120}
                  placeholder="Convenio, promoción…"
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
              )}
            </FormField>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm font-medium text-fg" id="payment-method-label">
            Medio de pago
          </span>
          <SegmentedControl
            label="Medio de pago"
            value={method}
            onChange={(m) => {
              setMethod(m);
              setServerError(null);
            }}
            options={METHOD_OPTIONS}
            className="w-full [&>*]:flex-1"
          />
        </div>

        {method === 'EFECTIVO' ? (
          <div className="flex flex-col gap-3">
            <FormField label="Monto recibido" required error={errorOf('received')}>
              {(p) => (
                <MoneyInput
                  {...p}
                  value={receivedText}
                  onChange={(e) => {
                    setReceivedText(e.target.value);
                    setServerError(null);
                  }}
                />
              )}
            </FormField>
            {amount !== null && amount > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Montos frecuentes">
                {suggestedReceived(amount).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={received === value ? 'primary' : 'secondary'}
                    aria-pressed={received === value}
                    onClick={() => setReceivedText(String(value / 100).replace('.', ','))}
                  >
                    {value === amount ? 'Exacto' : formatMoney(value)}
                  </Button>
                ))}
              </div>
            )}
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'flex items-baseline justify-between gap-4 rounded-md border px-4 py-3',
                change !== null
                  ? 'border-success-border bg-success-subtle'
                  : 'border-border bg-surface',
              )}
            >
              <span className="text-body-sm font-semibold text-fg">Cambio a devolver</span>
              <span
                className={cn(
                  'tabular text-display',
                  change !== null ? 'text-success' : 'text-fg-subtle',
                )}
              >
                {change !== null ? formatMoney(change) : '—'}
              </span>
            </div>
          </div>
        ) : (
          <FormField
            label="Nro. de operación"
            optional
            hint={
              method === 'QR'
                ? 'El código de la transferencia, para ubicarla en el extracto.'
                : 'Los últimos dígitos del voucher del POS.'
            }
          >
            {(p) => (
              <Input
                {...p}
                value={reference}
                maxLength={40}
                onChange={(e) => setReference(e.target.value)}
              />
            )}
          </FormField>
        )}
        {/* Enviar con Enter desde cualquier campo. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
