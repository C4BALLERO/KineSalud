import {
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  toDateKey,
  weeklyMinutes,
  type TreatmentCategory,
} from '@kinesalud/shared';
import { CalendarClock, Eye, MoreHorizontal, Pencil, Stethoscope, UserPlus } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Can } from '@/components/access/Can';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { EmptyState, ErrorState, NoResultsState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useRequiredSession } from '@/features/auth/session';
import { useNow } from '@/hooks/useNow';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { useExceptions, useProfessionals, type ProfessionalItem } from '../api/staff';
import { AccountBadge, AvailabilityBadge } from '../components/StaffBadges';
import { availabilitySummary } from '../model';

type StatusFilter = 'activos' | 'inactivos' | 'todos';

/** Directorio del personal: quién atiende hoy, sus áreas y su horario. */
export function StaffPage() {
  const session = useRequiredSession();
  const scope = usePermissionScope('staff.read');
  const canManage = usePermission('staff.manage');
  const now = useNow();
  const today = toDateKey(now);
  const [params, setParams] = useSearchParams();

  const professionals = useProfessionals();
  const exceptions = useExceptions(null, today);

  // El profesional solo consulta su propia ficha.
  if (scope === 'own') {
    return session.professionalId ? (
      <Navigate to={`/personal/${session.professionalId}`} replace />
    ) : (
      <Navigate to="/mi-cuenta" replace />
    );
  }

  const area = TREATMENT_CATEGORIES.find((c) => c === params.get('area')) ?? null;
  const status: StatusFilter =
    params.get('estado') === 'inactivos' || params.get('estado') === 'todos'
      ? (params.get('estado') as StatusFilter)
      : 'activos';
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const allExceptions = exceptions.status === 'success' ? exceptions.data : [];
  const summaryOf = (p: ProfessionalItem) =>
    availabilitySummary(
      p,
      allExceptions.filter((e) => e.professionalId === p.id),
      today,
    );

  const actions = (p: ProfessionalItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Acciones para ${p.displayName}`}
          className="w-11 px-0 md:w-8"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asLink={`/personal/${p.id}`} icon={<Eye aria-hidden="true" />}>
          Ver ficha
        </DropdownMenuItem>
        <DropdownMenuItem
          asLink={`/personal/${p.id}?tab=horario`}
          icon={<CalendarClock aria-hidden="true" />}
        >
          Horario y ausencias
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem
            asLink={`/personal/${p.id}/editar`}
            icon={<Pencil aria-hidden="true" />}
          >
            Editar datos
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const identity = (p: ProfessionalItem) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        name={`${p.firstName} ${p.lastName}`}
        size="sm"
        className={p.active ? undefined : 'opacity-60'}
      />
      <div className="flex min-w-0 flex-col">
        <Link
          to={`/personal/${p.id}`}
          className="truncate rounded-sm font-medium text-fg underline-offset-2 hover:text-primary hover:underline"
        >
          {p.displayName}
        </Link>
        {p.specialties.length > 0 && (
          <span className="truncate text-caption text-fg-subtle">{p.specialties.join(', ')}</span>
        )}
      </div>
    </div>
  );

  const availability = (p: ProfessionalItem) => {
    const s = summaryOf(p);
    return (
      <div className="flex flex-col items-start gap-1">
        <AvailabilityBadge summary={s} />
        {s.detail && <span className="tabular text-caption text-fg-muted">{s.detail}</span>}
      </div>
    );
  };

  const columns: Column<ProfessionalItem>[] = [
    { id: 'profesional', header: 'Profesional', cell: identity },
    {
      id: 'areas',
      header: 'Áreas',
      cell: (p) => (
        <div className="flex flex-col gap-1">
          {p.categories.map((c) => (
            <CategoryTag key={c} category={c} />
          ))}
        </div>
      ),
      className: 'w-40',
    },
    { id: 'hoy', header: 'Hoy', cell: availability, className: 'w-52' },
    {
      id: 'semana',
      header: 'Horas por semana',
      cell: (p) => {
        const hours = weeklyMinutes(p.weeklySchedule) / 60;
        return hours > 0 ? (
          <span className="tabular">{Number.isInteger(hours) ? hours : hours.toFixed(1)} h</span>
        ) : (
          <span className="text-fg-subtle">Sin horario</span>
        );
      },
      className: 'w-36',
      hideBelowLg: true,
    },
    {
      id: 'cuenta',
      header: 'Cuenta',
      cell: (p) => <AccountBadge linked={!!p.userId} />,
      className: 'w-32',
      hideBelowLg: true,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: actions,
      className: 'w-20 text-right [&>*]:ml-auto',
    },
  ];

  const rows =
    professionals.status === 'success'
      ? professionals.data
          .filter((p) => (status === 'todos' ? true : status === 'activos' ? p.active : !p.active))
          .filter((p) => !area || p.categories.includes(area))
      : [];
  const active =
    professionals.status === 'success' ? professionals.data.filter((p) => p.active) : [];
  const workingToday = active.filter((p) => summaryOf(p).tone === 'success').length;
  const absentToday = active.filter((p) => summaryOf(p).tone === 'warning').length;
  const hasFilters = !!area || status !== 'activos';

  return (
    <>
      <PageHeader
        title="Personal"
        description="Profesionales del consultorio, sus áreas de atención, horarios y ausencias."
        actions={
          <Can permission="staff.manage">
            <Button asChild>
              <Link to="/personal/nuevo">
                <UserPlus aria-hidden="true" />
                Nuevo profesional
              </Link>
            </Button>
          </Can>
        }
      />

      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:px-5">
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select
              aria-label="Filtrar por área"
              value={area ?? ''}
              onChange={(e) => setParam('area', e.target.value || null)}
            >
              <option value="">Todas las áreas</option>
              {TREATMENT_CATEGORIES.map((c: TreatmentCategory) => (
                <option key={c} value={c}>
                  {TREATMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) =>
                setParam('estado', e.target.value === 'activos' ? null : e.target.value)
              }
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos los estados</option>
            </Select>
          </div>
          {professionals.status === 'success' && (
            <p aria-live="polite" className="text-body-sm text-fg-muted md:ml-auto">
              {active.length} activos · {workingToday} atienden hoy
              {absentToday > 0 && ` · ${absentToday} ausente${absentToday > 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {professionals.status === 'loading' && <ListSkeleton rows={4} label="Cargando personal…" />}
        {professionals.status === 'error' && (
          <ErrorState description={professionals.error.message} onRetry={professionals.retry} />
        )}
        {professionals.status === 'success' &&
          (rows.length === 0 ? (
            hasFilters ? (
              <NoResultsState onClear={() => setParams(new URLSearchParams(), { replace: true })} />
            ) : (
              <EmptyState
                icon={<Stethoscope />}
                title="Aún no hay profesionales"
                description="Registra a los profesionales del consultorio para definir sus horarios y agendarles citas."
                action={
                  canManage && (
                    <Button asChild>
                      <Link to="/personal/nuevo">
                        <UserPlus aria-hidden="true" />
                        Nuevo profesional
                      </Link>
                    </Button>
                  )
                }
              />
            )
          ) : (
            <DataTable
              caption="Profesionales del consultorio"
              rows={rows}
              columns={columns}
              getRowKey={(p) => p.id}
              renderMobileRow={(p) => (
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {identity(p)}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11">
                      {p.categories.map((c) => (
                        <CategoryTag key={c} category={c} />
                      ))}
                    </div>
                    <div className="pl-11">{availability(p)}</div>
                  </div>
                  {actions(p)}
                </div>
              )}
            />
          ))}
      </Panel>
    </>
  );
}
