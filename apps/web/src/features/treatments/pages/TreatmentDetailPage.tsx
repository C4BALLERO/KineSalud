import {
  canAccessRecord,
  permissionScope,
  remainingSessions,
  toDateKey,
  TREATMENT_ACTION_LABELS,
  type TreatmentAction,
} from '@kinesalud/shared';
import {
  CalendarPlus,
  CircleCheckBig,
  CirclePause,
  CirclePlay,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { TreatmentStatusBadge } from '@/components/domain/StatusBadge';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Panel } from '@/components/ui/Panel';
import { SessionProgress } from '@/components/ui/Progress';
import { ListSkeleton, LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/StatCard';
import { useRequiredSession } from '@/features/auth/session';
import { capitalizeFirst, formatDateLong, formatDayLong, formatTime } from '@/utils/format';
import { useTreatment, useTreatmentAppointments, type TreatmentItem } from '../api/treatments';
import { EditTreatmentDialog, TreatmentStatusDialog } from '../components/TreatmentDialogs';
import { TreatmentTimeline } from '../components/TreatmentTimeline';
import { treatmentProgress } from '../model';

const STATUS_ACTIONS: Record<TreatmentItem['status'], TreatmentAction[]> = {
  ACTIVO: ['FINALIZAR', 'SUSPENDER'],
  SUSPENDIDO: ['REACTIVAR', 'FINALIZAR'],
  FINALIZADO: ['REACTIVAR'],
};

const ACTION_ICONS = {
  FINALIZAR: CircleCheckBig,
  SUSPENDER: CirclePause,
  REACTIVAR: CirclePlay,
} as const;

/** Detalle de un tratamiento: progreso, sesiones y acciones según el estado. */
export function TreatmentDetailPage() {
  const { treatmentId } = useParams();
  const treatment = useTreatment(treatmentId);

  if (treatment.status === 'loading') {
    return (
      <LoadingRegion label="Cargando el tratamiento" className="flex flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </LoadingRegion>
    );
  }
  if (treatment.status === 'error') {
    return <ErrorState description={treatment.error.message} onRetry={treatment.retry} />;
  }
  if (treatment.status === 'not-found') {
    return (
      <EmptyState
        icon={<HeartPulse />}
        title="Tratamiento no encontrado"
        description="Puede que el enlace sea incorrecto o que no tengas acceso a este tratamiento."
        action={
          <Button asChild variant="secondary">
            <Link to="/tratamientos">Ver tratamientos</Link>
          </Button>
        }
      />
    );
  }
  return <Detail treatment={treatment.data} />;
}

type OpenDialog = { kind: 'edit' } | { kind: 'status'; action: TreatmentAction } | null;

function Detail({ treatment: t }: { treatment: TreatmentItem }) {
  const session = useRequiredSession();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const clinicWide = permissionScope(session, 'treatments.read') === 'all';
  const appointments = useTreatmentAppointments(t.id, clinicWide ? null : session.professionalId);
  const canManage = canAccessRecord(session, 'treatments.manage', [t.professionalId]);
  const canReassign = permissionScope(session, 'treatments.manage') === 'all';
  const canSchedule = permissionScope(session, 'appointments.manage') === 'all';

  const progress =
    appointments.status === 'success' ? treatmentProgress(t, appointments.data) : null;
  const scheduleHref = `/agenda/nueva?cliente=${t.clientId}&tratamiento=${t.id}`;
  const complete = t.completedSessions >= t.plannedSessions;

  return (
    <>
      <PageHeader
        back={{ to: '/tratamientos', label: 'Tratamientos' }}
        title={t.serviceName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <TreatmentStatusBadge status={t.status} />
            <CategoryTag category={t.category} />
            <span>
              {t.clientName} · {t.professionalName}
            </span>
          </span>
        }
        actions={
          <>
            {canSchedule && t.status === 'ACTIVO' && !complete && (
              <Button asChild>
                <Link to={scheduleHref}>
                  <CalendarPlus aria-hidden="true" />
                  Agendar sesión
                </Link>
              </Button>
            )}
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" aria-label="Más acciones">
                    <MoreHorizontal aria-hidden="true" />
                    <span className="sm:hidden">Más acciones</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {t.status !== 'FINALIZADO' && (
                    <DropdownMenuItem
                      icon={<Pencil aria-hidden="true" />}
                      onSelect={() => setDialog({ kind: 'edit' })}
                      disabled={!progress}
                    >
                      Editar
                    </DropdownMenuItem>
                  )}
                  {STATUS_ACTIONS[t.status].map((action) => {
                    const Icon = ACTION_ICONS[action];
                    return (
                      <DropdownMenuItem
                        key={action}
                        icon={<Icon aria-hidden="true" />}
                        destructive={action === 'SUSPENDER'}
                        disabled={!progress}
                        onSelect={() => setDialog({ kind: 'status', action })}
                      >
                        {TREATMENT_ACTION_LABELS[action]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {t.status === 'ACTIVO' && complete && (
          <InlineAlert
            tone="success"
            title={`Se completaron las ${t.plannedSessions} sesiones previstas`}
            action={
              canManage && (
                <Button
                  size="sm"
                  onClick={() => setDialog({ kind: 'status', action: 'FINALIZAR' })}
                >
                  Finalizar tratamiento
                </Button>
              )
            }
          >
            Si el paciente necesita más, edita el tratamiento y aumenta las sesiones previstas.
          </InlineAlert>
        )}
        {t.status !== 'ACTIVO' && (
          <InlineAlert
            tone={t.status === 'SUSPENDIDO' ? 'warning' : 'info'}
            title={t.status === 'SUSPENDIDO' ? 'Tratamiento suspendido' : 'Tratamiento finalizado'}
          >
            {t.statusReason ? `Motivo: ${t.statusReason}.` : ''}
            {t.statusChangedAt ? ` Desde el ${formatDayLong(toDateKey(t.statusChangedAt))}.` : ''}
            {t.status === 'SUSPENDIDO' && ' Reactívalo para agendarle sesiones.'}
          </InlineAlert>
        )}

        <Panel>
          <h2 className="sr-only">Progreso</h2>
          <div className="flex flex-col gap-5">
            <SessionProgress completed={t.completedSessions} planned={t.plannedSessions} />
            <div className="grid grid-cols-2 gap-5 border-t border-border pt-5 lg:grid-cols-4 lg:gap-8">
              <Stat
                label="Realizadas"
                value={`${t.completedSessions} de ${t.plannedSessions}`}
                hint={
                  remainingSessions(t) > 0 ? `Quedan ${remainingSessions(t)}` : 'Sesiones completas'
                }
              />
              <Stat
                label="Agendadas"
                value={progress ? progress.scheduled : '—'}
                hint={
                  progress && progress.unscheduled > 0
                    ? `${progress.unscheduled} por agendar`
                    : undefined
                }
              />
              <Stat
                label="Próxima sesión"
                value={
                  progress?.next ? (
                    <span className="text-h3">
                      {capitalizeFirst(formatDayLong(progress.next.date))}
                    </span>
                  ) : (
                    '—'
                  )
                }
                hint={progress?.next ? formatTime(progress.next.startAt) : undefined}
              />
              <Stat
                label="Última sesión"
                value={
                  progress?.last ? (
                    <span className="text-h3">
                      {capitalizeFirst(formatDayLong(progress.last.date))}
                    </span>
                  ) : (
                    '—'
                  )
                }
                hint={
                  progress && progress.noShows > 0
                    ? `${progress.noShows} ${progress.noShows === 1 ? 'inasistencia' : 'inasistencias'}`
                    : undefined
                }
              />
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Panel
            title="Sesiones"
            description={
              clinicWide
                ? 'Citas vinculadas a este tratamiento.'
                : 'Tus citas vinculadas a este tratamiento.'
            }
          >
            {appointments.status === 'loading' && (
              <ListSkeleton rows={4} label="Cargando sesiones…" />
            )}
            {appointments.status === 'error' && (
              <ErrorState
                size="compact"
                description={appointments.error.message}
                onRetry={appointments.retry}
              />
            )}
            {progress &&
              (progress.timeline.length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={<CalendarPlus />}
                  title="Sin sesiones agendadas"
                  description="Agenda la primera sesión para empezar el tratamiento."
                  action={
                    canSchedule &&
                    t.status === 'ACTIVO' && (
                      <Button asChild>
                        <Link to={scheduleHref}>Agendar sesión</Link>
                      </Button>
                    )
                  }
                />
              ) : (
                <TreatmentTimeline
                  items={progress.timeline}
                  scheduleHref={canSchedule && t.status === 'ACTIVO' ? scheduleHref : undefined}
                />
              ))}
          </Panel>

          <Panel title="Datos del tratamiento">
            <KeyValueList
              columns={1}
              items={[
                {
                  label: 'Cliente',
                  value: (
                    <Link
                      to={`/clientes/${t.clientId}?tab=tratamientos`}
                      className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
                    >
                      <UserRound aria-hidden="true" className="size-4" />
                      {t.clientName}
                    </Link>
                  ),
                },
                { label: 'Servicio', value: t.serviceName },
                { label: 'Profesional', value: t.professionalName },
                { label: 'Inicio', value: formatDateLong(t.startDate) },
                ...(t.notes ? [{ label: 'Nota', value: t.notes }] : []),
              ]}
            />
          </Panel>
        </div>
      </div>

      {dialog?.kind === 'edit' && progress && (
        <EditTreatmentDialog
          treatment={t}
          openAppointments={progress.scheduled}
          canReassign={canReassign}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'status' && progress && (
        <TreatmentStatusDialog
          treatment={t}
          action={dialog.action}
          openAppointments={progress.scheduled}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
