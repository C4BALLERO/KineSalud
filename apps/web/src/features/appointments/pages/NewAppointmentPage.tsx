import {
  addDays,
  findSlots,
  TIME_PATTERN,
  toDateKey,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type Slot,
  type SlotAlternative,
} from '@kinesalud/shared';
import { Check, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { ErrorState, NoPermissionState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Panel } from '@/components/ui/Panel';
import { RadioCardGroup } from '@/components/ui/RadioCardGroup';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useClient, type ClientListItem } from '@/features/clients/api/clients';
import { useNow } from '@/hooks/useNow';
import { usePermissionScope } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import { cn } from '@/utils/cn';
import { capitalizeFirst, formatDayLong, formatDayShort } from '@/utils/format';
import {
  useAgendaAppointments,
  useClientActiveTreatments,
  useCreateAppointment,
} from '../api/appointments';
import { ClientPicker } from '../components/ClientPicker';
import { SlotPicker } from '../components/SlotPicker';
import { useAgendaCatalogs } from '../hooks/useAgendaCatalogs';
import { alternativesOf, buildDayContext, openingRangesOn } from '../model';

type ClientChoice = Pick<ClientListItem, 'id' | 'fullName' | 'status'>;

function Step({
  number,
  title,
  done,
  summary,
  onEdit,
  active,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  summary?: ReactNode;
  onEdit?: () => void;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`step-${number}`}
      className={cn(
        'border-b border-border px-4 py-5 last:border-b-0 md:px-5',
        !active && !done && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold',
            done
              ? 'bg-primary text-on-primary'
              : active
                ? 'border-2 border-primary text-primary'
                : 'border border-border-strong text-fg-muted',
          )}
        >
          {done ? <Check className="size-4" /> : number}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`step-${number}`} className="text-h3 text-fg">
              <span className="sr-only">Paso {number}: </span>
              {title}
              {done && <span className="sr-only"> (completado)</span>}
            </h2>
            {done && onEdit && !active && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Cambiar
              </Button>
            )}
          </div>
          {done && !active && summary && (
            <div className="text-body-sm text-fg-muted">{summary}</div>
          )}
          {active && children}
        </div>
      </div>
    </section>
  );
}

/**
 * Asistente de nueva cita: cliente → servicio → fecha y profesional → horario →
 * confirmar. Los horarios se calculan con el mismo algoritmo que valida el
 * servidor; si alguien ocupa el horario mientras tanto, se ofrecen alternativas
 * sin perder lo ya elegido.
 */
