import { addDays, TREATMENT_CATEGORIES, toDateKey, weeklyMinutes } from '@kinesalud/shared';
import { MoreHorizontal, Pencil, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AppointmentDayList } from '@/components/domain/AppointmentDayList';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { EmptyState, ErrorState, NoPermissionState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton, LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/toast-context';
import { useRequiredSession } from '@/features/auth/session';
import { useAppointmentsBetween } from '@/features/dashboard/api/dashboard';
import { useClinicSettings, useServices } from '@/features/settings/api/catalog';
import { useNow } from '@/hooks/useNow';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import { capitalizeFirst, formatDayShort, formatPhone } from '@/utils/format';
import {
  useExceptions,
  useProfessional,
  useSetProfessionalActive,
  type ProfessionalItem,
} from '../api/staff';
import { AccountPanel } from '../components/AccountPanel';
import { ExceptionsPanel } from '../components/ExceptionsPanel';
import { SchedulePanel } from '../components/SchedulePanel';
import { AvailabilityBadge, ProfessionalStatusBadge } from '../components/StaffBadges';
import { availabilitySummary } from '../model';

const TABS = ['resumen', 'horario', 'servicios', 'citas'] as const;
type Tab = (typeof TABS)[number];

/** Días que se muestran en "Próximos días" y en la pestaña de citas. */
const UPCOMING_DAYS = 14;

export function StaffProfilePage() {
  const { professionalId } = useParams();
  const session = useRequiredSession();
  const scope = usePermissionScope('staff.read');
  const canManage = usePermission('staff.manage');
  const canLink = usePermission('users.manage');
  const toast = useToast();
  const now = useNow();
  const today = toDateKey(now);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'resumen';

  const ownOnly = scope === 'own' && session.professionalId !== professionalId;
  const professional = useProfessional(ownOnly ? undefined : professionalId);
  const exceptions = useExceptions(professionalId ?? null, today, !ownOnly && !!professionalId);
  const clinic = useClinicSettings();
  const setActive = useSetProfessionalActive();
  const [confirmActive, setConfirmActive] = useState(false);

  if (ownOnly) {
    return (
      <NoPermissionState description="Solo puedes consultar tu propia ficha de profesional." />
    );
  }
  if (professional.status === 'loading') {
    return (
      <LoadingRegion label="Cargando ficha del profesional" className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </LoadingRegion>
    );
  }
  if (professional.status === 'error') {
    return <ErrorState description={professional.error.message} onRetry={professional.retry} />;
  }
  if (professional.status === 'not-found') {
    return (
      <EmptyState
        icon={<UserX />}
        title="Profesional no encontrado"
        description="El enlace no corresponde a ninguna ficha registrada."
        action={
          <Button asChild>
            <Link to="/personal">Ir a personal</Link>
          </Button>
        }
      />
    );
  }

  const p = professional.data;
  const isSelf = session.professionalId === p.id;
  const exceptionList = exceptions.status === 'success' ? exceptions.data : [];
  const todaySummary = availabilitySummary(p, exceptionList, today);
  const clinicHours = clinic.status === 'success' ? clinic.data.openingHours : undefined;
  const hours = weeklyMinutes(p.weeklySchedule) / 60;

  const changeTab = (next: string) =>
    setParams(
      (prev) => {
        const q = new URLSearchParams(prev);
        if (next === 'resumen') q.delete('tab');
        else q.set('tab', next);
        return q;
      },
      { replace: true },
    );

  const toggleActive = async () => {
    try {
      await setActive.mutateAsync({ professionalId: p.id, active: !p.active });
      toast.success(p.active ? 'Profesional desactivado' : 'Profesional reactivado');
    } catch (err) {
      toast.error('No se pudo cambiar el estado', toAppError(err).message);
    } finally {
      setConfirmActive(false);
    }
  };

  return (
    <>
      <PageHeader
        back={
          scope === 'all'
            ? { to: '/personal', label: 'Personal' }
            : { to: '/mi-cuenta', label: 'Mi cuenta' }
        }
        leading={<Avatar name={`${p.firstName} ${p.lastName}`} size="lg" />}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {p.displayName}
            <ProfessionalStatusBadge active={p.active} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {p.categories.map((c) => (
              <CategoryTag key={c} category={c} />
            ))}
            {p.specialties.length > 0 && (
              <span className="text-body-sm">{p.specialties.join(', ')}</span>
            )}
          </span>
        }
        actions={
          canManage && (
            <>
              <Button asChild variant="secondary">
                <Link to={`/personal/${p.id}/editar`}>
                  <Pencil aria-hidden="true" />
                  Editar
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    aria-label="Más acciones"
                    className="w-11 px-0 md:w-10"
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    destructive={p.active}
                    icon={
                      p.active ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />
                    }
                    onSelect={() => setConfirmActive(true)}
                  >
                    {p.active ? 'Desactivar profesional' : 'Reactivar profesional'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )
        }
      />

      {!p.active && (
        <InlineAlert tone="warning" title="Profesional inactivo" className="mb-6">
          No se le pueden agendar citas nuevas. Su historial se conserva.
        </InlineAlert>
      )}
      {p.active && hours === 0 && (
        <InlineAlert
          tone="warning"
          title="Sin horario de atención"
          className="mb-6"
          action={
            canManage &&
            tab !== 'horario' && (
              <Button variant="secondary" size="sm" onClick={() => changeTab('horario')}>
                Definir horario
              </Button>
            )
          }
        >
          Mientras no tenga horario, no aparecerá disponible en la agenda.
        </InlineAlert>
      )}

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList label="Secciones de la ficha del profesional">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="horario">Horario y ausencias</TabsTrigger>
          <TabsTrigger value="servicios" count={p.serviceIds.length}>
            Servicios
          </TabsTrigger>
          <TabsTrigger value="citas">Próximas citas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="flex flex-col gap-6">
              <Panel title="Hoy">
                <div className="flex flex-wrap items-center gap-3">
                  <AvailabilityBadge summary={todaySummary} />
                  {todaySummary.detail && (
                    <span className="tabular text-body-sm text-fg-muted">
                      {todaySummary.detail}
                    </span>
                  )}
                </div>
              </Panel>
              <UpcomingDays professional={p} exceptions={exceptionList} today={today} />
            </div>
            <div className="flex flex-col gap-6">
              <Panel title="Datos">
                <KeyValueList
                  columns={1}
                  items={[
                    { label: 'Nombre completo', value: `${p.firstName} ${p.lastName}` },
                    {
                      label: 'Celular',
                      value: p.phone ? (
                        <span className="tabular">{formatPhone(p.phone)}</span>
                      ) : null,
                    },
                    {
                      label: 'Horas de atención por semana',
                      value:
                        hours > 0 ? (
                          <span className="tabular">
                            {Number.isInteger(hours) ? hours : hours.toFixed(1)} h
                          </span>
                        ) : null,
                    },
                  ]}
                />
              </Panel>
              {canLink ? (
                <AccountPanel
                  professionalId={p.id}
                  professionalName={p.displayName}
                  userId={p.userId}
                />
              ) : (
                isSelf && (
                  <InlineAlert tone="info">
                    Esta es tu ficha. Si algún dato no es correcto, pide a la administración que lo
                    actualice.
                  </InlineAlert>
                )
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="horario">
          <div className="flex flex-col gap-6">
            <SchedulePanel
              professionalId={p.id}
              schedule={p.weeklySchedule}
              clinicHours={clinicHours}
              stepMinutes={clinic.status === 'success' ? clinic.data.slotMinutes : 15}
              canEdit={canManage}
            />
            <ExceptionsPanel
              professionalId={p.id}
              professionalName={p.displayName}
              today={today}
              canEdit={canManage}
            />
          </div>
        </TabsContent>

        <TabsContent value="servicios">
          <ServicesPanel professional={p} canManage={canManage} />
        </TabsContent>

        <TabsContent value="citas">
          <UpcomingAppointments professionalId={p.id} today={today} now={now} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmActive}
        onOpenChange={setConfirmActive}
        destructive={p.active}
        loading={setActive.isPending}
        title={p.active ? '¿Desactivar este profesional?' : '¿Reactivar este profesional?'}
        description={
          p.active
            ? `${p.displayName} dejará de aparecer al agendar citas. Revisa en "Próximas citas" si tiene citas pendientes para reprogramarlas. Su historial se conserva.`
            : `${p.displayName} volverá a aparecer al agendar citas, según su horario.`
        }
        confirmLabel={p.active ? 'Desactivar profesional' : 'Reactivar profesional'}
        onConfirm={() => void toggleActive()}
      />
    </>
  );
}

function UpcomingDays({
  professional,
  exceptions,
  today,
}: {
  professional: ProfessionalItem;
  exceptions: Parameters<typeof availabilitySummary>[1];
  today: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <Panel flush title="Próximos 7 días">
      <ul className="divide-y divide-border">
        {days.map((day, i) => {
          const s = availabilitySummary(professional, exceptions, day, false);
          return (
            <li
              key={day}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 md:px-5"
            >
              <span className="w-24 text-body-sm font-medium text-fg">
                {i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : capitalizeFirst(formatDayShort(day))}
              </span>
              <AvailabilityBadge summary={s} />
              {s.detail && <span className="tabular text-body-sm text-fg-muted">{s.detail}</span>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ServicesPanel({
  professional,
  canManage,
}: {
  professional: ProfessionalItem;
  canManage: boolean;
}) {
  const services = useServices();
  const edit = canManage && (
    <Button asChild variant="secondary" size="sm">
      <Link to={`/personal/${professional.id}/editar`}>
        <Pencil aria-hidden="true" />
        Cambiar servicios
      </Link>
    </Button>
  );

  return (
    <Panel
      title="Servicios que realiza"
      description="Solo se le pueden agendar estos servicios."
      actions={edit}
    >
      {services.status === 'loading' ? (
        <ListSkeleton rows={3} label="Cargando servicios…" />
      ) : services.status === 'error' ? (
        <ErrorState size="compact" description={services.error.message} onRetry={services.retry} />
      ) : professional.serviceIds.length === 0 ? (
        <p className="text-body-sm text-fg-muted">
          Aún no tiene servicios asignados, por eso no se le pueden agendar citas.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TREATMENT_CATEGORIES.filter((c) => professional.categories.includes(c)).map((c) => {
            const list = services.data.filter(
              (s) => s.category === c && professional.serviceIds.includes(s.id),
            );
            return (
              <section key={c} className="flex flex-col gap-2">
                <h3>
                  <CategoryTag category={c} />
                </h3>
                {list.length === 0 ? (
                  <p className="text-caption text-fg-subtle">Ningún servicio de esta área.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {list.map((s) => (
                      <li key={s.id} className="flex flex-col">
                        <span className="text-body-sm text-fg">{s.name}</span>
                        <span className="flex items-center gap-2 text-caption text-fg-subtle">
                          {s.durationMin} min
                          {!s.active && <Badge>Desactivado</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function UpcomingAppointments({
  professionalId,
  today,
  now,
}: {
  professionalId: string;
  today: string;
  now: Date;
}) {
  const appointments = useAppointmentsBetween(
    professionalId,
    today,
    addDays(today, UPCOMING_DAYS - 1),
  );
  return (
    <Panel
      flush
      title={`Próximos ${UPCOMING_DAYS} días`}
      description="Citas agendadas en todos sus estados."
    >
      {appointments.status === 'loading' ? (
        <ListSkeleton rows={5} label="Cargando citas…" />
      ) : appointments.status === 'error' ? (
        <ErrorState description={appointments.error.message} onRetry={appointments.retry} />
      ) : (
        <AppointmentDayList
          appointments={[...appointments.data].sort(
            (a, b) => a.startAt.getTime() - b.startAt.getTime(),
          )}
          now={now}
          hideProfessional
          empty={{
            title: 'Sin citas próximas',
            description: `No tiene citas en los próximos ${UPCOMING_DAYS} días.`,
          }}
        />
      )}
    </Panel>
  );
}
