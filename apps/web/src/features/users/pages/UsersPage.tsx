import { ROLE_LABELS, ROLES, type Role } from '@kinesalud/shared';
import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, NoResultsState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
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
import { useRequiredSession } from '@/features/auth/session';
import { toAppError } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/utils/format';
import { useSendAccessLink, useSetUserActive, useUsers, type UserListItem } from '../api/users';
import { RoleBadge, UserStatusBadge } from '../components/UserBadges';
import { UserFormDialog } from '../components/UserFormDialog';

type StatusFilter = 'todos' | 'activos' | 'inactivos';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function LastAccess({ date }: { date: Date | null }) {
  if (!date) return <span className="text-fg-subtle">Nunca ingresó</span>;
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatRelative(date)}
    </time>
  );
}

export function UsersPage() {
  const session = useRequiredSession();
  const toast = useToast();
  const users = useUsers();
  const setActive = useSetUserActive();
  const sendLink = useSendAccessLink();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | 'todos'>('todos');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [toggling, setToggling] = useState<UserListItem | null>(null);

  const filtered = useMemo(() => {
    if (users.status !== 'success') return [];
    const q = normalize(search.trim());
    return users.data.filter(
      (u) =>
        (!q || normalize(`${u.displayName} ${u.email}`).includes(q)) &&
        (role === 'todos' || u.role === role) &&
        (status === 'todos' || (status === 'activos' ? u.active : !u.active)),
    );
  }, [users, search, role, status]);

  const hasFilters = search !== '' || role !== 'todos' || status !== 'todos';
  const clearFilters = () => {
    setSearch('');
    setRole('todos');
    setStatus('todos');
  };

  const openForm = (user: UserListItem | null) => {
    setEditing(user);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };
  const openCreate = () => openForm(null);
  const openEdit = (u: UserListItem) => openForm(u);

  const sendAccessLink = async (u: UserListItem) => {
    try {
      await sendLink.mutateAsync(u.email);
      toast.success(
        'Enlace enviado',
        `${u.email} recibirá un correo para crear o restablecer su contraseña.`,
      );
    } catch (err) {
      toast.error('No se pudo enviar el enlace', toAppError(err).message);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    try {
      await setActive.mutateAsync({ uid: toggling.uid, active: !toggling.active });
      toast.success(
        toggling.active ? 'Cuenta desactivada' : 'Cuenta reactivada',
        toggling.active
          ? `${toggling.displayName} ya no puede ingresar al sistema.`
          : `${toggling.displayName} puede volver a ingresar.`,
      );
      setToggling(null);
    } catch (err) {
      setToggling(null);
      toast.error('No se pudo completar el cambio', toAppError(err).message);
    }
  };

  const actions = (u: UserListItem) => {
    const isSelf = u.uid === session.uid;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Acciones para ${u.displayName}`}
            className="w-11 px-0 md:w-8"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => openEdit(u)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<KeyRound aria-hidden="true" />}
            onSelect={() => void sendAccessLink(u)}
            disabled={!u.active}
          >
            Enviar enlace de acceso
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              {u.active ? (
                <DropdownMenuItem
                  icon={<UserX aria-hidden="true" />}
                  destructive
                  onSelect={() => setToggling(u)}
                >
                  Desactivar cuenta
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  icon={<UserCheck aria-hidden="true" />}
                  onSelect={() => setToggling(u)}
                >
                  Reactivar cuenta
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const identity = (u: UserListItem) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={u.displayName} size="sm" className={u.active ? undefined : 'opacity-60'} />
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 truncate font-medium text-fg">
          {u.displayName}
          {u.uid === session.uid && <Badge tone="primary">Tú</Badge>}
        </span>
        <span className="truncate text-caption text-fg-subtle">{u.email}</span>
      </div>
    </div>
  );

  const columns: Column<UserListItem>[] = [
    { id: 'usuario', header: 'Usuario', cell: identity },
    { id: 'rol', header: 'Rol', cell: (u) => <RoleBadge role={u.role} />, className: 'w-44' },
    {
      id: 'estado',
      header: 'Estado',
      cell: (u) => <UserStatusBadge active={u.active} />,
      className: 'w-36',
    },
    {
      id: 'acceso',
      header: 'Último acceso',
      cell: (u) => <LastAccess date={u.lastLoginAt} />,
      className: 'w-40 text-fg-muted',
      hideBelowLg: true,
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
        title="Usuarios"
        description="Cuentas de acceso al sistema y el rol de cada persona."
        actions={
          <Button icon={<UserPlus aria-hidden="true" />} onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:px-5">
          <SearchInput
            label="Buscar usuarios"
            placeholder="Buscar por nombre o correo"
            value={search}
            onChange={setSearch}
            className="md:max-w-xs md:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select
              aria-label="Filtrar por rol"
              value={role}
              onChange={(e) => setRole(e.target.value as Role | 'todos')}
            >
              <option value="todos">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Desactivados</option>
            </Select>
          </div>
          {users.status === 'success' && (
            <p aria-live="polite" className="text-body-sm text-fg-muted md:ml-auto">
              {filtered.length === users.data.length
                ? `${users.data.length} ${users.data.length === 1 ? 'usuario' : 'usuarios'}`
                : `${filtered.length} de ${users.data.length}`}
            </p>
          )}
        </div>

        {users.status === 'loading' && <ListSkeleton rows={4} label="Cargando usuarios…" />}
        {users.status === 'error' && (
          <ErrorState description={users.error.message} onRetry={users.retry} />
        )}
        {users.status === 'success' &&
          (users.data.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Aún no hay usuarios"
              description="Crea las cuentas del equipo para que cada persona ingrese con su rol."
              action={
                <Button icon={<UserPlus aria-hidden="true" />} onClick={openCreate}>
                  Nuevo usuario
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <NoResultsState
              query={search || undefined}
              onClear={hasFilters ? clearFilters : undefined}
            />
          ) : (
            <DataTable
              caption="Usuarios del sistema"
              rows={filtered}
              columns={columns}
              getRowKey={(u) => u.uid}
              renderMobileRow={(u) => (
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {identity(u)}
                    <div className="flex flex-wrap items-center gap-2 pl-11">
                      <RoleBadge role={u.role} />
                      <UserStatusBadge active={u.active} />
                    </div>
                  </div>
                  {actions(u)}
                </div>
              )}
            />
          ))}
      </Panel>

      <UserFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        currentUid={session.uid}
      />

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        destructive={toggling?.active}
        loading={setActive.isPending}
        title={toggling?.active ? '¿Desactivar esta cuenta?' : '¿Reactivar esta cuenta?'}
        description={
          toggling?.active
            ? `${toggling.displayName} perderá el acceso de inmediato y se cerrarán sus sesiones abiertas. Sus datos y su historial se conservan; puedes reactivarla en cualquier momento.`
            : `${toggling?.displayName ?? ''} podrá volver a ingresar con su contraseña actual.`
        }
        confirmLabel={toggling?.active ? 'Desactivar cuenta' : 'Reactivar cuenta'}
        onConfirm={() => void confirmToggle()}
      />
    </>
  );
}
