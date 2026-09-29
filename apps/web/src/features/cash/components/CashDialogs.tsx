import { expectedCash, parseMoney, PAYMENT_METHOD_LABELS } from '@kinesalud/shared';
import { useState } from 'react';
import { MoneyInput } from '@/components/domain/MoneyInput';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { formatMoney, formatTime } from '@/utils/format';
import {
  useCloseCash,
  useOpenCash,
  useVoidPayment,
  type CashSession,
  type Payment,
} from '../api/cash';
import { differenceView } from '../model';

/** Abrir la caja con el efectivo inicial (sencillo para dar cambio). */
export function OpenCashDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const open = useOpenCash();
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [general, setGeneral] = useState<string | null>(null);

  const submit = async () => {
    const opening = parseMoney(amountText);
    if (opening === null) {
      setError('Ingresa el monto inicial (0 si la caja empieza vacía).');
      return;
    }
    try {
      await open.mutateAsync({ openingCents: opening, note });
      toast.success('Caja abierta', `Monto inicial: ${formatMoney(opening)}.`);
      onClose();
    } catch (err) {
      setGeneral(toAppError(err).message);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && !open.isPending && onClose()}
      title="Abrir caja"
      description="Cuenta el efectivo con el que empieza la caja: servirá para dar cambio y se compara al cerrar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={open.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={open.isPending}>
            Abrir caja
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {general && <InlineAlert tone="danger">{general}</InlineAlert>}
        <FormField label="Monto inicial" required error={error ?? undefined}>
          {(p) => (
            <MoneyInput
              {...p}
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                setError(null);
              }}
            />
          )}
        </FormField>
        <FormField label="Nota" optional>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}

/**
 * Cierre (arqueo): se cuenta el efectivo y se compara con lo esperado. QR y
 * tarjeta se informan aparte porque no están en el cajón.
 */
export function CloseCashDialog({
  session,
  onClose,
}: {
  session: CashSession;
  onClose: () => void;
}) {
  const toast = useToast();
  const close = useCloseCash();
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [general, setGeneral] = useState<string | null>(null);

  const expected = expectedCash(session);
  const counted = parseMoney(countedText);
  const diff = counted !== null ? counted - expected : null;
  const diffView = diff !== null ? differenceView(diff) : null;

  const countedError =
    showErrors && counted === null ? 'Ingresa el efectivo contado en la caja.' : undefined;
  const noteError =
    showErrors && diff !== null && diff !== 0 && note.trim() === ''
      ? 'Explica el motivo de la diferencia.'
      : undefined;

  const submit = async () => {
    setShowErrors(true);
    setGeneral(null);
    if (counted === null || (diff !== 0 && note.trim() === '')) return;
    try {
      const result = await close.mutateAsync({
        sessionId: session.id,
        countedCashCents: counted,
        note,
      });
      toast.success('Caja cerrada', differenceView(result.differenceCents).label + '.');
      onClose();
    } catch (err) {
      setGeneral(toAppError(err).message);
    }
  };

  const rows: [string, string][] = [
    ['Monto inicial', formatMoney(session.openingCents)],
    [
      `Cobros en ${PAYMENT_METHOD_LABELS.EFECTIVO.toLowerCase()}`,
      formatMoney(session.totals.EFECTIVO),
    ],
  ];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !close.isPending && onClose()}
      title="Cerrar caja"
      description={`Abierta ${session.openedAt ? `a las ${formatTime(session.openedAt)}` : ''}${session.openedBy.name ? ` por ${session.openedBy.name}` : ''}. Después del cierre no se pueden anular sus cobros.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={close.isPending}>
            Volver
          </Button>
          <Button onClick={() => void submit()} loading={close.isPending}>
            Cerrar caja
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
        {general && <InlineAlert tone="danger">{general}</InlineAlert>}
        <dl className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted px-4 py-3 text-body-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="tabular text-fg">{value}</dd>
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2">
            <dt className="font-semibold text-fg">Efectivo esperado</dt>
            <dd className="tabular text-h2 text-fg">{formatMoney(expected)}</dd>
          </div>
          <p className="pt-1 text-caption text-fg-subtle">
            Fuera del cajón: QR {formatMoney(session.totals.QR)} · Tarjeta{' '}
            {formatMoney(session.totals.TARJETA)}.
          </p>
        </dl>

        <FormField label="Efectivo contado" required error={countedError}>
          {(p) => (
            <MoneyInput
              {...p}
              value={countedText}
              onChange={(e) => setCountedText(e.target.value)}
            />
          )}
        </FormField>

        <div role="status" aria-live="polite" className="min-h-6">
          {diffView && diff !== null && (
            <p className="flex items-center gap-2 text-body-sm">
              <span className="text-fg-muted">Diferencia:</span>
              <Badge tone={diffView.tone}>{diffView.label}</Badge>
            </p>
          )}
        </div>

        <FormField
          label="Observaciones"
          required={diff !== null && diff !== 0}
          optional={diff === null || diff === 0}
          error={noteError}
          hint={
            diff !== null && diff !== 0 ? 'Queda registrado en el historial de cierres.' : undefined
          }
        >
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}

/** Anular un cobro de la caja abierta: la cita vuelve a quedar por cobrar. */
export function VoidPaymentDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const toast = useToast();
  const voidPayment = useVoidPayment();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 5) {
      setError('Describe el motivo (mínimo 5 caracteres).');
      return;
    }
    try {
      await voidPayment.mutateAsync({ paymentId: payment.id, reason });
      toast.success(
        'Cobro anulado',
        payment.method === 'EFECTIVO'
          ? `Si ya lo recibiste, devuelve ${formatMoney(payment.amountCents)} al cliente.`
          : 'La cita vuelve a quedar por cobrar.',
      );
      onClose();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && !voidPayment.isPending && onClose()}
      title="¿Anular este cobro?"
      description={`${payment.clientName} · ${formatMoney(payment.amountCents)} en ${PAYMENT_METHOD_LABELS[payment.method].toLowerCase()}. Se descuenta de la caja y la cita vuelve a quedar por cobrar. El cobro anulado se conserva en el historial.`}
      confirmLabel="Anular cobro"
      cancelLabel="Volver"
      destructive
      loading={voidPayment.isPending}
      onConfirm={() => void submit()}
    >
      <FormField label="Motivo" required error={error ?? undefined}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            maxLength={200}
            value={reason}
            placeholder="Medio de pago equivocado, devolución…"
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
