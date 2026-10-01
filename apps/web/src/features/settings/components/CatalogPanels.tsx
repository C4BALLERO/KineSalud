import { ROOM_KIND_LABELS } from '@kinesalud/shared';
import {
  CircleCheck,
  CircleSlash,
  DoorOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { cn } from '@/utils/cn';
import { useRooms, useSetRoomActive, type RoomItem } from '../api/catalog';
import { RoomDialog } from './RoomDialog';

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" icon={<CircleCheck aria-hidden="true" />}>
      Activo
    </Badge>
  ) : (
    <Badge icon={<CircleSlash aria-hidden="true" />}>Inactivo</Badge>
  );
}

function RowActions({
  label,
  active,
  onEdit,
  onToggle,
}: {
  label: string;
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Acciones para ${label}`}
          className="w-11 shrink-0 px-0 md:w-8"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem icon={<Pencil aria-hidden="true" />} onSelect={onEdit}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          destructive={active}
          icon={active ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
          onSelect={onToggle}
        >
          {active ? 'Desactivar' : 'Activar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Estado de activación con confirmación solo al desactivar. */
function useActiveToggle<T extends { id: string; name: string; active: boolean }>(
  mutate: (input: { id: string; active: boolean }) => Promise<unknown>,
  noun: string,
) {
  const toast = useToast();
  const [pending, setPending] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async (item: T) => {
    setBusy(true);
    try {
      await mutate({ id: item.id, active: !item.active });
      toast.success(`${item.name}: ${item.active ? 'desactivado' : 'activado'}`);
    } catch (err) {
      toast.error(`No se pudo cambiar el ${noun}`, toAppError(err).message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return {
    pending,
    busy,
    request: (item: T) => (item.active ? setPending(item) : void apply(item)),
    confirm: () => pending && void apply(pending),
    cancel: () => setPending(null),
  };
}

function ListItem({
  title,
  meta,
  badges,
  actions,
  muted,
}: {
  title: string;
  meta: ReactNode;
  badges: ReactNode;
  actions: ReactNode;
  muted?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 md:px-5">
      <div className={cn('flex min-w-0 flex-1 flex-col gap-1', muted && 'opacity-70')}>
        <span className="font-medium text-fg">{title}</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-muted">
          {meta}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{badges}</div>
      {actions}
    </li>
  );
}

function EmptyCatalog({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return <EmptyState icon={<Icon />} title={title} description={description} action={action} />;
}

/* ---------- Espacios ---------- */

export function RoomsPanel() {
  const rooms = useRooms();
  const setActive = useSetRoomActive();
  const [editing, setEditing] = useState<RoomItem | 'new' | null>(null);
  const toggle = useActiveToggle<RoomItem>(setActive.mutateAsync, 'estado del espacio');

  const newButton = (
    <Button size="sm" onClick={() => setEditing('new')}>
      <Plus aria-hidden="true" />
      Nuevo espacio
    </Button>
  );

  return (
    <Panel
      flush
      title="Espacios"
      description="Camillas, cabinas y áreas donde se atiende. Cada uno recibe un cliente a la vez."
      actions={newButton}
    >
      {rooms.status === 'loading' && <ListSkeleton rows={4} label="Cargando espacios…" />}
      {rooms.status === 'error' && (
        <ErrorState description={rooms.error.message} onRetry={rooms.retry} />
      )}
      {rooms.status === 'success' &&
        (rooms.data.length === 0 ? (
          <EmptyCatalog
            icon={DoorOpen}
            title="Aún no hay espacios"
            description="Registra las camillas, cabinas y el gimnasio para que la agenda asigne dónde se atiende cada cita."
            action={newButton}
          />
        ) : (
          <ul className="divide-y divide-border">
            {[...rooms.data]
              .sort((a, b) => Number(b.active) - Number(a.active))
              .map((r) => (
                <ListItem
                  key={r.id}
                  title={r.name}
                  muted={!r.active}
                  meta={
                    <>
                      <span>{ROOM_KIND_LABELS[r.kind]}</span>
                      {r.allowedCategories.map((c) => (
                        <CategoryTag key={c} category={c} />
                      ))}
                    </>
                  }
                  badges={<ActiveBadge active={r.active} />}
                  actions={
                    <RowActions
                      label={r.name}
                      active={r.active}
                      onEdit={() => setEditing(r)}
                      onToggle={() => toggle.request(r)}
                    />
                  }
                />
              ))}
          </ul>
        ))}

      {editing && (
        <RoomDialog
          key={editing === 'new' ? 'new' : editing.id}
          room={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={toggle.pending !== null}
        onOpenChange={(o) => !o && toggle.cancel()}
        title="¿Desactivar este espacio?"
        description={`${toggle.pending?.name ?? ''} dejará de asignarse a citas nuevas. Las citas ya agendadas no cambian.`}
        confirmLabel="Desactivar espacio"
        destructive
        loading={toggle.busy}
        onConfirm={toggle.confirm}
      />
    </Panel>
  );
}
