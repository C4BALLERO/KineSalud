import { ageOn, CI_EXTENSION_LABELS, toDateKey } from '@kinesalud/shared';
import {
  CalendarPlus,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AppointmentRow } from '@/components/domain/AppointmentRow';
import { EmptyState, ErrorState, NoPermissionState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
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
import { useNow } from '@/hooks/useNow';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import { formatCi, formatDateTime, formatDayLong, formatPhone } from '@/utils/format';
import {
  useClient,
  useClientAppointments,
  useClientTreatments,
  useSetClientStatus,
  type ClientDetail,
} from '../api/clients';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { AppointmentHistory, TreatmentList } from '../components/ClientHistory';

const TABS = ['resumen', 'datos', 'citas', 'tratamientos', 'clinica'] as const;
type Tab = (typeof TABS)[number];

export function ClientProfilePage() {
  const { clientId } = useParams();
  const session = useRequiredSession();
  const now = useNow();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'resumen';

  const canWrite = usePermission('clients.write');
  const canReadClinical = usePermission('clinical.read');
  // El profesional solo ve sus propias citas y tratamientos con el paciente.
  const scope = usePermissionScope('appointments.read') === 'all' ? null : session.professionalId;

  const client = useClient(clientId);
  const appointments = useClientAppointments(clientId, scope);
  const treatments = useClientTreatments(clientId, scope);
  const setStatus = useSetClientStatus();
  const [confirmStatus, setConfirmStatus] = useState(false);

  if (client.status === 'loading') {
    return (
      <LoadingRegion label="Cargando perfil del cliente" className="flex flex-col gap-6">
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
  if (client.status === 'error') {
    return <ErrorState description={client.error.message} onRetry={client.retry} />;
  }
  if (client.status === 'not-found') {
    return (
      <EmptyState
        icon={<UserX />}
        title="Cliente no encontrado"
        description="El enlace no corresponde a ningún cliente registrado o no tienes acceso a él."
        action={
          <Button asChild>
            <Link to="/clientes">Ir a clientes</Link>
          </Button>
        }
      />
    );
  }

  const c = client.data;
  const today = toDateKey(now);
  const active = c.status === 'ACTIVO';
  const meta = [
    `CI ${formatCi(c.ci, c.ciExt)}`,
    c.birthDate ? `${ageOn(c.birthDate, today)} años` : null,
    formatPhone(c.phone),
  ].filter(Boolean);

  const allAppointments = appointments.status === 'success' ? appointments.data : [];
  const upcoming = allAppointments
    .filter((a) => a.endAt > now && (a.status === 'PENDIENTE' || a.status === 'CONFIRMADA'))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = allAppointments.filter((a) => a.endAt <= now);
  const attended = past.filter((a) => a.status === 'ATENDIDA').length;
  const noShows = past.filter((a) => a.status === 'NO_ASISTIO').length;
  const activeTreatments =
    treatments.status === 'success' ? treatments.data.filter((t) => t.status === 'ACTIVO') : [];

  const changeTab = (next: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'resumen') p.delete('tab');
        else p.set('tab', next);
        return p;
      },
      { replace: true },
    );

  const toggleStatus = async () => {
    try {
      await setStatus.mutateAsync({ clientId: c.id, status: active ? 'INACTIVO' : 'ACTIVO' });
      toast.success(active ? 'Cliente desactivado' : 'Cliente reactivado');
    } catch (err) {
      toast.error('No se pudo cambiar el estado', toAppError(err).message);
    } finally {
      setConfirmStatus(false);
    }
  };

  const scheduleButton = canWrite && active && (
    <Button asChild>
      <Link to={`/agenda/nueva?cliente=${c.id}`}>
        <CalendarPlus aria-hidden="true" />
        Agendar cita
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        back={{ to: '/clientes', label: scope ? 'Mis pacientes' : 'Clientes' }}
        leading={<Avatar name={c.fullName} size="lg" />}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {c.fullName}
            <ClientStatusBadge status={c.status} />
          </span>
        }
        description={<span className="tabular">{meta.join(' · ')}</span>}
        actions={
          canWrite && (
            <>
              {scheduleButton}
              <Button asChild variant="secondary">
                <Link to={`/clientes/${c.id}/editar`}>
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
                  {active ? (
                    <DropdownMenuItem
                      destructive
                      icon={<UserX aria-hidden="true" />}
                      onSelect={() => setConfirmStatus(true)}
                    >
                      Desactivar cliente
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      icon={<UserCheck aria-hidden="true" />}
                      onSelect={() => setConfirmStatus(true)}
                    >
                      Reactivar cliente
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )
        }
      />

      {!active && (
        <InlineAlert tone="warning" title="Cliente inactivo" className="mb-6">
          No aparece al agendar citas. Su historial se conserva.
        </InlineAlert>
      )}
      {scope && (
        <InlineAlert tone="info" className="mb-6">
          Se muestran solo las citas y tratamientos que tú atiendes con este paciente.
        </InlineAlert>
      )}

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList label="Secciones del perfil del cliente">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="datos">Datos personales</TabsTrigger>
          <TabsTrigger
            value="citas"
            count={appointments.status === 'success' ? allAppointments.length : undefined}
          >
            Citas
          </TabsTrigger>
          <TabsTrigger
            value="tratamientos"
            count={treatments.status === 'success' ? treatments.data.length : undefined}
          >
            Tratamientos
          </TabsTrigger>
          <TabsTrigger value="clinica">Historia clínica</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="flex flex-col gap-6">
              <Panel flush title="Próxima cita">
                {appointments.status === 'loading' ? (
                  <ListSkeleton rows={1} label="Cargando próxima cita…" />
                ) : appointments.status === 'error' ? (
                  <ErrorState
                    size="compact"
                    description={appointments.error.message}
                    onRetry={appointments.retry}
                  />
                ) : upcoming[0] ? (
                  <div>
                    <p className="px-4 pt-3 text-caption font-semibold text-fg-muted md:px-5">
                      {formatDayLong(upcoming[0].date)}
                    </p>
                    <AppointmentRow appointment={upcoming[0]} now={now} />
                    {upcoming.length > 1 && (
                      <p className="border-t border-border px-4 py-2.5 text-caption text-fg-muted md:px-5">
                        {upcoming.length - 1} cita{upcoming.length > 2 ? 's' : ''} más programada
                        {upcoming.length > 2 ? 's' : ''}.
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    size="compact"
                    icon={<CalendarPlus />}
                    title="Sin citas próximas"
                    description={
                      active
                        ? 'Agenda la siguiente sesión del cliente.'
                        : 'El cliente está inactivo.'
                    }
                    action={scheduleButton}
                  />
                )}
              </Panel>

              <Panel
                flush
                title="Últimas citas"
                actions={
                  past.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => changeTab('citas')}>
                      Ver todas
                    </Button>
                  )
                }
              >
                {appointments.status === 'loading' ? (
                  <ListSkeleton rows={3} label="Cargando citas…" />
                ) : (
                  <AppointmentHistory appointments={past.slice(0, 5)} now={now} />
                )}
              </Panel>
            </div>

            <div className="flex flex-col gap-6">
              <Panel title="Historial">
                <dl className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'Atendidas', value: attended },
                    { label: 'Inasistencias', value: noShows },
                    { label: 'Tratamientos activos', value: activeTreatments.length },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col-reverse gap-0.5">
                      <dt className="text-caption text-fg-muted">{s.label}</dt>
                      <dd className="tabular text-h1 text-fg">
                        {appointments.status === 'success' ? s.value : '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
                {noShows >= 2 && (
                  <InlineAlert
                    tone="warning"
                    className="mt-4"
                    title={`${noShows} inasistencias registradas`}
                  >
                    Considera confirmar sus próximas citas con anticipación.
                  </InlineAlert>
                )}
              </Panel>

              <Panel flush title="Tratamientos activos">
                {treatments.status === 'loading' ? (
                  <ListSkeleton rows={2} label="Cargando tratamientos…" />
                ) : treatments.status === 'error' ? (
                  <ErrorState
                    size="compact"
                    description={treatments.error.message}
                    onRetry={treatments.retry}
                  />
                ) : (
                  <TreatmentList treatments={activeTreatments} />
                )}
              </Panel>

              {canWrite && (
                <Panel title="Notas administrativas">
                  {c.adminNotes ? (
                    <p className="text-body-sm whitespace-pre-line text-fg">{c.adminNotes}</p>
                  ) : (
                    <p className="text-body-sm text-fg-subtle">Sin notas.</p>
                  )}
                </Panel>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="datos">
          <Panel title="Datos personales y de contacto" className="max-w-3xl">
            <PersonalData client={c} />
          </Panel>
        </TabsContent>

        <TabsContent value="citas">
          <Panel flush>
            {appointments.status === 'loading' ? (
              <ListSkeleton rows={5} label="Cargando citas…" />
            ) : appointments.status === 'error' ? (
              <ErrorState description={appointments.error.message} onRetry={appointments.retry} />
            ) : (
              <AppointmentHistory
                appointments={allAppointments}
                now={now}
                emptyAction={scheduleButton}
              />
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="tratamientos">
          <Panel flush>
            {treatments.status === 'loading' ? (
              <ListSkeleton rows={3} label="Cargando tratamientos…" />
            ) : treatments.status === 'error' ? (
              <ErrorState description={treatments.error.message} onRetry={treatments.retry} />
            ) : (
              <TreatmentList treatments={treatments.data} />
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="clinica">
          <Panel>
            {canReadClinical ? (
              <EmptyState
                icon={<ClipboardList />}
                title="Historia clínica"
                description="La evolución, las observaciones y las recomendaciones de cada sesión se registran con el módulo de Seguimiento (Fase 12). Solo las ve el profesional asignado y la administración."
              />
            ) : (
              <NoPermissionState
                title="Información clínica restringida"
                description="La historia clínica solo es visible para el profesional que atiende al cliente y para la administración."
              />
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmStatus}
        onOpenChange={setConfirmStatus}
        destructive={active}
        loading={setStatus.isPending}
        title={active ? '¿Desactivar este cliente?' : '¿Reactivar este cliente?'}
        description={
          active
            ? `${c.fullName} dejará de aparecer al agendar citas. Su historial de citas y tratamientos se conserva y puedes reactivarlo en cualquier momento.`
            : `${c.fullName} volverá a aparecer al agendar citas.`
        }
        confirmLabel={active ? 'Desactivar cliente' : 'Reactivar cliente'}
        onConfirm={() => void toggleStatus()}
      />
    </>
  );
}

function PersonalData({ client: c }: { client: ClientDetail }) {
  return (
    <KeyValueList
      items={[
        { label: 'Nombres', value: c.firstName },
        { label: 'Apellidos', value: c.lastName },
        { label: 'Carnet de identidad', value: <span className="tabular">{c.ci}</span> },
        { label: 'Expedido en', value: c.ciExt ? CI_EXTENSION_LABELS[c.ciExt] : null },
        {
          label: 'Fecha de nacimiento',
          value: c.birthDate ? formatDayLong(c.birthDate).replace(/^\S+ /, '') : null,
        },
        { label: 'Teléfono', value: <span className="tabular">{formatPhone(c.phone)}</span> },
        { label: 'Correo electrónico', value: c.email },
        { label: 'Dirección', value: c.address },
        { label: 'Registrado', value: c.createdAt ? formatDateTime(c.createdAt) : null },
        { label: 'Última actualización', value: c.updatedAt ? formatDateTime(c.updatedAt) : null },
      ]}
    />
  );
}
