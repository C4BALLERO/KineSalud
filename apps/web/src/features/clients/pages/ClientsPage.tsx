import { CalendarPlus, Eye, MoreHorizontal, Pencil, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Can } from '@/components/access/Can';
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
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useRequiredSession } from '@/features/auth/session';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { formatCi, formatPhone, formatRelative } from '@/utils/format';
import {
  matchesAllTerms,
  useClientsList,
  useMyPatients,
  type ClientListItem,
  type ClientSort,
  type ClientStatusFilter,
} from '../api/clients';
import { ClientStatusBadge } from '../components/ClientStatusBadge';

const STATUS_OPTIONS: { value: ClientStatusFilter; label: string }[] = [
  { value: 'ACTIVO', label: 'Activos' },
  { value: 'INACTIVO', label: 'Inactivos' },
  { value: 'TODOS', label: 'Todos los estados' },
];

/**
 * Clientes. Administración y recepción: listado paginado del consultorio.
 * Profesional: "Mis pacientes" (solo los asignados, sin edición).
 */
export function ClientsPage() {
  const session = useRequiredSession();
  const clinicWide = usePermissionScope('clients.read') === 'all';
  const canWrite = usePermission('clients.write');
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  // Valores de la URL validados: un enlace editado a mano no rompe la consulta.
  const status = STATUS_OPTIONS.find((o) => o.value === params.get('estado'))?.value ?? 'ACTIVO';
  const sort: ClientSort = params.get('orden') === 'recientes' ? 'recientes' : 'apellido';

  // El texto se escribe localmente y se sincroniza con la URL con retardo.
  const [searchText, setSearchText] = useState(search);
  const debouncedSearch = useDebouncedValue(searchText, 300);
  useEffect(() => {
    if (debouncedSearch === search) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) next.set('q', debouncedSearch);
        else next.delete('q');
        next.delete('buscar');
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, search, setParams]);

  // Llegada desde la búsqueda móvil (?buscar=1) o nueva búsqueda global (?q=): foco y texto.
  const searchRef = useRef<HTMLInputElement>(null);
  const [lastExternalSearch, setLastExternalSearch] = useState(search);
  if (search !== lastExternalSearch && search !== debouncedSearch) {
    setLastExternalSearch(search);
    setSearchText(search);
  }
  useEffect(() => {
    if (params.get('buscar') === '1') searchRef.current?.focus();
  }, [params]);

  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const list = useClientsList({ search, status, sort }, clinicWide);
  const patients = useMyPatients(clinicWide ? null : session.professionalId);

  const view = useMemo(() => {
    if (clinicWide) {
      if (list.status === 'pending') return { state: 'loading' as const };
      if (list.status === 'error') return { state: 'error' as const, message: list.error.message };
      const rows = list.data.pages
        .flatMap((p) => p.items)
        .filter((c) => !search || matchesAllTerms(c, search));
      return { state: 'ready' as const, rows };
    }
    if (patients.status === 'loading') return { state: 'loading' as const };
    if (patients.status === 'error')
      return { state: 'error' as const, message: patients.error.message };
    const rows = patients.data
      .filter((c) => status === 'TODOS' || c.status === status)
      .filter((c) => !search || matchesAllTerms(c, search))
      .sort((a, b) =>
        sort === 'recientes'
          ? (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
          : a.lastNameLower.localeCompare(b.lastNameLower),
      );
    return { state: 'ready' as const, rows };
  }, [clinicWide, list, patients, search, status, sort]);

  const hasFilters = search !== '' || status !== 'ACTIVO';
  const canLoadMore = clinicWide && list.hasNextPage;
  const clearFilters = () => {
    setSearchText('');
    setParams(new URLSearchParams(), { replace: true });
  };
  const retry = () => (clinicWide ? void list.refetch() : patients.retry());

  const actions = (c: ClientListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Acciones para ${c.fullName}`}
          className="w-11 px-0 md:w-8"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asLink={`/clientes/${c.id}`} icon={<Eye aria-hidden="true" />}>
          Ver perfil
        </DropdownMenuItem>
        {canWrite && (
          <DropdownMenuItem
            asLink={`/clientes/${c.id}/editar`}
            icon={<Pencil aria-hidden="true" />}
          >
            Editar datos
          </DropdownMenuItem>
        )}
        {canWrite && c.status === 'ACTIVO' && (
          <DropdownMenuItem
            asLink={`/agenda/nueva?cliente=${c.id}`}
            icon={<CalendarPlus aria-hidden="true" />}
          >
            Agendar cita
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const identity = (c: ClientListItem) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        name={c.fullName}
        size="sm"
        className={c.status === 'ACTIVO' ? undefined : 'opacity-60'}
      />
      <div className="flex min-w-0 flex-col">
        <Link
          to={`/clientes/${c.id}`}
          className="truncate rounded-sm font-medium text-fg underline-offset-2 hover:text-primary hover:underline"
        >
          {c.fullName}
        </Link>
        {c.email && <span className="truncate text-caption text-fg-subtle">{c.email}</span>}
      </div>
    </div>
  );

  const columns: Column<ClientListItem>[] = [
    { id: 'cliente', header: 'Cliente', cell: identity },
    {
      id: 'ci',
      header: 'Carnet',
      cell: (c) => <span className="tabular">{formatCi(c.ci, c.ciExt)}</span>,
      className: 'w-36',
    },
    {
      id: 'telefono',
      header: 'Teléfono',
      cell: (c) => <span className="tabular">{formatPhone(c.phone)}</span>,
      className: 'w-32',
    },
    {
      id: 'tratamientos',
      header: 'Tratamientos',
      cell: (c) =>
        c.activeTreatments > 0 ? (
          `${c.activeTreatments} activo${c.activeTreatments > 1 ? 's' : ''}`
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
      className: 'w-32',
      hideBelowLg: true,
    },
    {
      id: 'registro',
      header: 'Registrado',
      cell: (c) => (c.createdAt ? formatRelative(c.createdAt) : '—'),
      className: 'w-36 text-fg-muted',
      hideBelowLg: true,
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: (c) => <ClientStatusBadge status={c.status} />,
      className: 'w-28',
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: actions,
      className: 'w-20 text-right [&>*]:ml-auto',
    },
  ];

  return (
    <>
      <PageHeader
        title={clinicWide ? 'Clientes' : 'Mis pacientes'}
        description={
          clinicWide
            ? 'Registro y búsqueda de los clientes del consultorio.'
            : 'Clientes a los que atiendes o atendiste.'
        }
        actions={
          <Can permission="clients.write">
            <Button asChild>
              <Link to="/clientes/nuevo">
                <UserPlus aria-hidden="true" />
                Registrar cliente
              </Link>
            </Button>
          </Can>
        }
      />

      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:px-5">
          <SearchInput
            ref={searchRef}
            label="Buscar clientes"
            placeholder="Nombre, apellido, carnet o teléfono"
            value={searchText}
            onChange={setSearchText}
            className="md:max-w-sm md:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) => setParam('estado', e.target.value, 'ACTIVO')}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Ordenar"
              value={sort}
              onChange={(e) => setParam('orden', e.target.value, 'apellido')}
            >
              <option value="apellido">Apellido (A–Z)</option>
              <option value="recientes">Registro más reciente</option>
            </Select>
          </div>
          {view.state === 'ready' && (
            <p aria-live="polite" className="text-body-sm text-fg-muted md:ml-auto">
              {view.rows.length} {view.rows.length === 1 ? 'cliente' : 'clientes'}
              {canLoadMore ? ' (hay más)' : ''}
            </p>
          )}
        </div>

        {view.state === 'loading' && <ListSkeleton rows={6} label="Cargando clientes…" />}
        {view.state === 'error' && <ErrorState description={view.message} onRetry={retry} />}
        {view.state === 'ready' &&
          (view.rows.length === 0 && !canLoadMore ? (
            hasFilters ? (
              <NoResultsState query={search || undefined} onClear={clearFilters} />
            ) : (
              <EmptyState
                icon={<Users />}
                title={clinicWide ? 'Aún no hay clientes' : 'Aún no tienes pacientes asignados'}
                description={
                  clinicWide
                    ? 'Registra el primer cliente para agendar citas y dar seguimiento a sus tratamientos.'
                    : 'Aparecerán aquí cuando se te asigne una cita o un tratamiento.'
                }
                action={
                  canWrite && (
                    <Button asChild>
                      <Link to="/clientes/nuevo">
                        <UserPlus aria-hidden="true" />
                        Registrar cliente
                      </Link>
                    </Button>
                  )
                }
              />
            )
          ) : (
            <>
              {view.rows.length === 0 ? (
                <p className="p-6 text-center text-body-sm text-fg-muted">
                  Ningún cliente de esta página coincide con todos los términos. Carga más
                  resultados para seguir buscando.
                </p>
              ) : (
                <DataTable
                  caption={clinicWide ? 'Clientes del consultorio' : 'Mis pacientes'}
                  rows={view.rows}
                  columns={columns}
                  getRowKey={(c) => c.id}
                  renderMobileRow={(c) => (
                    <div className="flex items-start gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        {identity(c)}
                        <p className="tabular pl-11 text-caption text-fg-muted">
                          CI {formatCi(c.ci, c.ciExt)} · {formatPhone(c.phone)}
                        </p>
                        {c.status !== 'ACTIVO' && (
                          <div className="pl-11">
                            <ClientStatusBadge status={c.status} />
                          </div>
                        )}
                      </div>
                      {actions(c)}
                    </div>
                  )}
                />
              )}
              {canLoadMore && (
                <div className="flex justify-center border-t border-border p-4">
                  <Button
                    variant="secondary"
                    loading={list.isFetchingNextPage}
                    onClick={() => void list.fetchNextPage()}
                  >
                    Cargar más clientes
                  </Button>
                </div>
              )}
            </>
          ))}
      </Panel>
    </>
  );
}
