import {
  canCharge,
  expectedCash,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type Cents,
  type MethodTotals,
} from '@kinesalud/shared';
import { Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/feedback/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/StatCard';
import {
  useCashSession,
  useDayAppointments,
  useDayPayments,
  useIncomeStats,
  useOpenSessionId,
  useOverdueCharges,
  useProfessionalPayments,
} from '@/features/cash/api/cash';
import { incomeByDay, sumPayments } from '@/features/cash/model';
import { formatMoney } from '@/utils/format';
import { IncomeBreakdown, IncomeChart } from './IncomeChart';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

function methodItems(byMethod: MethodTotals) {
  return PAYMENT_METHODS.map((m) => ({
    key: m,
    label: PAYMENT_METHOD_LABELS[m],
    cents: byMethod[m] ?? 0,
  }));
}

function PanelLoading() {
  return (
    <LoadingRegion label="Cargando ingresos" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="h-36 w-full" />
    </LoadingRegion>
  );
}

/** Estado de la caja en una línea, con acceso directo. */
function CashStatus() {
  const register = useOpenSessionId();
  const session = useCashSession(register.status === 'success' ? register.data : null);
  const open = register.status === 'success' && register.data !== null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
      <Badge tone={open ? 'success' : 'neutral'} icon={<Wallet aria-hidden="true" />}>
        {open ? 'Caja abierta' : 'Caja cerrada'}
      </Badge>
      {open && session.status === 'success' && (
        <span className="tabular">Efectivo en caja: {formatMoney(expectedCash(session.data))}</span>
      )}
    </div>
  );
}

/** Sesiones atendidas sin pagar (hoy y días anteriores). */
function useUnpaidAttended(today: string) {
  const day = useDayAppointments(today);
  const overdue = useOverdueCharges(today);
  if (day.status !== 'success' || overdue.status !== 'success') return null;
  const todays = day.data.filter((a) => a.status === 'ATENDIDA' && canCharge(a));
  return todays.length + overdue.data.length;
}

/**
 * Administración: ingresos del día y del mes (documento `incomeStats` del
 * mes, una sola lectura), su evolución diaria y el reparto por medio de pago y
 * por profesional.
 */
export function AdminIncomePanel({
  today,
  professionalNames,
}: {
  today: string;
  professionalNames: Record<string, string>;
}) {
  const month = today.slice(0, 7);
  const stats = useIncomeStats(month);
  const unpaid = useUnpaidAttended(today);

  const view = useMemo(() => {
    if (stats.status !== 'success') return null;
    const s = stats.data;
    const byProfessional = Object.entries(s.byProfessional ?? {})
      .filter(([, cents]) => cents > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, cents]) => ({ key: id, label: professionalNames[id] ?? 'Profesional', cents }));
    return {
      todayCents: s.byDay?.[today.slice(8, 10)] ?? 0,
      days: incomeByDay(month, s.byDay ?? {}, today),
      byProfessional,
    };
  }, [stats, today, month, professionalNames]);

  return (
    <Panel
      title="Ingresos"
      description={`Cobros de sesiones de ${monthName(month)}. Los anulados no se cuentan.`}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/caja">
            <Wallet aria-hidden="true" />
            Ir a caja
          </Link>
        </Button>
      }
    >
      {stats.status === 'loading' && <PanelLoading />}
      {stats.status === 'error' && (
        <ErrorState size="compact" description={stats.error.message} onRetry={stats.retry} />
      )}
      {stats.status === 'success' && view && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8">
            <Stat label="Hoy" value={formatMoney(view.todayCents)} />
            <Stat
              label={`En ${monthName(month)}`}
              value={formatMoney(stats.data.totalCents)}
              hint={`${stats.data.count} ${stats.data.count === 1 ? 'cobro' : 'cobros'}`}
            />
            <Stat label="Sesiones por cobrar" value={unpaid ?? '—'} hint="Atendidas y sin pagar" />
          </div>
          <CashStatus />
          <div className="flex flex-col gap-2">
            <h3 className="text-body-sm font-semibold text-fg">Ingresos por día</h3>
            <IncomeChart days={view.days} today={today} />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-body-sm font-semibold text-fg">Por medio de pago</h3>
              <IncomeBreakdown
                label="Ingresos por medio de pago"
                items={methodItems(stats.data.byMethod)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-body-sm font-semibold text-fg">Por profesional</h3>
              {view.byProfessional.length > 0 ? (
                <IncomeBreakdown label="Ingresos por profesional" items={view.byProfessional} />
              ) : (
                <p className="text-body-sm text-fg-subtle">Todavía no hay cobros este mes.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Recepción: ingresos del día, por medio de pago, y el estado de la caja. */
export function FrontDeskIncomePanel({ today }: { today: string }) {
  const payments = useDayPayments(today);
  const unpaid = useUnpaidAttended(today);
  const sums = payments.status === 'success' ? sumPayments(payments.data) : null;

  return (
    <Panel
      title="Ingresos de hoy"
      description="Cobros de sesiones registrados hoy."
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/caja">
            <Wallet aria-hidden="true" />
            Ir a caja
          </Link>
        </Button>
      }
    >
      {payments.status === 'loading' && <PanelLoading />}
      {payments.status === 'error' && (
        <ErrorState size="compact" description={payments.error.message} onRetry={payments.retry} />
      )}
      {sums && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8">
            <Stat
              label="Cobrado hoy"
              value={formatMoney(sums.total)}
              hint={`${sums.count} ${sums.count === 1 ? 'cobro' : 'cobros'}`}
            />
            <Stat label="Sesiones por cobrar" value={unpaid ?? '—'} hint="Atendidas y sin pagar" />
          </div>
          <CashStatus />
          <IncomeBreakdown
            label="Cobrado hoy por medio de pago"
            items={methodItems(sums.byMethod)}
          />
        </div>
      )}
    </Panel>
  );
}

/** Profesional: lo que generaron sus sesiones hoy y en el mes. */
export function ProfessionalIncomePanel({
  today,
  professionalId,
}: {
  today: string;
  professionalId: string;
}) {
  const month = today.slice(0, 7);
  const payments = useProfessionalPayments(professionalId, `${month}-01`, today);
  const view = useMemo(() => {
    if (payments.status !== 'success') return null;
    const valid = payments.data.filter((p) => p.status === 'VALIDO');
    const sumOf = (list: typeof valid): Cents => list.reduce((s, p) => s + p.amountCents, 0);
    const todays = valid.filter((p) => p.date === today);
    return {
      todayCents: sumOf(todays),
      todayCount: todays.length,
      monthCents: sumOf(valid),
      monthCount: valid.length,
    };
  }, [payments, today]);

  return (
    <Panel title="Tus ingresos" description="Cobros de las sesiones que atendiste.">
      {payments.status === 'loading' && <PanelLoading />}
      {payments.status === 'error' && (
        <ErrorState size="compact" description={payments.error.message} onRetry={payments.retry} />
      )}
      {view && (
        <div className="grid grid-cols-2 gap-5 sm:gap-8">
          <Stat
            label="Hoy"
            value={formatMoney(view.todayCents)}
            hint={`${view.todayCount} ${view.todayCount === 1 ? 'sesión cobrada' : 'sesiones cobradas'}`}
          />
          <Stat
            label={`En ${monthName(month)}`}
            value={formatMoney(view.monthCents)}
            hint={`${view.monthCount} ${view.monthCount === 1 ? 'sesión cobrada' : 'sesiones cobradas'}`}
          />
        </div>
      )}
    </Panel>
  );
}
