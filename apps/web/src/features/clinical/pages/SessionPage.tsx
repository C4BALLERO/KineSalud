import {
  canAccessRecord,
  canEditNote,
  canRecordSession,
  sessionNoteInputSchema,
  type SessionNoteView,
} from '@kinesalud/shared';
import { CalendarClock, Lock } from 'lucide-react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { AppointmentStatusBadge } from '@/components/domain/StatusBadge';
import { EmptyState, ErrorState, NoPermissionState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Textarea } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useAppointment, type AgendaAppointment } from '@/features/appointments/api/appointments';
import { useRequiredSession } from '@/features/auth/session';
import { useTreatment } from '@/features/treatments/api/treatments';
import { useNow } from '@/hooks/useNow';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { toAppError } from '@/lib/errors';
import { capitalizeFirst, formatDayLong, formatTime } from '@/utils/format';
import { useRecordSession, useSessionNote, useUpdateSession } from '../api/clinical';
import { ClinicalAccessNote } from '../components/ClinicalRecordPanel';
import { PainScaleInput } from '../components/PainScaleInput';
import { SessionNoteCard } from '../components/SessionNoteCard';

/**
 * Registrar (o editar) la sesión de una cita: observaciones, evolución,
 * recomendaciones y dolor antes y después. Si la cita no estaba marcada como
 * atendida, guardar la marca en la misma operación.
 */
export function SessionPage() {
  const { appointmentId } = useParams();
  const session = useRequiredSession();
  const appointment = useAppointment(appointmentId ?? null);
  const canWrite =
    appointment.status === 'success' &&
    canAccessRecord(session, 'clinical.write', [appointment.data.professionalId]);
  const note = useSessionNote(appointmentId, canWrite);

  if (appointment.status === 'loading' || (canWrite && note.isPending)) {
    return (
      <LoadingRegion label="Cargando la sesión" className="flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </LoadingRegion>
    );
  }
  if (appointment.status === 'error') {
    return <ErrorState description={appointment.error.message} onRetry={appointment.retry} />;
  }
  if (appointment.status === 'not-found') {
    return (
      <EmptyState
        icon={<CalendarClock />}
        title="Cita no encontrada"
        description="Puede que el enlace sea incorrecto o que no tengas acceso a esta cita."
      />
    );
  }
  if (!canWrite) {
    return (
      <NoPermissionState
        title="Información clínica restringida"
        description="La sesión la registra el profesional que atendió la cita o la administración."
      />
    );
  }
  if (note.isError) {
    return (
      <ErrorState
        description={toAppError(note.error).message}
        onRetry={() => void note.refetch()}
      />
    );
  }
  return (
    <SessionForm
      appointment={appointment.data}
      existing={note.data?.note ?? null}
      alerts={note.data?.alerts ?? null}
    />
  );
}

