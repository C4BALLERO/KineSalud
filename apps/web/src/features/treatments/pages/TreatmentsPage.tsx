import {
  remainingSessions,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type TreatmentCategory,
} from '@kinesalud/shared';
import { HeartPulse, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { TreatmentStatusBadge } from '@/components/domain/StatusBadge';
import { EmptyState, ErrorState, NoResultsState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { SessionProgress } from '@/components/ui/Progress';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useRequiredSession } from '@/features/auth/session';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { formatDayMonth } from '@/utils/format';
import { useTreatments, type TreatmentItem } from '../api/treatments';
import { filterTreatments, isEnding, type StatusFilter } from '../model';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVO', label: 'Activos' },
  { value: 'SUSPENDIDO', label: 'Suspendidos' },
  { value: 'FINALIZADO', label: 'Finalizados' },
  { value: 'TODOS', label: 'Todos los estados' },
];

/**
 * Tratamientos. Administración y recepción ven los del consultorio; el
 * profesional, solo los suyos.
 */
export function TreatmentsPage() {
  const session = useRequiredSession();
  const clinicWide = usePermissionScope('treatments.read') === 'all';
  const canManage = usePermission('treatments.manage');
  const [params, setParams] = useSearchParams();

  const status = STATUS_OPTIONS.find((o) => o.value === params.get('estado'))?.value ?? 'ACTIVO';
  const category =
    TREATMENT_CATEGORIES.find((c) => c === params.get('area')) ??
    (null as TreatmentCategory | null);
  const professionalId = clinicWide ? params.get('profesional') : null;
  const ending = params.get('por-terminar') === '1';
  const [search, setSearch] = useState('');

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const treatments = useTreatments(
    clinicWide ? null : session.professionalId,
    status === 'TODOS' ? null : status,
  );

  const professionals = useMemo(() => {
    if (treatments.status !== 'success') return [];
    const map = new Map(treatments.data.map((t) => [t.professionalId, t.professionalName]));
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [treatments]);

  const rows =
    treatments.status === 'success'
      ? filterTreatments(treatments.data, { search, category, professionalId, ending })
      : [];
  const hasFilters =
    search !== '' || status !== 'ACTIVO' || !!category || !!professionalId || ending;
  const clearFilters = () => {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const columns: Column<TreatmentItem>[] = [
    {
      id: 'tratamiento',
      header: 'Tratamiento',
      cell: (t) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            to={`/tratamientos/${t.id}`}
            className="truncate font-medium text-fg underline-offset-2 hover:text-primary hover:underline"
          >
            {t.clientName}
          </Link>
          <span className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
            <CategoryTag category={t.category} />
            {t.serviceName}
          </span>
        </div>
      ),
    },
    ...(clinicWide
      ? [
          {
            id: 'profesional',
            header: 'Profesional',
            cell: (t: TreatmentItem) => t.professionalName,
            className: 'w-48',
            hideBelowLg: true,
          },
        ]
      : []),
    {
      id: 'progreso',
      header: 'Progreso',
      cell: (t) => (
        <SessionProgress completed={t.completedSessions} planned={t.plannedSessions} compact />
      ),
      className: 'w-52',
    },
    {
      id: 'inicio',
      header: 'Inicio',
      cell: (t) => formatDayMonth(t.startDate),
      className: 'w-32 text-fg-muted',
      hideBelowLg: true,
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: (t) => <TreatmentStatusBadge status={t.status} />,
      className: 'w-32',
    },
  ];

  return (
    <>
      <PageHeader
        title="Tratamientos"
        description={
          clinicWide
            ? 'Planes de fisioterapia, rehabilitación y estética con su progreso.'
            : 'Los tratamientos de tus pacientes.'
        }
        actions={
          canManage && (
            <Button asChild>
              <Link to="/tratamientos/nuevo">
                <Plus aria-hidden="true" />
                Nuevo tratamiento
              </Link>
            </Button>
          )
        }
      />

      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:px-5 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput
            label="Buscar tratamientos"
            placeholder="Cliente o servicio"
            value={search}
            onChange={setSearch}
            className="lg:max-w-xs lg:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
            <Select
              aria-label="Estado"
              value={status}
              onChange={(e) =>
                setParam('estado', e.target.value === 'ACTIVO' ? null : e.target.value)
              }
              className="sm:w-44"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Área"
              value={category ?? ''}
              onChange={(e) => setParam('area', e.target.value || null)}
              className="sm:w-44"
            >
              <option value="">Todas las áreas</option>
              {TREATMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TREATMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            {clinicWide && (
              <Select
                aria-label="Profesional"
                value={professionalId ?? ''}
                onChange={(e) => setParam('profesional', e.target.value || null)}
                className="col-span-2 sm:w-52"
              >
                <option value="">Todos los profesionales</option>
                {professionals.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <Checkbox
            label="Por terminar (2 sesiones o menos)"
            checked={ending}
            onCheckedChange={(v) => setParam('por-terminar', v ? '1' : null)}
            className="lg:ml-auto"
          />
        </div>

        {treatments.status === 'loading' && (
          <ListSkeleton rows={6} label="Cargando tratamientos…" />
        )}
        {treatments.status === 'error' && (
          <ErrorState description={treatments.error.message} onRetry={treatments.retry} />
        )}
        {treatments.status === 'success' &&
          (rows.length > 0 ? (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(t) => t.id}
              caption="Tratamientos"
              renderMobileRow={(t) => (
                <Link
                  to={`/tratamientos/${t.id}`}
                  className="flex flex-col gap-2 px-4 py-3 hover:bg-surface-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{t.clientName}</p>
                      <p className="truncate text-caption text-fg-muted">
                        {t.serviceName}
                        {clinicWide && ` · ${t.professionalName}`}
                      </p>
                    </div>
                    <TreatmentStatusBadge status={t.status} />
                  </div>
                  <SessionProgress
                    completed={t.completedSessions}
                    planned={t.plannedSessions}
                    compact
                  />
                  {isEnding(t) && (
                    <p className="text-caption text-warning">
                      {remainingSessions(t) === 0
                        ? 'Sesiones completas: listo para finalizar'
                        : `Quedan ${remainingSessions(t)} ${remainingSessions(t) === 1 ? 'sesión' : 'sesiones'}`}
                    </p>
                  )}
                </Link>
              )}
            />
          ) : hasFilters ? (
            <NoResultsState onClear={clearFilters} />
          ) : (
            <EmptyState
              icon={<HeartPulse />}
              title="Todavía no hay tratamientos"
              description="Un tratamiento agrupa las sesiones de un plan (p. ej. 10 sesiones de fisioterapia lumbar) y muestra su avance."
              action={
                canManage && (
                  <Button asChild>
                    <Link to="/tratamientos/nuevo">Nuevo tratamiento</Link>
                  </Button>
                )
              }
            />
          ))}
      </Panel>
    </>
  );
}