export function NewAppointmentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const today = toDateKey(now);
  const create = useCreateAppointment();
  const clinicWide = usePermissionScope('appointments.manage') === 'all';

  const initialDate = params.get('fecha');
  const initialTime = params.get('hora');
  const prefilled = useClient(params.get('cliente') ?? undefined);

  const [picked, setPicked] = useState<ClientChoice | null | undefined>(undefined);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [treatmentId, setTreatmentId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState(params.get('profesional') ?? '');
  const [date, setDate] = useState(initialDate && initialDate >= today ? initialDate : today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [keepSuggestion, setKeepSuggestion] = useState(true);
  const [status, setStatus] = useState<'PENDIENTE' | 'CONFIRMADA'>('PENDIENTE');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [serverError, setServerError] = useState<{
    message: string;
    alternatives: SlotAlternative[];
  } | null>(null);

  const client: ClientChoice | null =
    picked !== undefined
      ? picked
      : prefilled.status === 'success' && prefilled.data.status === 'ACTIVO'
        ? prefilled.data
        : null;

  const catalogs = useAgendaCatalogs(date);
  const day = useAgendaAppointments(null, date, date);
  const treatments = useClientActiveTreatments(client?.id ?? null);

  // Llegada desde un tratamiento (?tratamiento=): se preselecciona una sola vez,
  // cuando se cargan los tratamientos activos del cliente.
  const requestedTreatment = params.get('tratamiento');
  const [treatmentApplied, setTreatmentApplied] = useState(false);
  if (!treatmentApplied && requestedTreatment && treatments.status === 'success') {
    setTreatmentApplied(true);
    const t = treatments.data.find((x) => x.id === requestedTreatment);
    if (t) {
      setTreatmentId(t.id);
      setServiceId(t.serviceId);
      setProfessionalId(t.professionalId);
    }
  }

  if (!clinicWide) {
    return (
      <NoPermissionState description="Las citas las agendan recepción y administración. Desde tu agenda puedes confirmar y registrar la asistencia de tus citas." />
    );
  }
  if (catalogs.status === 'loading' || (params.get('cliente') && prefilled.status === 'loading')) {
    return (
      <LoadingRegion label="Preparando el asistente" className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </LoadingRegion>
    );
  }
  if (catalogs.status === 'error') {
    return <ErrorState description={catalogs.error.message} onRetry={catalogs.retry} />;
  }

  const { professionals, services, rooms, clinic } = catalogs.data;
  const service = services.find((s) => s.id === serviceId) ?? null;
  const treatmentList = treatments.status === 'success' ? treatments.data : [];
  const treatment = treatmentList.find((t) => t.id === treatmentId) ?? null;
  const eligible = service
    ? professionals.filter((p) => p.active && p.serviceIds.includes(service.id))
    : [];
  const nameOf = (id: string) => professionals.find((p) => p.id === id)?.displayName ?? '';

  const slots =
    service && clinic && day.status === 'success'
      ? findSlots(
          buildDayContext({
            date,
            clinic,
            professionals,
            exceptions: catalogs.data.exceptions,
            rooms,
            appointments: day.data,
            now,
          }),
          { service, clientId: client?.id ?? null, professionalId: professionalId || null },
        )
      : [];
  // Si se llegó desde un hueco de la agenda, ese horario queda preseleccionado
  // (solo hasta que se cambie la fecha, el profesional o el servicio).
  const suggested =
    keepSuggestion && initialTime && TIME_PATTERN.test(initialTime)
      ? slots.find(
          (s) =>
            s.start === initialTime && (!professionalId || s.professionalId === professionalId),
        )
      : undefined;
  const chosenSlot = slot ?? suggested ?? null;

  // Paso activo: el primero incompleto, salvo que se esté editando uno anterior.
  const firstIncomplete = !client ? 1 : !service ? 2 : !chosenSlot ? 4 : 5;
  const activeStep = editing ?? firstIncomplete;
  const dayOptions = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    .filter((d) => openingRangesOn(clinic, d).length > 0)
    .slice(0, 7);

  const resetSlot = () => {
    setSlot(null);
    setKeepSuggestion(false);
    setServerError(null);
  };

  const submit = async (target: { start: string; professionalId: string }) => {
    if (!client || !service) return;
    setServerError(null);
    try {
      const { appointmentId } = await create.mutateAsync({
        clientId: client.id,
        serviceId: service.id,
        professionalId: target.professionalId,
        date,
        start: target.start,
        treatmentId,
        status,
        notes,
      });
      toast.success(
        'Cita agendada',
        `${client.fullName} · ${capitalizeFirst(formatDayLong(date))} a las ${target.start}.`,
      );
      navigate(`/agenda?fecha=${date}&cita=${appointmentId}`, { replace: true });
    } catch (err) {
      setServerError({ message: toAppError(err).message, alternatives: alternativesOf(err) });
      setSlot(null);
      setEditing(null);
    }
  };

  const professionalLabel = chosenSlot
    ? nameOf(chosenSlot.professionalId)
    : professionalId
      ? nameOf(professionalId)
      : 'Cualquiera disponible';
  const roomLabel = chosenSlot ? rooms.find((r) => r.id === chosenSlot.roomId)?.name : null;

  return (
    <>
      <PageHeader
        back={{ to: '/agenda', label: 'Agenda' }}
        title="Nueva cita"
        description="Los horarios que se ofrecen ya consideran el horario del profesional, sus ausencias y los espacios libres."
      />
      {!clinic && (
        <InlineAlert
          tone="warning"
          className="mb-6"
          title="El consultorio no tiene horario de atención."
        >
          Configúralo en Configuración para poder agendar citas.
        </InlineAlert>
      )}
      {params.get('cliente') &&
        prefilled.status === 'success' &&
        prefilled.data.status !== 'ACTIVO' &&
        picked === undefined && (
          <InlineAlert tone="warning" className="mb-6" title="El cliente está inactivo.">
            Reactívalo desde su perfil para agendarle citas, o elige otro cliente.
          </InlineAlert>
        )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Panel flush>
          <Step
            number={1}
            title="Cliente"
            active={activeStep === 1}
            done={!!client}
            summary={client?.fullName}
            onEdit={() => setEditing(1)}
          >
            <ClientPicker
              selectedId={client?.id ?? null}
              onSelect={(c) => {
                setPicked(c);
                setServiceId(null);
                setTreatmentId(null);
                resetSlot();
                setEditing(null);
              }}
            />
          </Step>

          <Step
            number={2}
            title="Servicio"
            active={activeStep === 2}
            done={!!service}
            summary={
              service && (
                <span className="flex flex-wrap items-center gap-2">
                  <CategoryTag category={service.category} />
                  {service.name} · {service.durationMin} min
                  {treatment &&
                    ` · sesión ${treatment.completedSessions + 1} de ${treatment.plannedSessions} (aprox.)`}
                </span>
              )
            }
            onEdit={() => setEditing(2)}
          >
            <div className="flex flex-col gap-5">
              {treatmentList.length > 0 && (
                <RadioCardGroup
                  label="Continuar un tratamiento activo"
                  value={treatmentId ?? undefined}
                  onChange={(id) => {
                    const t = treatmentList.find((x) => x.id === id)!;
                    setTreatmentId(t.id);
                    setServiceId(t.serviceId);
                    setProfessionalId(t.professionalId);
                    resetSlot();
                    setEditing(null);
                  }}
                  options={treatmentList.map((t) => ({
                    value: t.id,
                    label: t.serviceName,
                    description: `${t.professionalName} · ${t.completedSessions} de ${t.plannedSessions} sesiones realizadas`,
                  }))}
                />
              )}
              <div className="flex flex-col gap-4">
                <p className="text-body-sm font-medium text-fg">
                  {treatmentList.length > 0 ? 'O elige un servicio' : 'Elige el servicio'}
                </p>
                {TREATMENT_CATEGORIES.map((c) => {
                  const list = services.filter((s) => s.category === c && s.active);
                  if (list.length === 0) return null;
                  return (
                    <fieldset key={c} className="flex flex-col gap-2">
                      <legend className="mb-2">
                        <CategoryTag category={c} />
                        <span className="sr-only"> ({TREATMENT_CATEGORY_LABELS[c]})</span>
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {list.map((s) => (
                          <Button
                            key={s.id}
                            variant={serviceId === s.id && !treatmentId ? 'primary' : 'secondary'}
                            aria-pressed={serviceId === s.id && !treatmentId}
                            onClick={() => {
                              setServiceId(s.id);
                              setTreatmentId(null);
                              resetSlot();
                              setEditing(null);
                            }}
                          >
                            {s.name}
                            <span className="font-normal opacity-80">· {s.durationMin} min</span>
                          </Button>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </div>
          </Step>

          <Step
            number={3}
            title="Fecha y profesional"
            active={activeStep === 3 || activeStep === 4}
            done={!!service && !!chosenSlot}
            summary={`${capitalizeFirst(formatDayLong(date))} · ${professionalLabel}`}
            onEdit={() => setEditing(3)}
          >
            {!service ? (
              <p className="text-body-sm text-fg-muted">Elige primero el servicio.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-body-sm font-medium text-fg" id="quick-days">
                    Próximos días de atención
                  </span>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="quick-days">
                    {dayOptions.map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={d === date ? 'primary' : 'secondary'}
                        aria-pressed={d === date}
                        onClick={() => {
                          setDate(d);
                          resetSlot();
                        }}
                      >
                        {d === today
                          ? 'Hoy'
                          : d === addDays(today, 1)
                            ? 'Mañana'
                            : capitalizeFirst(formatDayShort(d))}
                      </Button>
                    ))}
                  </div>
                </div>
                <FormField label="Fecha">
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      min={today}
                      value={date}
                      onChange={(e) => {
                        if (e.target.value) setDate(e.target.value);
                        resetSlot();
                      }}
                    />
                  )}
                </FormField>
                <FormField
                  label="Profesional"
                  hint={eligible.length === 0 ? 'Nadie realiza este servicio todavía.' : undefined}
                >
                  {(p) => (
                    <Select
                      {...p}
                      value={professionalId}
                      onChange={(e) => {
                        setProfessionalId(e.target.value);
                        resetSlot();
                      }}
                    >
                      <option value="">Cualquiera disponible</option>
                      {eligible.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.displayName}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
            )}
          </Step>

          <Step
            number={4}
            title="Horario"
            active={activeStep === 4 || activeStep === 3}
            done={!!chosenSlot}
            summary={
              chosenSlot &&
              `${chosenSlot.start} – ${chosenSlot.end}${roomLabel ? ` · ${roomLabel}` : ''}`
            }
            onEdit={() => setEditing(4)}
          >
            {serverError && (
              <InlineAlert tone="danger" title={serverError.message}>
                {serverError.alternatives.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="w-full">Horarios cercanos libres:</span>
                    {serverError.alternatives.map((a) => (
                      <Button
                        key={`${a.start}|${a.professionalId}`}
                        variant="secondary"
                        size="sm"
                        loading={create.isPending}
                        onClick={() => void submit(a)}
                      >
                        Agendar a las {a.start} · {a.professionalName}
                      </Button>
                    ))}
                  </div>
                )}
              </InlineAlert>
            )}
            {!service ? (
              <p className="text-body-sm text-fg-muted">Elige primero el servicio.</p>
            ) : day.status !== 'success' ? (
              <div className="flex flex-wrap gap-2" aria-busy="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-9 w-16" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <InlineAlert tone="info" title="No hay horarios libres ese día.">
                Prueba otra fecha{professionalId ? ' u otro profesional' : ''}.
              </InlineAlert>
            ) : (
              <SlotPicker
                slots={slots}
                value={chosenSlot}
                onChange={(s) => {
                  setSlot(s);
                  setServerError(null);
                  setEditing(null);
                }}
                professionalName={professionalId ? undefined : nameOf}
                label="Horarios libres"
              />
            )}
          </Step>

          <Step number={5} title="Confirmar" active={activeStep === 5} done={false}>
            <div className="flex flex-col gap-5">
              <RadioCardGroup
                label="Estado inicial"
                value={status}
                onChange={setStatus}
                options={[
                  {
                    value: 'PENDIENTE',
                    label: 'Pendiente',
                    description: 'Falta confirmar con el cliente.',
                  },
                  {
                    value: 'CONFIRMADA',
                    label: 'Confirmada',
                    description: 'El cliente ya confirmó su asistencia.',
                  },
                ]}
              />
              <FormField
                label="Nota para el equipo"
                optional
                hint="Datos administrativos, p. ej. “trae sus estudios”. No registres información clínica."
              >
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    maxLength={300}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button asChild variant="secondary">
                  <Link to="/agenda">Cancelar</Link>
                </Button>
                <Button
                  onClick={() => chosenSlot && void submit(chosenSlot)}
                  loading={create.isPending}
                  disabled={!chosenSlot}
                >
                  Agendar cita
                </Button>
              </div>
            </div>
          </Step>
        </Panel>

        <Panel title="Resumen" className="lg:sticky lg:top-20">
          <KeyValueList
            columns={1}
            items={[
              { label: 'Cliente', value: client?.fullName ?? null },
              {
                label: 'Servicio',
                value: service
                  ? `${service.name}${treatment ? ` · tratamiento en curso` : ''}`
                  : null,
              },
              { label: 'Profesional', value: service ? professionalLabel : null },
              { label: 'Fecha', value: service ? capitalizeFirst(formatDayLong(date)) : null },
              {
                label: 'Horario',
                value: chosenSlot ? `${chosenSlot.start} – ${chosenSlot.end}` : null,
              },
              { label: 'Espacio', value: roomLabel ?? null },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
