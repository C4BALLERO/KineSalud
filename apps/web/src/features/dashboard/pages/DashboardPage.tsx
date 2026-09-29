import { addDays, startOfWeek, toDateKey, weekdayOf } from '@kinesalud/shared';
import {
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  HeartPulse,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppointmentRow } from '@/components/domain/AppointmentRow';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ListSkeleton, LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/StatCard';
import { useRequiredSession } from '@/features/auth/session';
import { useExceptions } from '@/features/staff/api/staff';
import { useNow } from '@/hooks/useNow';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { capitalizeFirst, formatDayLong, greetingFor } from '@/utils/format';
import {
  useActiveClientsCount,
  useActiveTreatments,
  useAppointmentsBetween,
  useProfessionals,
} from '../api/dashboard';
import { AlertsList } from '../components/AlertsList';
import { DaySummary } from '../components/DaySummary';
import {
  AdminIncomePanel,
  FrontDeskIncomePanel,
  ProfessionalIncomePanel,
} from '../components/IncomePanel';
import { WeekChart } from '../components/WeekChart';
import {
  appointmentsOn,
  availableToday,
  buildAlerts,
  countByStatus,
  isScheduled,
  nextDayWithAppointments,
  weekSummary,
} from '../model';

const AGENDA_LIMIT = 8;

/**
 * Inicio. Administración y recepción ven todo el consultorio; el profesional
 * ve "Mi día" (solo sus citas, pacientes y tratamientos).
 */
