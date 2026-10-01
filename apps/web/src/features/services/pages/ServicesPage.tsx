import {
  compatibleRooms,
  normalizeSearchText,
  ROOM_KIND_LABELS,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type TreatmentCategory,
} from '@kinesalud/shared';
import {
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Tags,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { EmptyState, ErrorState, NoResultsState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import {
  useDeleteService,
  useRooms,
  useServices,
  useSetServiceActive,
  type ServiceItem,
} from '@/features/settings/api/catalog';
import { ServiceDialog } from '@/features/settings/components/ServiceDialog';
import { useProfessionals } from '@/features/staff/api/staff';
import { usePermission } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import { formatMoney } from '@/utils/format';
import { ServiceProfessionalsDialog } from '../components/ServiceProfessionalsDialog';

type StatusFilter = 'activos' | 'inactivos' | 'todos';

type Dialog =
  | { kind: 'edit'; service: ServiceItem | null; template?: ServiceItem }
  | { kind: 'professionals'; service: ServiceItem }
  | { kind: 'deactivate'; service: ServiceItem }
  | { kind: 'delete'; service: ServiceItem }
  | null;

/**
 * Catálogo de servicios: precio, duración, preparación, espacios y quién los
 * realiza. La administración crea, edita, duplica, activa o desactiva,
 * asigna profesionales y elimina los que nunca se usaron; el resto del
 * personal lo consulta.
 */
export function ServicesPage() {
  const canManage = usePermission('settings.manage');
  const toast = useToast();
  const services = useServices();
  const rooms = useRooms();
  const professionals = useProfessionals();
  const setActive = useSetServiceActive();
  const remove = useDeleteService();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const status: StatusFilter =
    params.get('estado') === 'inactivos'
      ? 'inactivos'
      : params.get('estado') === 'todos'
        ? 'todos'
        : 'activos';
  const category =
    TREATMENT_CATEGORIES.find((c) => c === params.get('area')) ??
    (null as TreatmentCategory | null);
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

  const proList = professionals.status === 'success' ? professionals.data : [];
  const roomList = rooms.status === 'success' ? rooms.data : null;
  const offeredBy = (s: ServiceItem) => proList.filter((p) => p.serviceIds.includes(s.id));

  const rows = useMemo(() => {
    if (services.status !== 'success') return [];
    const terms = normalizeSearchText(search).split(/\s+/).filter(Boolean);
    return services.data
      .filter((s) => (status === 'activos' ? s.active : status === 'inactivos' ? !s.active : true))
      .filter((s) => !category || s.category === category)
      .filter((s) => terms.every((t) => normalizeSearchText(s.name).includes(t)))
      .sort(
        (a, b) =>
          TREATMENT_CATEGORIES.indexOf(a.category) - TREATMENT_CATEGORIES.indexOf(b.category) ||
          a.name.localeCompare(b.name),
      );
  }, [services, search, status, category]);

  const toggle = async (s: ServiceItem, active: boolean) => {
    try {
      await setActive.mutateAsync({ id: s.id, active });
      toast.success(active ? 'Servicio activado' : 'Servicio desactivado', s.name);
      setDialog(null);
    } catch (err) {
      toast.error('No se pudo cambiar el estado', toAppError(err).message);
    }
  };

  const destroy = async (s: ServiceItem) => {
    try {
      await remove.mutateAsync({ id: s.id });
      toast.success('Servicio eliminado', s.name);
      setDialog(null);
    } catch (err) {
      toast.error('No se pudo eliminar', toAppError(err).message);
      setDialog(null);
    }
  };

  const warnings = (s: ServiceItem) => (
    <>
      {s.priceCents == null && s.active && (
        <Badge tone="warning" icon={<TriangleAlert aria-hidden="true" />}>
          Sin precio
        </Badge>
      )}
      {s.active && roomList !== null && compatibleRooms(s, roomList).length === 0 && (
        <Badge tone="warning" icon={<TriangleAlert aria-hidden="true" />}>
          Sin espacio compatible
        </Badge>
      )}
      {s.active && professionals.status === 'success' && offeredBy(s).length === 0 && (
        <Badge tone="warning" icon={<TriangleAlert aria-hidden="true" />}>
          Nadie lo realiza
        </Badge>
      )}
      {!s.active && <Badge tone="neutral">Inactivo</Badge>}
    </>
  );

  const actions = (s: ServiceItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Acciones para ${s.name}`}
          className="w-11 px-0 md:w-8"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          icon={<Pencil aria-hidden="true" />}
          onSelect={() => setDialog({ kind: 'edit', service: s })}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<Users aria-hidden="true" />}
          onSelect={() => setDialog({ kind: 'professionals', service: s })}
          disabled={professionals.status !== 'success'}
        >
          Profesionales
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<Copy aria-hidden="true" />}
          onSelect={() => setDialog({ kind: 'edit', service: null, template: s })}
        >
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {s.active ? (
          <DropdownMenuItem
            icon={<PowerOff aria-hidden="true" />}
            onSelect={() => setDialog({ kind: 'deactivate', service: s })}
          >
            Desactivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            icon={<Power aria-hidden="true" />}
            onSelect={() => void toggle(s, true)}
          >
            Activar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          destructive
          icon={<Trash2 aria-hidden="true" />}
          onSelect={() => setDialog({ kind: 'delete', service: s })}
        >
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const professionalNames = (s: ServiceItem) => {
    const list = offeredBy(s);
    if (professionals.status !== 'success') return '…';
    if (list.length === 0) return <span className="text-fg-subtle">Nadie</span>;
    return list.map((p) => p.displayName).join(', ');
  };

  const columns: Column<ServiceItem>[] = [
    {
      id: 'servicio',
      header: 'Servicio',
      cell: (s) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className={s.active ? 'font-medium text-fg' : 'font-medium text-fg-muted'}>
            {s.name}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <CategoryTag category={s.category} />
            {warnings(s)}
          </span>
        </div>
      ),
    },
    {
      id: 'precio',
      header: 'Precio',
      cell: (s) => (s.priceCents != null ? formatMoney(s.priceCents) : '—'),
      className: 'w-28 text-right tabular',
    },
    {
      id: 'duracion',
      header: 'Duración',
      cell: (s) => (
        <span className="tabular">
          {s.durationMin} min
          {s.bufferMin > 0 && <span className="text-fg-muted"> + {s.bufferMin}</span>}
        </span>
      ),
      className: 'w-32',
    },
    {
      id: 'sesiones',
      header: 'Sesiones',
      cell: (s) => s.defaultSessions,
      className: 'w-24 text-right tabular',
      hideBelowLg: true,
    },
    {
      id: 'espacio',
      header: 'Espacio',
      cell: (s) => s.roomKinds.map((k) => ROOM_KIND_LABELS[k]).join(' o '),
      className: 'w-44 text-fg-muted',
      hideBelowLg: true,
    },
    {
      id: 'profesionales',
      header: 'Lo realizan',
      cell: professionalNames,
      className: 'w-56 text-body-sm',
    },
    ...(canManage
      ? [
          {
            id: 'acciones',
            header: 'Acciones',
            cell: actions,
            className: 'w-20 text-right [&>*]:ml-auto',
          },
        ]
      : []),
  ];

  const newButton = canManage && (
    <Button onClick={() => setDialog({ kind: 'edit', service: null })}>
      <Plus aria-hidden="true" />
      Nuevo servicio
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Servicios"
        description={
          canManage
            ? 'Catálogo de fisioterapia, rehabilitación y estética: precios, duración y quién los realiza.'
            : 'Catálogo de servicios del consultorio con sus precios y duración.'
        }
        actions={newButton}
      />

      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:px-5">
          <SearchInput
            label="Buscar servicios"
            placeholder="Nombre del servicio"
            value={search}
            onChange={setSearch}
            className="md:max-w-xs md:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 sm:flex">
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
            <Select
              aria-label="Estado"
              value={status}
              onChange={(e) =>
                setParam('estado', e.target.value === 'activos' ? null : e.target.value)
              }
              className="sm:w-40"
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </Select>
          </div>
        </div>

        {services.status === 'loading' && <ListSkeleton rows={6} label="Cargando servicios…" />}
        {services.status === 'error' && (
          <ErrorState description={services.error.message} onRetry={services.retry} />
        )}
        {services.status === 'success' &&
          (services.data.length === 0 ? (
            <EmptyState
              icon={<Tags />}
              title="Aún no hay servicios"
              description="Registra los servicios que ofrece el consultorio para asignarlos al personal, agendarlos y cobrarlos."
              action={newButton}
            />
          ) : rows.length === 0 ? (
            <NoResultsState
              onClear={() => {
                setSearch('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(s) => s.id}
              caption="Servicios del consultorio"
              renderMobileRow={(s) => (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium text-fg">{s.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <CategoryTag category={s.category} />
                      {warnings(s)}
                    </span>
                    <span className="tabular text-caption text-fg-muted">
                      {s.priceCents != null ? formatMoney(s.priceCents) : 'Sin precio'} ·{' '}
                      {s.durationMin} min · {s.defaultSessions} sesiones
                    </span>
                    <span className="text-caption text-fg-muted">
                      Lo realizan: {professionalNames(s)}
                    </span>
                  </div>
                  {canManage && actions(s)}
                </div>
              )}
            />
          ))}
      </Panel>

      {dialog?.kind === 'edit' && (
        <ServiceDialog
          key={dialog.service?.id ?? `nuevo-${dialog.template?.id ?? ''}`}
          service={dialog.service}
          template={dialog.template}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'professionals' && (
        <ServiceProfessionalsDialog
          service={dialog.service}
          professionals={proList}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === 'deactivate'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="¿Desactivar este servicio?"
        description={`${dialog?.kind === 'deactivate' ? dialog.service.name : ''} dejará de ofrecerse al agendar y al abrir tratamientos. Las citas y tratamientos existentes no cambian.`}
        confirmLabel="Desactivar"
        destructive
        loading={setActive.isPending}
        onConfirm={() => dialog?.kind === 'deactivate' && void toggle(dialog.service, false)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="¿Eliminar este servicio?"
        description={`${dialog?.kind === 'delete' ? dialog.service.name : ''} se borrará del catálogo. Solo se puede eliminar si nunca se usó en citas ni tratamientos; si ya tiene historial, desactívalo.`}
        confirmLabel="Eliminar"
        destructive
        loading={remove.isPending}
        onConfirm={() => dialog?.kind === 'delete' && void destroy(dialog.service)}
      />
    </>
  );
}
