import { ROLE_LABELS } from '@kinesalud/shared';
import { Link2, Link2Off, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/feedback/States';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useUsers } from '@/features/users/api/users';
import { toAppError } from '@/lib/errors';
import { useLinkAccount } from '../api/staff';

interface AccountPanelProps {
  professionalId: string;
  professionalName: string;
  userId: string | null;
}

/**
 * Cuenta de acceso vinculada a la ficha (solo administración). Con la cuenta
 * vinculada, la persona ve "Mi día", su agenda y sus pacientes.
 */
export function AccountPanel({ professionalId, professionalName, userId }: AccountPanelProps) {
  const toast = useToast();
  const users = useUsers();
  const linkAccount = useLinkAccount();
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const linked = users.status === 'success' ? users.data.find((u) => u.uid === userId) : undefined;
  // Candidatas: cuentas activas de profesionales o administradores sin otra ficha vinculada.
  const candidates =
    users.status === 'success'
      ? users.data.filter(
          (u) =>
            u.active &&
            u.role !== 'RECEPCIONISTA' &&
            (!u.professionalId || u.professionalId === professionalId) &&
            u.uid !== userId,
        )
      : [];

  const submit = async (uid: string | null) => {
    setError(null);
    try {
      await linkAccount.mutateAsync({ professionalId, uid });
      toast.success(
        uid ? 'Cuenta vinculada' : 'Cuenta desvinculada',
        uid
          ? 'La persona verá su agenda y sus pacientes la próxima vez que use el sistema.'
          : `La cuenta ya no tiene acceso a la agenda de ${professionalName}.`,
      );
      setChoosing(false);
      setConfirmUnlink(false);
    } catch (err) {
      setError(toAppError(err).message);
      setConfirmUnlink(false);
    }
  };

  return (
    <Panel title="Cuenta de acceso">
      {users.status === 'loading' ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : users.status === 'error' ? (
        <ErrorState size="compact" description={users.error.message} onRetry={users.retry} />
      ) : (
        <div className="flex flex-col gap-4">
          {error && !choosing && <InlineAlert tone="danger" title={error} />}
          {userId && linked ? (
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info-subtle text-info">
                <UserRound aria-hidden="true" className="size-4.5" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-fg">{linked.displayName}</span>
                <span className="truncate text-body-sm text-fg-muted">{linked.email}</span>
                <span className="text-caption text-fg-subtle">
                  {ROLE_LABELS[linked.role]}
                  {!linked.active && ' · cuenta desactivada'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-body-sm text-fg-muted">
              Sin cuenta vinculada. El profesional puede recibir citas, pero no ingresa al sistema.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelected('');
                setError(null);
                setChoosing(true);
              }}
            >
              <Link2 aria-hidden="true" />
              {userId ? 'Cambiar cuenta' : 'Vincular cuenta'}
            </Button>
            {userId && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmUnlink(true)}>
                <Link2Off aria-hidden="true" />
                Desvincular
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={choosing}
        onOpenChange={(o) => !linkAccount.isPending && setChoosing(o)}
        title="Vincular cuenta de acceso"
        description={`Elige la cuenta con la que ${professionalName} ingresa al sistema.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setChoosing(false)}
              disabled={linkAccount.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void submit(selected)}
              disabled={!selected}
              loading={linkAccount.isPending}
            >
              Vincular cuenta
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          {error && <InlineAlert tone="danger" title={error} />}
          {candidates.length === 0 ? (
            <InlineAlert tone="info" title="No hay cuentas disponibles.">
              Crea una cuenta con rol Profesional en{' '}
              <Link
                to="/usuarios"
                className="font-medium text-primary underline underline-offset-2"
              >
                Usuarios
              </Link>{' '}
              y vuelve a esta ficha.
            </InlineAlert>
          ) : (
            <FormField
              label="Cuenta"
              required
              hint="Solo aparecen cuentas activas de profesionales o administradores sin otra ficha."
            >
              {(p) => (
                <Select {...p} value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="" disabled>
                    Selecciona una cuenta
                  </option>
                  {candidates.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} · {u.email} ({ROLE_LABELS[u.role]})
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="¿Desvincular la cuenta?"
        description={`La cuenta seguirá activa, pero dejará de ver la agenda y los pacientes de ${professionalName}.`}
        confirmLabel="Desvincular"
        destructive
        loading={linkAccount.isPending}
        onConfirm={() => void submit(null)}
      />
    </Panel>
  );
}
