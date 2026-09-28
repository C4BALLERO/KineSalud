import {
  addDays,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  clinicMinutesOf,
  EXCEPTION_TYPE_LABELS,
  formatRanges,
  minutesToTime,
  startOfWeek,
  toDateKey,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type DateKey,
} from '@kinesalud/shared';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useRequiredSession } from '@/features/auth/session';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { useNow } from '@/hooks/useNow';
import { usePermissionScope } from '@/hooks/usePermission';
import { cn } from '@/utils/cn';
import { capitalizeFirst, formatDayLong, formatDayMonth, formatDayShort } from '@/utils/format';
import { useAgendaAppointments, type AgendaAppointment } from '../api/appointments';
import { AgendaList } from '../components/AgendaList';
import { AppointmentDetailSheet } from '../components/AppointmentDetailSheet';
import { TimeGrid, type GridColumn } from '../components/TimeGrid';
import { useAgendaCatalogs } from '../hooks/useAgendaCatalogs';
import { gridBounds, openingRangesOn, professionalRanges, type AgendaView } from '../model';

const isDateKey = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Agenda del consultorio (o "Mi agenda" del profesional): vista día con una
 * columna por profesional, vista semana con una columna por día, y lista en
 * móvil. Filtros y cita abierta viven en la URL (enlaces compartibles).
 */
