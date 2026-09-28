import { EXCEPTION_TYPE_LABELS, exceptionCovers, exceptionDays } from '@kinesalud/shared';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { formatDateRange } from '@/utils/format';
import { useExceptions, useRemoveException, type ExceptionItem } from '../api/staff';
import { ExceptionDialog } from './ExceptionDialog';

interface ExceptionsPanelProps {
  professionalId: string;
  professionalName: string;
  today: string;
  canEdit: boolean;
}

/** Ausencias actuales y próximas (vacaciones, permisos y bloqueos de agenda). */
export function ExceptionsPanel({
  professionalId,
  professionalName,
  today,
  canEdit,
}: ExceptionsPanelProps) {
  const toast = useToast();
  const exceptions = useExceptions(professionalId, today);
  const removeException = useRemoveException();
  const [dialogKey, setDialogKey] = useState<number | null>(null);
  const [toRemove, setToRemove] = useState<ExceptionItem | null>(null);

  const openDialog = () => setDialogKey(Date.now());

  const remove = async () => {
    if (!toRemove) return;
    try {
      await removeException.mutateAsync({ exceptionId: toRemove.id });
      toast.success('Ausencia eliminada', 'Esos días vuelven a estar disponibles en la agenda.');
    } catch (err) {
      toast.error('No se pudo eliminar la ausencia', toAppError(err).message);
    } finally {
      setToRemove(null);
    }
  };

  return (
    <Panel
      flush
      title="Ausencias"
      description="Vacaciones, permisos y días con la agenda bloqueada."
      actions={
        canEdit && (
          <Button variant="secondary" size="sm" onClick={openDialog}>
            <Plus aria-hidden="true" />
            Registrar ausencia
          </Button>
        )
      }
    >
      {exceptions.status === 'loading' && <ListSkeleton rows={2} label="Cargando ausencias…" />}
      {exceptions.status === 'error' && (
        <ErrorState
          size="compact"
          description={exceptions.error.message}
          onRetry={exceptions.retry}
        />
      )}
      {exceptions.status === 'success' &&
        (exceptions.data.length === 0 ? (
          <EmptyState
            size="compact"
            icon={<CalendarOff />}
            title="Sin ausencias programadas"
            description="Registra vacaciones o permisos para que la agenda no ofrezca esos días."
          />
        ) : (
          <ul className="divide-y divide-border">
            {[...exceptions.data]
              .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
              .map((e) => {
                const days = exceptionDays(e);
                const current = exceptionCovers(e, today);
                return (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-fg">{EXCEPTION_TYPE_LABELS[e.type]}</span>
                        {current && <Badge tone="warning">En curso</Badge>}
                      </div>
                      <p className="text-body-sm text-fg-muted">
                        {formatDateRange(e.dateFrom, e.dateTo)} · {days}{' '}
                        {days === 1 ? 'día' : 'días'}
                      </p>
                      {e.note && <p className="text-caption text-fg-subtle">{e.note}</p>}
                    </div>
                    {canEdit && (
                      <IconButton
                        label={`Eliminar ausencia del ${formatDateRange(e.dateFrom, e.dateTo)}`}
                        icon={<Trash2 />}
                        onClick={() => setToRemove(e)}
                      />
                    )}
                  </li>
                );
              })}
          </ul>
        ))}

      {dialogKey !== null && (
        <ExceptionDialog
          key={dialogKey}
          open
          onOpenChange={(open) => !open && setDialogKey(null)}
          professionalId={professionalId}
          professionalName={professionalName}
        />
      )}

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="¿Eliminar esta ausencia?"
        description={
          toRemove
            ? `${EXCEPTION_TYPE_LABELS[toRemove.type]} del ${formatDateRange(toRemove.dateFrom, toRemove.dateTo)}. Esos días ${professionalName} volverá a estar disponible en la agenda.`
            : ''
        }
        confirmLabel="Eliminar ausencia"
        destructive
        loading={removeException.isPending}
        onConfirm={() => void remove()}
      />
    </Panel>
  );
}