export function DashboardPage() {
  const session = useRequiredSession();
  const now = useNow();
  const today = toDateKey(now);
  // El domingo el consultorio no atiende: se muestra la semana que empieza mañana.
  const isSunday = weekdayOf(today) === 'sun';
  const monday = isSunday ? addDays(today, 1) : startOfWeek(today);

  const clinicWide = usePermissionScope('appointments.read') === 'all';
  const scope = clinicWide ? null : session.professionalId;
  // Un ADMINISTRADOR que también atiende puede filtrar la agenda a sus citas.
  const [onlyMine, setOnlyMine] = useState(false);
  const canFilterMine = clinicWide && !!session.professionalId;

  // Una sola consulta cubre la semana (gráfico), hoy y los próximos 7 días (alertas).
  const appointments = useAppointmentsBetween(scope, isSunday ? today : monday, addDays(today, 7));
  const treatments = useActiveTreatments(scope);
  const professionals = useProfessionals(clinicWide);
  const exceptions = useExceptions(null, today, clinicWide);
  const clientsCount = useActiveClientsCount(scope);

  const seesIncome = usePermission('income.view');
  const managesCash = usePermission('payments.manage');
  const professionalNames = useMemo(
    () =>
      Object.fromEntries(
        (professionals.status === 'success' ? professionals.data : []).map((p) => [
          p.id,
          p.displayName,
        ]),
      ),
    [professionals],
  );

  const firstName = session.displayName.replace(/^Lic\.\s*/, '').split(' ')[0];

  const view = useMemo(() => {
    if (appointments.status !== 'success') return null;
    const all = appointments.data;
    const todays = appointmentsOn(all, today);
    const agendaSource =
      onlyMine && session.professionalId
        ? todays.filter((a) => a.professionalId === session.professionalId)
        : todays;
    const agendaDay = agendaSource.some(isScheduled)
      ? today
      : nextDayWithAppointments(all, addDays(today, 1));
    const agendaItems =
      agendaDay === today
        ? agendaSource
        : agendaDay
          ? appointmentsOn(all, agendaDay).filter(
              (a) => !onlyMine || a.professionalId === session.professionalId,
            )
          : [];
    return {
      counts: countByStatus(todays),
      agendaDay,
      agendaItems: agendaItems.filter(isScheduled),
      cancelledToday: todays.filter((a) => a.status === 'CANCELADA').length,
      week: weekSummary(all, monday),
      alerts: buildAlerts({
        appointments: all,
        treatments: treatments.status === 'success' ? treatments.data : [],
        today,
        now,
        formatDay: (d) => (d === addDays(today, 1) ? 'para mañana' : `para el ${formatDayLong(d)}`),
      }),
    };
  }, [appointments, treatments, today, monday, now, onlyMine, session.professionalId]);

  const team =
    professionals.status === 'success'
      ? availableToday(
          professionals.data,
          today,
          exceptions.status === 'success' ? exceptions.data : [],
        )
      : null;

  return (
    <>
      <PageHeader
        title={`${greetingFor(now)}, ${firstName}`}
        description={capitalizeFirst(formatDayLong(today))}
        actions={
          // En escritorio "Nueva cita" ya está en la barra superior.
          clinicWide && (
            <Button asChild className="md:hidden">
              <Link to="/agenda/nueva">
                <CalendarPlus aria-hidden="true" />
                Nueva cita
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-6">
        {/* Resumen del día + indicadores clave, en una sola franja. */}
        <Panel as="section" className="overflow-hidden" flush>
          <h2 className="sr-only">Resumen de hoy</h2>
          <div className="flex flex-col gap-5 p-4 md:p-5">
            {appointments.status === 'loading' && (
              <LoadingRegion label="Cargando el resumen del día" className="flex flex-col gap-3">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </LoadingRegion>
            )}
            {appointments.status === 'error' && (
              <ErrorState
                size="compact"
                description={appointments.error.message}
                onRetry={appointments.retry}
              />
            )}
            {view && (
              <DaySummary
                counts={view.counts}
                label={clinicWide ? 'citas hoy en el consultorio' : 'citas tuyas hoy'}
                emptyHint={
                  clinicWide && team?.available === 0
                    ? 'Hoy ningún profesional atiende.'
                    : 'No hay citas programadas para hoy.'
                }
              />
            )}

            <div className="grid grid-cols-2 gap-5 border-t border-border pt-5 sm:grid-cols-3 sm:gap-8">
              <Stat
                label={clinicWide ? 'Clientes activos' : 'Tus pacientes'}
                value={clientsCount.data ?? '—'}
                icon={<Users />}
              />
              <Stat
                label={clinicWide ? 'Tratamientos activos' : 'Tus tratamientos'}
                value={treatments.status === 'success' ? treatments.data.length : '—'}
                icon={<HeartPulse />}
              />
              {clinicWide && (
                <Stat
                  label="Profesionales hoy"
                  value={team ? `${team.available}/${team.total}` : '—'}
                  icon={<Stethoscope />}
                />
              )}
            </div>
          </div>
        </Panel>

        {seesIncome ? (
          <AdminIncomePanel today={today} professionalNames={professionalNames} />
        ) : managesCash ? (
          <FrontDeskIncomePanel today={today} />
        ) : (
          session.professionalId && (
            <ProfessionalIncomePanel today={today} professionalId={session.professionalId} />
          )
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Panel
            flush
            title={
              !view || view.agendaDay === today
                ? clinicWide
                  ? 'Agenda de hoy'
                  : 'Tus citas de hoy'
                : `Próximas citas · ${view.agendaDay ? formatDayLong(view.agendaDay) : ''}`
            }
            description={
              view && view.agendaDay && view.agendaDay !== today
                ? 'No hay citas programadas para hoy.'
                : view && view.cancelledToday > 0
                  ? `${view.cancelledToday} ${view.cancelledToday === 1 ? 'cancelada' : 'canceladas'} no se muestran.`
                  : undefined
            }
            actions={
              <div className="flex items-center gap-2">
                {canFilterMine && (
                  <SegmentedControl
                    label="Mostrar citas"
                    value={onlyMine ? 'mias' : 'todas'}
                    onChange={(v) => setOnlyMine(v === 'mias')}
                    options={[
                      { value: 'todas', label: 'Todas' },
                      { value: 'mias', label: 'Mías' },
                    ]}
                  />
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link to={view?.agendaDay ? `/agenda?fecha=${view.agendaDay}` : '/agenda'}>
                    <CalendarDays aria-hidden="true" />
                    Ver agenda
                  </Link>
                </Button>
              </div>
            }
          >
            {appointments.status === 'loading' && (
              <ListSkeleton rows={4} label="Cargando la agenda…" />
            )}
            {appointments.status === 'error' && (
              <ErrorState
                size="compact"
                description={appointments.error.message}
                onRetry={appointments.retry}
              />
            )}
            {view &&
              (view.agendaItems.length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={<CalendarX2 />}
                  title="Sin citas próximas"
                  description="No hay citas programadas para los próximos días."
                  action={
                    clinicWide && (
                      <Button asChild>
                        <Link to="/agenda/nueva">Agendar una cita</Link>
                      </Button>
                    )
                  }
                />
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {view.agendaItems.slice(0, AGENDA_LIMIT).map((a) => (
                      <li key={a.id}>
                        <AppointmentRow
                          appointment={a}
                          now={now}
                          hideProfessional={!clinicWide || onlyMine}
                        />
                      </li>
                    ))}
                  </ul>
                  {view.agendaItems.length > AGENDA_LIMIT && (
                    <p className="border-t border-border px-4 py-3 text-body-sm text-fg-muted md:px-5">
                      Y {view.agendaItems.length - AGENDA_LIMIT} más.{' '}
                      <Link
                        to={`/agenda?fecha=${view.agendaDay}`}
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        Ver la agenda completa
                      </Link>
                    </p>
                  )}
                </>
              ))}
          </Panel>

          <Panel flush title="Alertas" description="Lo que requiere atención.">
            {appointments.status === 'loading' ? (
              <ListSkeleton rows={2} label="Cargando alertas…" />
            ) : appointments.status === 'error' ? (
              <ErrorState
                size="compact"
                description={appointments.error.message}
                onRetry={appointments.retry}
              />
            ) : (
              view && <AlertsList alerts={view.alerts} />
            )}
          </Panel>
        </div>

        <Panel
          title={
            isSunday
              ? `${clinicWide ? 'Citas de la semana' : 'Tu semana'} que empieza mañana`
              : clinicWide
                ? 'Citas de esta semana'
                : 'Tu semana'
          }
          description="Citas programadas por día, sin contar canceladas. Selecciona un día para verlo en la agenda."
        >
          {appointments.status === 'loading' && (
            <LoadingRegion label="Cargando la semana" className="flex h-44 items-end gap-4">
              {[40, 70, 55, 85, 60, 30].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
              ))}
            </LoadingRegion>
          )}
          {appointments.status === 'error' && (
            <ErrorState
              size="compact"
              description={appointments.error.message}
              onRetry={appointments.retry}
            />
          )}
          {view && <WeekChart days={view.week} today={today} />}
        </Panel>
      </div>
    </>
  );
}
