import { addDays, expectedCash, toDateKey } from '@kinesalud/shared';
import { CircleCheckBig, History, LockKeyhole, ReceiptText, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton, LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Stat } from '@/components/ui/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import { useNow } from '@/hooks/useNow';
import { capitalizeFirst, formatDayLong, formatMoney, formatTime } from '@/utils/format';
import {
  useCashSession,
  useDayAppointments,
  useOpenSessionId,
  useOverdueCharges,
  useRecentSessions,
  useSessionPayments,
  type CashSession,
  type Payment,
} from '../api/cash';
import { CloseCashDialog, OpenCashDialog, VoidPaymentDialog } from '../components/CashDialogs';
import { ChargeRow, PaymentRow } from '../components/CashLists';
import { PaymentDialog } from '../components/PaymentDialog';
import { chargeable, differenceView, sumPayments } from '../model';

type Tab = 'actual' | 'cierres';

/**
 * Caja del consultorio: apertura, cobro de sesiones con cálculo del cambio,
 * anulaciones y cierre con arqueo. Una sola caja compartida por recepción y
 * administración.
 */
export function CashPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('vista') === 'cierres' ? 'cierres' : 'actual';
  const register = useOpenSessionId();
  const openId = register.status === 'success' ? register.data : null;
  const session = useCashSession(openId);
  const [dialog, setDialog] = useState<'open' | 'close' | null>(null);

  const changeTab = (value: string) =>
    setParams(
      (p) => {
        if (value === 'cierres') p.set('vista', 'cierres');
        else p.delete('vista');
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title="Caja"
        description="Cobro de sesiones, apertura y cierre de la caja del consultorio."
        actions={
          register.status === 'success' &&
          (openId ? (
            session.status === 'success' && (
              <Button variant="secondary" onClick={() => setDialog('close')}>
                <LockKeyhole aria-hidden="true" />
                Cerrar caja
              </Button>
            )
          ) : (
            <Button onClick={() => setDialog('open')}>
              <Wallet aria-hidden="true" />
              Abrir caja
            </Button>
          ))
        }
      />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList label="Secciones de la caja">
          <TabsTrigger value="actual" icon={<Wallet aria-hidden="true" />}>
            Caja actual
          </TabsTrigger>
          <TabsTrigger value="cierres" icon={<History aria-hidden="true" />}>
            Cierres anteriores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actual">
          {register.status === 'loading' || (openId && session.status === 'loading') ? (
            <LoadingRegion label="Cargando la caja" className="flex flex-col gap-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-64 w-full" />
            </LoadingRegion>
          ) : register.status === 'error' ? (
            <ErrorState description={register.error.message} onRetry={register.retry} />
          ) : session.status === 'error' ? (
            <ErrorState description={session.error.message} onRetry={session.retry} />
          ) : (
            <CurrentCash
              session={session.status === 'success' ? session.data : null}
              onOpen={() => setDialog('open')}
            />
          )}
        </TabsContent>

        <TabsContent value="cierres">
          <SessionHistory />
        </TabsContent>
      </Tabs>

      {dialog === 'open' && <OpenCashDialog onClose={() => setDialog(null)} />}
      {dialog === 'close' && session.status === 'success' && (
        <CloseCashDialog session={session.data} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function CurrentCash({ session, onOpen }: { session: CashSession | null; onOpen: () => void }) {
  const now = useNow();
  const today = toDateKey(now);
  const [charging, setCharging] = useState<AgendaAppointment | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {session ? (
        <SessionSummary session={session} today={today} />
      ) : (
        <Panel>
          <EmptyState
            icon={<Wallet />}
            title="La caja está cerrada"
            description="Ábrela al empezar la jornada con el efectivo inicial. Los cobros solo se registran con la caja abierta."
            action={<Button onClick={onOpen}>Abrir caja</Button>}
          />
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <PendingCharges today={today} canCharge={!!session} onCharge={setCharging} />
        {session && <SessionPayments sessionId={session.id} />}
      </div>

      {charging && <PaymentDialog appointment={charging} onClose={() => setCharging(null)} />}
    </div>
  );
}

function SessionSummary({ session, today }: { session: CashSession; today: string }) {
  const total = session.totals.EFECTIVO + session.totals.QR + session.totals.TARJETA;
  return (
    <Panel flush>
      <h2 className="sr-only">Resumen de la caja abierta</h2>
      <div className="flex flex-col gap-5 p-4 md:p-5">
        {session.date < today && (
          <InlineAlert tone="warning" title="La caja sigue abierta desde otro día">
            Se abrió el {formatDayLong(session.date)}. Ciérrala para que el arqueo corresponda a una
            sola jornada.
          </InlineAlert>
        )}
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
          <Badge tone="success" icon={<CircleCheckBig aria-hidden="true" />}>
            Abierta
          </Badge>
          <span>
            {session.openedAt ? `Desde las ${formatTime(session.openedAt)}` : 'Recién abierta'}
            {session.openedBy.name ? ` · ${session.openedBy.name}` : ''} · Monto inicial{' '}
            <span className="tabular">{formatMoney(session.openingCents)}</span>
          </span>
        </p>
        <div className="grid grid-cols-2 gap-5 border-t border-border pt-5 lg:grid-cols-4 lg:gap-8">
          <Stat
            label="Efectivo en caja"
            value={<AnimatedNumber value={expectedCash(session)} format={formatMoney} />}
            hint="Inicial + cobros en efectivo"
          />
          <Stat
            label="Cobrado"
            value={<AnimatedNumber value={total} format={formatMoney} />}
            hint={`${session.paymentsCount} ${session.paymentsCount === 1 ? 'cobro' : 'cobros'}`}
          />
          <Stat
            label="QR / transferencia"
            value={<AnimatedNumber value={session.totals.QR} format={formatMoney} />}
          />
          <Stat
            label="Tarjeta"
            value={<AnimatedNumber value={session.totals.TARJETA} format={formatMoney} />}
          />
        </div>
      </div>
    </Panel>
  );
}

function PendingCharges({
  today,
  canCharge,
  onCharge,
}: {
  today: string;
  canCharge: boolean;
  onCharge: (a: AgendaAppointment) => void;
}) {
  const day = useDayAppointments(today);
  const overdue = useOverdueCharges(today);
  const todays = day.status === 'success' ? chargeable(day.data) : [];
  const older = overdue.status === 'success' ? overdue.data : [];
  const loading = day.status === 'loading' || overdue.status === 'loading';
  const error = day.status === 'error' ? day : overdue.status === 'error' ? overdue : null;
  const count = todays.length + older.length;

  return (
    <Panel
      flush
      title="Por cobrar"
      description={
        canCharge
          ? 'Sesiones de hoy sin pagar y atendidas de días anteriores.'
          : 'Abre la caja para cobrarlas.'
      }
      actions={count > 0 && <Badge tone="warning">{count}</Badge>}
    >
      {loading && <ListSkeleton rows={3} label="Cargando citas por cobrar…" />}
      {error && (
        <ErrorState size="compact" description={error.error.message} onRetry={error.retry} />
      )}
      {!loading && !error && count === 0 && (
        <EmptyState
          size="compact"
          icon={<CircleCheckBig />}
          title="Nada por cobrar"
          description="Todas las sesiones de hoy están pagadas o no hay citas."
        />
      )}
      {!loading && !error && count > 0 && (
        <div className="divide-y divide-border">
          {todays.length > 0 && (
            <ul className="divide-y divide-border" aria-label="Hoy">
              {todays.map((a) => (
                <li key={a.id}>
                  <ChargeRow appointment={a} disabled={!canCharge} onCharge={() => onCharge(a)} />
                </li>
              ))}
            </ul>
          )}
          {older.length > 0 && (
            <section aria-labelledby="overdue-title">
              <h3
                id="overdue-title"
                className="bg-surface-muted px-4 py-2 text-caption font-semibold text-fg-muted md:px-5"
              >
                De días anteriores
              </h3>
              <ul className="divide-y divide-border">
                {older.map((a) => (
                  <li key={a.id}>
                    <ChargeRow
                      appointment={a}
                      showDate
                      disabled={!canCharge}
                      onCharge={() => onCharge(a)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}

function SessionPayments({ sessionId }: { sessionId: string }) {
  const payments = useSessionPayments(sessionId);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const sums = payments.status === 'success' ? sumPayments(payments.data) : null;

  return (
    <Panel
      flush
      title="Cobros de esta caja"
      description={
        sums
          ? `${sums.count} ${sums.count === 1 ? 'cobro válido' : 'cobros válidos'} · ${formatMoney(sums.total)}`
          : undefined
      }
    >
      {payments.status === 'loading' && <ListSkeleton rows={3} label="Cargando cobros…" />}
      {payments.status === 'error' && (
        <ErrorState size="compact" description={payments.error.message} onRetry={payments.retry} />
      )}
      {payments.status === 'success' &&
        (payments.data.length === 0 ? (
          <EmptyState
            size="compact"
            icon={<ReceiptText />}
            title="Todavía no hay cobros"
            description="Los cobros de esta caja aparecerán aquí."
          />
        ) : (
          <ul className="divide-y divide-border">
            {payments.data.map((p) => (
              <li key={p.id}>
                <PaymentRow payment={p} onVoid={() => setVoiding(p)} />
              </li>
            ))}
          </ul>
        ))}
      {voiding && <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(null)} />}
    </Panel>
  );
}

/* ---------- Historial de cierres ---------- */

function sessionTotal(s: CashSession) {
  return s.totals.EFECTIVO + s.totals.QR + s.totals.TARJETA;
}

function DifferenceBadge({ cents }: { cents: number | null }) {
  if (cents === null) return <span className="text-fg-subtle">—</span>;
  const view = differenceView(cents);
  return <Badge tone={view.tone}>{view.label}</Badge>;
}

const columns: Column<CashSession>[] = [
  {
    id: 'fecha',
    header: 'Jornada',
    cell: (s) => (
      <div className="flex flex-col">
        <span className="font-medium text-fg">{capitalizeFirst(formatDayLong(s.date))}</span>
        <span className="text-caption text-fg-muted">
          {s.openedAt ? formatTime(s.openedAt) : '—'} – {s.closedAt ? formatTime(s.closedAt) : '—'}
          {s.closedBy?.name ? ` · cerró ${s.closedBy.name}` : ''}
        </span>
      </div>
    ),
  },
  {
    id: 'cobrado',
    header: 'Cobrado',
    className: 'text-right tabular',
    cell: (s) => (
      <div className="flex flex-col">
        <span className="font-medium text-fg">{formatMoney(sessionTotal(s))}</span>
        <span className="text-caption text-fg-muted">
          {s.paymentsCount} {s.paymentsCount === 1 ? 'cobro' : 'cobros'}
        </span>
      </div>
    ),
  },
  {
    id: 'esperado',
    header: 'Efectivo esperado',
    className: 'text-right tabular',
    hideBelowLg: true,
    cell: (s) => (s.expectedCashCents !== null ? formatMoney(s.expectedCashCents) : '—'),
  },
  {
    id: 'contado',
    header: 'Contado',
    className: 'text-right tabular',
    cell: (s) => (s.countedCashCents !== null ? formatMoney(s.countedCashCents) : '—'),
  },
  {
    id: 'diferencia',
    header: 'Diferencia',
    cell: (s) => (
      <div className="flex flex-col items-start gap-1">
        <DifferenceBadge cents={s.differenceCents} />
        {s.closingNote && (
          <span className="max-w-56 text-caption text-fg-muted">{s.closingNote}</span>
        )}
      </div>
    ),
  },
];

function SessionHistory() {
  const sessions = useRecentSessions();
  const closed = useMemo(
    () =>
      sessions.status === 'success' ? sessions.data.filter((s) => s.status === 'CERRADA') : [],
    [sessions],
  );
  const weekAgo = addDays(toDateKey(new Date()), -7);
  const lastWeek = closed.filter((s) => s.date >= weekAgo);
  const differences = lastWeek.filter((s) => (s.differenceCents ?? 0) !== 0).length;

  return (
    <Panel
      flush
      title="Cierres anteriores"
      description={
        sessions.status === 'success' && lastWeek.length > 0
          ? differences === 0
            ? 'Todos los cierres de la última semana cuadraron.'
            : `${differences} ${differences === 1 ? 'cierre' : 'cierres'} con diferencia en la última semana.`
          : 'Últimos 30 cierres de caja.'
      }
    >
      {sessions.status === 'loading' && <ListSkeleton rows={4} label="Cargando cierres…" />}
      {sessions.status === 'error' && (
        <ErrorState size="compact" description={sessions.error.message} onRetry={sessions.retry} />
      )}
      {sessions.status === 'success' &&
        (closed.length === 0 ? (
          <EmptyState
            size="compact"
            icon={<History />}
            title="Sin cierres todavía"
            description="Cada vez que se cierre la caja, su arqueo quedará aquí."
          />
        ) : (
          <DataTable
            rows={closed}
            columns={columns}
            getRowKey={(s) => s.id}
            caption="Cierres de caja"
            renderMobileRow={(s) => (
              <div className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-fg">
                    {capitalizeFirst(formatDayLong(s.date))}
                  </span>
                  <span className="tabular font-semibold text-fg">
                    {formatMoney(sessionTotal(s))}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                  <span>
                    Contado {s.countedCashCents !== null ? formatMoney(s.countedCashCents) : '—'}
                  </span>
                  <DifferenceBadge cents={s.differenceCents} />
                </div>
                {s.closingNote && <p className="text-caption text-fg-muted">{s.closingNote}</p>}
              </div>
            )}
          />
        ))}
    </Panel>
  );
}