export function AgendaPage() {
  const session = useRequiredSession();
  const clinicWide = usePermissionScope('appointments.read') === 'all';
  const canCreate = usePermissionScope('appointments.manage') === 'all';
  const now = useNow();
  const today = toDateKey(now);
  const desktop = useMediaQuery(BREAKPOINTS.md);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const date = isDateKey(params.get('fecha')) ? params.get('fecha')! : today;
  const view: AgendaView = params.get('vista') === 'semana' ? 'semana' : 'dia';
  const category = TREATMENT_CATEGORIES.find((c) => c === params.get('categoria')) ?? null;
  const status = APPOINTMENT_STATUSES.find((s) => s === params.get('estado')) ?? null;
  const openId = params.get('cita');
  // El profesional solo ve su agenda; administración y recepción pueden filtrar.
  const professionalFilter = clinicWide ? params.get('profesional') : session.professionalId;

  const from = view === 'semana' ? startOfWeek(date) : date;
  const to = view === 'semana' ? addDays(from, 6) : date;

  const catalogs = useAgendaCatalogs(from);
  const appointments = useAgendaAppointments(
    clinicWide ? null : (session.professionalId ?? null),
    from,
    to,
    clinicWide || !!session.professionalId,
  );

  const update = (changes: Record<string, string | null>, replace = true) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace },
    );
  const goTo = (d: DateKey) => update({ fecha: d === today ? null : d, cita: null });
  const step = view === 'semana' ? 7 : 1;
  const open = (id: string) => update({ cita: id }, false);
  const close = () => update({ cita: null });

  if (!clinicWide && !session.professionalId) {
    return (
      <>
        <PageHeader title="Mi agenda" />
        <InlineAlert
          tone="info"
          title="Tu cuenta aún no está vinculada a una ficha de profesional."
        >
          Pide a la administración que la vincule desde Personal para ver tus citas.
        </InlineAlert>
      </>
    );
  }

  const title =
    view === 'semana'
      ? `Semana del ${formatDayMonth(from)} al ${formatDayMonth(to)}`
      : capitalizeFirst(formatDayLong(date)) + (date === today ? ' · hoy' : '');

  const filtered: AgendaAppointment[] =
    appointments.status === 'success'
      ? appointments.data.filter(
          (a) =>
            (!professionalFilter || a.professionalId === professionalFilter) &&
            (!category || a.category === category) &&
            (!status || a.status === status),
        )
      : [];
  const activeCount = filtered.filter((a) => a.status !== 'CANCELADA').length;

  const newAppointmentUrl = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ fecha: date, ...extra });
    if (professionalFilter && clinicWide && !extra.profesional)
      q.set('profesional', professionalFilter);
    return `/agenda/nueva?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={clinicWide ? 'Agenda' : 'Mi agenda'}
        description={title}
        actions={
          canCreate && (
            <Button asChild className="hidden md:inline-flex">
              <Link to={newAppointmentUrl()}>
                <CalendarPlus aria-hidden="true" />
                Nueva cita
              </Link>
            </Button>
          )
        }
      />

      <Panel flush>
        {/* Barra de navegación y filtros */}
        <div className="flex flex-col gap-3 border-b border-border p-3 md:px-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <IconButton
              label={view === 'semana' ? 'Semana anterior' : 'Día anterior'}
              icon={<ChevronLeft />}
              variant="secondary"
              onClick={() => goTo(addDays(date, -step))}
            />
            <Button variant="secondary" onClick={() => goTo(today)} disabled={date === today}>
              Hoy
            </Button>
            <IconButton
              label={view === 'semana' ? 'Semana siguiente' : 'Día siguiente'}
              icon={<ChevronRight />}
              variant="secondary"
              onClick={() => goTo(addDays(date, step))}
            />
            <Input
              type="date"
              aria-label="Ir a la fecha"
              value={date}
              onChange={(e) => isDateKey(e.target.value) && goTo(e.target.value)}
              className="w-40"
            />
          </div>
          <SegmentedControl
            label="Vista de la agenda"
            value={view}
            onChange={(v) => update({ vista: v === 'dia' ? null : v, cita: null })}
            options={[
              { value: 'dia', label: 'Día' },
              { value: 'semana', label: 'Semana' },
            ]}
            className="w-fit"
          />
          <div className="grid grid-cols-2 gap-2 lg:ml-auto lg:flex">
            {clinicWide && catalogs.status === 'success' && (
              <Select
                aria-label="Filtrar por profesional"
                value={professionalFilter ?? ''}
                onChange={(e) => update({ profesional: e.target.value || null })}
              >
                <option value="">Todo el personal</option>
                {catalogs.data.professionals
                  .filter((p) => p.active || p.id === professionalFilter)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
              </Select>
            )}
            <Select
              aria-label="Filtrar por área"
              value={category ?? ''}
              onChange={(e) => update({ categoria: e.target.value || null })}
            >
              <option value="">Todas las áreas</option>
              {TREATMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TREATMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por estado"
              value={status ?? ''}
              onChange={(e) => update({ estado: e.target.value || null })}
              className="col-span-2 lg:col-span-1"
            >
              <option value="">Todos los estados</option>
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {appointments.status === 'success' && (
          <p
            aria-live="polite"
            className="border-b border-border px-4 py-2 text-caption text-fg-muted md:px-5"
          >
            {activeCount} {activeCount === 1 ? 'cita' : 'citas'}
            {view === 'semana' ? ' en la semana' : ''}
            {filtered.length > activeCount && ` · ${filtered.length - activeCount} canceladas`}
          </p>
        )}

        {(catalogs.status === 'loading' || appointments.status === 'loading') && (
          <LoadingRegion label="Cargando agenda" className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-96 w-full" />
          </LoadingRegion>
        )}
        {catalogs.status === 'error' && (
          <ErrorState description={catalogs.error.message} onRetry={catalogs.retry} />
        )}
        {appointments.status === 'error' && (
          <ErrorState description={appointments.error.message} onRetry={appointments.retry} />
        )}

        {catalogs.status === 'success' && appointments.status === 'success' && (
          <>
            {!catalogs.data.clinic && (
              <InlineAlert
                tone="warning"
                className="m-4"
                title="El consultorio no tiene horario de atención."
              >
                Configúralo en Configuración para poder agendar citas.
              </InlineAlert>
            )}
            {view === 'semana' && !desktop && (
              <WeekStrip
                from={from}
                selected={date}
                today={today}
                onSelect={(d) => update({ fecha: d, vista: null })}
                appointments={filtered}
              />
            )}
            {desktop ? (
              <TimeGrid
                columns={
                  view === 'dia'
                    ? dayColumns({
                        date,
                        catalogs: catalogs.data,
                        appointments: filtered,
                        professionalFilter,
                        category,
                        onEmptyClick: canCreate
                          ? (professionalId, minute) =>
                              navigate(
                                newAppointmentUrl({
                                  profesional: professionalId,
                                  hora: minutesToTime(minute),
                                }),
                              )
                          : undefined,
                      })
                    : weekColumns({
                        from,
                        today,
                        catalogs: catalogs.data,
                        appointments: filtered,
                        professionalFilter,
                        onDayClick: (d) => update({ fecha: d, vista: null }),
                      })
                }
                bounds={gridBounds(
                  view === 'dia'
                    ? openingRangesOn(catalogs.data.clinic, date)
                    : Array.from({ length: 7 }, (_, i) =>
                        openingRangesOn(catalogs.data.clinic, addDays(from, i)),
                      ).flat(),
                  filtered,
                )}
                slotMinutes={catalogs.data.clinic?.slotMinutes ?? 15}
                onOpen={open}
                selectedId={openId}
                nowMinute={view === 'dia' ? (date === today ? clinicMinutesOf(now) : null) : null}
                compact={view === 'semana'}
                showProfessional={view === 'semana' && !professionalFilter}
                minColumnWidth={view === 'semana' ? 120 : 176}
              />
            ) : (
              <AgendaList
                appointments={
                  view === 'semana' ? filtered : filtered.filter((a) => a.date === date)
                }
                now={now}
                onOpen={open}
                selectedId={openId}
                hideProfessional={!clinicWide}
                showDayHeaders={view === 'semana'}
                emptyAction={
                  canCreate && (
                    <Button asChild variant="secondary">
                      <Link to={newAppointmentUrl()}>Agendar una cita</Link>
                    </Button>
                  )
                }
              />
            )}
          </>
        )}
      </Panel>

      {/* En móvil, acceso rápido a "Nueva cita" (botón flotante sobre la barra inferior). */}
      {canCreate && (
        <Button
          asChild
          className="fixed right-4 bottom-[calc(var(--bottomnav-height)+1rem)] z-30 h-14 rounded-full px-5 shadow-lg md:hidden"
        >
          <Link to={newAppointmentUrl()}>
            <CalendarPlus aria-hidden="true" />
            Nueva cita
          </Link>
        </Button>
      )}

      <AppointmentDetailSheet appointmentId={openId} onClose={close} />
    </>
  );
}

/* ---------- Columnas de la grilla ---------- */

type Catalogs = Extract<ReturnType<typeof useAgendaCatalogs>, { status: 'success' }>['data'];

function ColumnHeader({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone?: 'muted' | 'warning';
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-body-sm font-semibold text-fg">{title}</span>
      <span
        className={cn(
          'tabular truncate text-caption',
          tone === 'warning' ? 'text-warning' : 'text-fg-subtle',
        )}
      >
        {detail}
      </span>
    </div>
  );
}

function dayColumns(input: {
  date: DateKey;
  catalogs: Catalogs;
  appointments: AgendaAppointment[];
  professionalFilter: string | null;
  category: string | null;
  onEmptyClick?: (professionalId: string, minute: number) => void;
}): GridColumn[] {
  const { date, catalogs, appointments } = input;
  const clinic = catalogs.clinic ?? { openingHours: {} };
  return (
    catalogs.professionals
      .filter((p) => !input.professionalFilter || p.id === input.professionalFilter)
      .filter((p) => !input.category || p.categories.includes(input.category as never))
      .map((p) => {
        const own = appointments.filter((a) => a.professionalId === p.id);
        const ranges = professionalRanges(p, catalogs.exceptions, clinic, date);
        const absence = catalogs.exceptions.find(
          (e) => e.professionalId === p.id && e.dateFrom <= date && date <= e.dateTo,
        );
        return { p, own, ranges, absence };
      })
      // Se muestran quienes atienden ese día o tienen citas (aunque estén ausentes).
      .filter(
        ({ p, own, ranges }) =>
          (p.active && ranges.length > 0) || own.length > 0 || p.id === input.professionalFilter,
      )
      .map(({ p, own, ranges, absence }) => {
        const unavailable = absence
          ? EXCEPTION_TYPE_LABELS[absence.type]
          : !p.active
            ? 'Inactivo'
            : ranges.length === 0
              ? 'No atiende este día'
              : null;
        return {
          key: p.id,
          header: (
            <ColumnHeader
              title={p.displayName}
              detail={unavailable ?? formatRanges(ranges)}
              tone={absence ? 'warning' : undefined}
            />
          ),
          available: ranges,
          unavailableLabel: unavailable,
          appointments: own,
          onEmptyClick: input.onEmptyClick
            ? (m: number) => input.onEmptyClick!(p.id, m)
            : undefined,
        };
      })
  );
}

function weekColumns(input: {
  from: DateKey;
  today: DateKey;
  catalogs: Catalogs;
  appointments: AgendaAppointment[];
  professionalFilter: string | null;
  onDayClick: (d: DateKey) => void;
}): GridColumn[] {
  const { catalogs } = input;
  const clinic = catalogs.clinic ?? { openingHours: {} };
  const professional = catalogs.professionals.find((p) => p.id === input.professionalFilter);
  const days = Array.from({ length: 7 }, (_, i) => addDays(input.from, i)).filter(
    (d) =>
      openingRangesOn(catalogs.clinic, d).length > 0 ||
      input.appointments.some((a) => a.date === d),
  );
  return days.map((d) => {
    const items = input.appointments.filter((a) => a.date === d);
    const available = professional
      ? professionalRanges(professional, catalogs.exceptions, clinic, d)
      : openingRangesOn(catalogs.clinic, d);
    const active = items.filter((a) => a.status !== 'CANCELADA').length;
    return {
      key: d,
      header: (
        <button
          type="button"
          onClick={() => input.onDayClick(d)}
          className={cn(
            'flex w-full cursor-pointer flex-col rounded-sm text-left hover:text-primary',
            d === input.today && 'text-primary',
          )}
          aria-label={`Ver el ${formatDayLong(d)} en vista día (${active} citas)`}
        >
          <span className="text-body-sm font-semibold">
            {capitalizeFirst(formatDayShort(d))}
            {d === input.today && ' · hoy'}
          </span>
          <span className="text-caption text-fg-subtle">
            {active} {active === 1 ? 'cita' : 'citas'}
          </span>
        </button>
      ),
      available,
      unavailableLabel: available.length === 0 ? (professional ? 'No atiende' : 'Cerrado') : null,
      appointments: items,
    };
  });
}

/** Selector de día dentro de la semana (móvil). */
function WeekStrip({
  from,
  selected,
  today,
  onSelect,
  appointments,
}: {
  from: DateKey;
  selected: DateKey;
  today: DateKey;
  onSelect: (d: DateKey) => void;
  appointments: AgendaAppointment[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-border p-2"
      role="group"
      aria-label="Días de la semana"
    >
      {days.map((d) => {
        const count = appointments.filter((a) => a.date === d && a.status !== 'CANCELADA').length;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-pressed={d === selected}
            aria-label={`${formatDayLong(d)}, ${count} citas`}
            className={cn(
              'flex min-h-11 min-w-12 flex-1 cursor-pointer flex-col items-center rounded-md px-1 py-1 text-caption',
              d === selected
                ? 'bg-primary text-on-primary'
                : 'text-fg-muted hover:bg-surface-muted',
              d === today && d !== selected && 'font-semibold text-primary',
            )}
          >
            <span>{capitalizeFirst(formatDayShort(d)).split(' ')[0]}</span>
            <span className="tabular text-body-sm font-semibold">{Number(d.slice(8))}</span>
            <span className="tabular">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
