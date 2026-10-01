import type { ClinicalRecordView } from '@kinesalud/shared';
import { ClipboardList, Pencil, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Textarea } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { formatDateTime } from '@/utils/format';
import { useClientClinical, useSaveClinicalRecord } from '../api/clinical';
import { SessionNoteCard } from './SessionNoteCard';

/** Aviso permanente: lo que se ve aquí queda registrado. */
export function ClinicalAccessNote() {
  return (
    <p className="flex items-center gap-1.5 text-caption text-fg-subtle">
      <ShieldCheck aria-hidden="true" className="size-3.5" />
      Información clínica confidencial: cada acceso queda registrado en la auditoría.
    </p>
  );
}

/**
 * Historia clínica del paciente: alertas, antecedentes y todas sus notas de
 * sesión. Solo la administración y los profesionales asignados llegan aquí.
 */
export function ClinicalRecordPanel({
  clientId,
  clientName,
  currentUid,
  isAdmin,
}: {
  clientId: string;
  clientName: string;
  currentUid: string;
  isAdmin: boolean;
}) {
  const clinical = useClientClinical(clientId, true);
  const [editing, setEditing] = useState(false);

  if (clinical.isPending) return <ListSkeleton rows={4} label="Cargando la historia clínica…" />;
  if (clinical.isError) {
    return (
      <ErrorState
        description={toAppError(clinical.error).message}
        onRetry={() => void clinical.refetch()}
      />
    );
  }
  const { record, notes } = clinical.data;

  return (
    <div className="flex flex-col gap-6">
      <ClinicalAccessNote />
      {record?.alerts && (
        <InlineAlert tone="warning" title="Alertas clínicas">
          <span className="whitespace-pre-line">{record.alerts}</span>
        </InlineAlert>
      )}

      <Panel
        title="Antecedentes"
        description={
          record?.updatedAt
            ? `Actualizado el ${formatDateTime(new Date(record.updatedAt))}${record.updatedBy?.name ? ` por ${record.updatedBy.name}` : ''}`
            : undefined
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {record ? 'Editar' : 'Completar'}
          </Button>
        }
      >
        {record?.background ? (
          <p className="text-body-sm whitespace-pre-line text-fg">{record.background}</p>
        ) : (
          <p className="text-body-sm text-fg-subtle">
            Sin antecedentes registrados (patologías, cirugías, medicación, hábitos).
          </p>
        )}
      </Panel>

      <Panel
        flush
        title="Notas de sesión"
        description={`${notes.length} registradas, de la más reciente a la más antigua.`}
      >
        {notes.length === 0 ? (
          <EmptyState
            size="compact"
            icon={<ClipboardList />}
            title="Sin sesiones registradas"
            description="Las notas se registran desde la cita, con el botón «Registrar sesión»."
          />
        ) : (
          <div className="divide-y divide-border">
            {notes.map((n) => (
              <SessionNoteCard
                key={n.appointmentId}
                note={n}
                showService
                editable={isAdmin || n.createdBy.uid === currentUid}
              />
            ))}
          </div>
        )}
      </Panel>

      {editing && (
        <ClinicalRecordDialog
          clientId={clientId}
          clientName={clientName}
          record={record}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function ClinicalRecordDialog({
  clientId,
  clientName,
  record,
  onClose,
}: {
  clientId: string;
  clientName: string;
  record: ClinicalRecordView | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useSaveClinicalRecord();
  const [alerts, setAlerts] = useState(record?.alerts ?? '');
  const [background, setBackground] = useState(record?.background ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({ clientId, alerts, background });
      toast.success('Historia clínica actualizada');
      onClose();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      title="Historia clínica"
      description={clientName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <FormField
          label="Alertas clínicas"
          optional
          hint="Alergias, contraindicaciones o precauciones. Se muestran destacadas al atender al paciente."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={1000}
              value={alerts}
              onChange={(e) => setAlerts(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Antecedentes"
          optional
          hint="Patologías, cirugías, medicación habitual, actividad física, hábitos."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={6}
              maxLength={3000}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
          )}
        </FormField>
        <p className="flex items-center gap-1.5 text-caption text-fg-subtle">
          <TriangleAlert aria-hidden="true" className="size-3.5" />
          Solo lo ven la administración y los profesionales que atienden al paciente.
        </p>
      </div>
    </Dialog>
  );
}