function SessionForm({
  appointment: a,
  existing,
  alerts,
}: {
  appointment: AgendaAppointment;
  existing: SessionNoteView | null;
  alerts: string | null;
}) {
  const session = useRequiredSession();
  const now = useNow();
  const navigate = useNavigate();
  const toast = useToast();
  const record = useRecordSession();
  const update = useUpdateSession();
  const treatment = useTreatment(a.treatmentId ?? undefined);

  const [values, setValues] = useState({
    observations: existing?.observations ?? '',
    evolution: existing?.evolution ?? '',
    recommendations: existing?.recommendations ?? '',
    painBefore: existing?.painBefore ?? null,
    painAfter: existing?.painAfter ?? null,
  });
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const pendingSave = record.isPending || update.isPending;
  const blocker = useUnsavedChanges(dirty && !pendingSave);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  };

  const editCheck = existing
    ? canEditNote(
        {
          createdAt: existing.createdAt ? new Date(existing.createdAt) : null,
          createdBy: existing.createdBy,
        },
        { uid: session.uid, isAdmin: session.role === 'ADMINISTRADOR' },
        now,
      )
    : null;
  const recordCheck = existing ? null : canRecordSession(a, now);
  const blocked = (editCheck && !editCheck.ok) || (recordCheck && !recordCheck.ok);

  const parsed = sessionNoteInputSchema.safeParse({ appointmentId: a.id, ...values });
  const observationsError =
    showErrors && !parsed.success
      ? parsed.error.issues.find((i) => i.path[0] === 'observations')?.message
      : undefined;
  const back = a.treatmentId
    ? `/tratamientos/${a.treatmentId}`
    : `/agenda?fecha=${a.date}&cita=${a.id}`;

  const submit = async () => {
    setShowErrors(true);
    setServerError(null);
    if (!parsed.success) return;
    try {
      if (existing) {
        await update.mutateAsync(parsed.data);
        toast.success('Nota actualizada');
      } else {
        const result = await record.mutateAsync(parsed.data);
        const progress =
          result.completedSessions !== null && result.plannedSessions !== null
            ? `Sesión ${result.completedSessions} de ${result.plannedSessions}.`
            : undefined;
        toast.success(
          result.markedAttended ? 'Sesión registrada y cita atendida' : 'Sesión registrada',
          result.completedSessions !== null &&
            result.plannedSessions !== null &&
            result.completedSessions >= result.plannedSessions
            ? `${progress} Se completaron las sesiones previstas: puedes finalizar el tratamiento.`
            : progress,
        );
      }
      // Se desbloquea la salida antes de navegar (la guarda lee el estado ya actualizado).
      flushSync(() => setDirty(false));
      navigate(back);
    } catch (err) {
      setServerError(toAppError(err).message);
    }
  };

  const pending = pendingSave;
  const planned = treatment.status === 'success' ? treatment.data.plannedSessions : null;

  return (
    <>
      <PageHeader
        back={{ to: back, label: a.treatmentId ? 'Tratamiento' : 'Agenda' }}
        title={existing ? 'Sesión registrada' : 'Registrar sesión'}
        description={`${a.clientName} · ${a.serviceName}`}
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <ClinicalAccessNote />
        <Panel>
          <div className="flex flex-col gap-2 text-body-sm">
            <p className="flex flex-wrap items-center gap-2">
              <AppointmentStatusBadge status={a.status} />
              <CategoryTag category={a.category} />
              {a.sessionNumber && (
                <span className="font-medium text-fg">
                  Sesión {a.sessionNumber}
                  {planned ? ` de ${planned}` : ''}
                </span>
              )}
            </p>
            <p className="text-fg-muted">
              {capitalizeFirst(formatDayLong(a.date))} · {formatTime(a.startAt)} –{' '}
              {formatTime(a.endAt)} · {a.professionalName}
            </p>
            <Link
              to={`/clientes/${a.clientId}?tab=clinica`}
              className="w-fit font-medium text-primary underline-offset-2 hover:underline"
            >
              Ver historia clínica de {a.clientName}
            </Link>
          </div>
        </Panel>

        {alerts && (
          <InlineAlert tone="warning" title="Alertas clínicas">
            <span className="whitespace-pre-line">{alerts}</span>
          </InlineAlert>
        )}
        {serverError && <InlineAlert tone="danger">{serverError}</InlineAlert>}
        {recordCheck && !recordCheck.ok && (
          <InlineAlert tone="warning">{recordCheck.reason}</InlineAlert>
        )}
        {!existing && recordCheck?.ok && a.status !== 'ATENDIDA' && (
          <InlineAlert tone="info">Al guardar, la cita se marcará como atendida.</InlineAlert>
        )}

        {existing && editCheck && !editCheck.ok ? (
          <Panel flush>
            <SessionNoteCard note={existing} />
            <p className="flex items-center gap-1.5 border-t border-border px-4 py-3 text-caption text-fg-muted md:px-5">
              <Lock aria-hidden="true" className="size-3.5" />
              {editCheck.reason}
            </p>
          </Panel>
        ) : (
          !blocked && (
            <form
              noValidate
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Panel title="Sesión">
                <div className="flex flex-col gap-5">
                  <PainScaleInput
                    label="Dolor al llegar (EVA)"
                    value={values.painBefore}
                    onChange={(v) => set('painBefore', v)}
                  />
                  <FormField
                    label="Observaciones"
                    required
                    error={observationsError}
                    hint="Qué se realizó: técnicas, ejercicios, zonas tratadas, tolerancia."
                  >
                    {(p) => (
                      <Textarea
                        {...p}
                        rows={5}
                        maxLength={3000}
                        value={values.observations}
                        onChange={(e) => set('observations', e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Evolución"
                    optional
                    hint="Cambios respecto de la sesión anterior."
                  >
                    {(p) => (
                      <Textarea
                        {...p}
                        rows={3}
                        maxLength={2000}
                        value={values.evolution}
                        onChange={(e) => set('evolution', e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Recomendaciones"
                    optional
                    hint="Indicaciones para la casa, ejercicios, próxima sesión."
                  >
                    {(p) => (
                      <Textarea
                        {...p}
                        rows={3}
                        maxLength={2000}
                        value={values.recommendations}
                        onChange={(e) => set('recommendations', e.target.value)}
                      />
                    )}
                  </FormField>
                  <PainScaleInput
                    label="Dolor al terminar (EVA)"
                    value={values.painAfter}
                    onChange={(v) => set('painAfter', v)}
                  />
                </div>
              </Panel>
              <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(back)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={pending}>
                  {existing ? 'Guardar cambios' : 'Registrar sesión'}
                </Button>
              </div>
            </form>
          )
        )}
      </div>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="¿Salir sin guardar?"
        description="La nota de la sesión tiene cambios sin guardar. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
