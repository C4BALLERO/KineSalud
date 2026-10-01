import type { TreatmentPlanView } from '@kinesalud/shared';
import { ClipboardList, Pencil } from 'lucide-react';
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
import { useSaveTreatmentPlan, useTreatmentClinical } from '../api/clinical';
import { ClinicalAccessNote } from './ClinicalRecordPanel';
import { PainChart } from './PainChart';
import { SessionNoteCard } from './SessionNoteCard';

const PLAN_FIELDS = [
  { key: 'assessment', label: 'Motivo de consulta y evaluación', rows: 4, max: 3000 },
  { key: 'goals', label: 'Objetivos', rows: 3, max: 2000 },
  { key: 'indications', label: 'Indicaciones', rows: 3, max: 2000 },
] as const;

/**
 * Plan y evolución del tratamiento (clínico). Una sola lectura auditada trae
 * el plan, las notas del tratamiento y las alertas del paciente.
 */
export function TreatmentClinicalPanels({
  treatmentId,
  serviceName,
  canEditPlan,
  currentUid,
  isAdmin,
  view,
}: {
  treatmentId: string;
  serviceName: string;
  canEditPlan: boolean;
  currentUid: string;
  isAdmin: boolean;
  view: 'plan' | 'evolucion';
}) {
  const clinical = useTreatmentClinical(treatmentId, true);
  const [editing, setEditing] = useState(false);

  if (clinical.isPending) return <ListSkeleton rows={3} label="Cargando información clínica…" />;
  if (clinical.isError) {
    return (
      <ErrorState
        description={toAppError(clinical.error).message}
        onRetry={() => void clinical.refetch()}
      />
    );
  }
  const { plan, notes, alerts } = clinical.data;

  return (
    <div className="flex flex-col gap-6">
      <ClinicalAccessNote />
      {alerts && (
        <InlineAlert tone="warning" title="Alertas clínicas del paciente">
          <span className="whitespace-pre-line">{alerts}</span>
        </InlineAlert>
      )}

      {view === 'plan' ? (
        <Panel
          title="Plan del tratamiento"
          description={
            plan?.updatedAt
              ? `Actualizado el ${formatDateTime(new Date(plan.updatedAt))}${plan.updatedBy?.name ? ` por ${plan.updatedBy.name}` : ''}`
              : undefined
          }
          actions={
            canEditPlan && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {plan ? 'Editar' : 'Definir plan'}
              </Button>
            )
          }
        >
          {plan ? (
            <dl className="flex flex-col gap-4 text-body-sm">
              {PLAN_FIELDS.map((f) => (
                <div key={f.key}>
                  <dt className="text-caption font-semibold text-fg-muted">{f.label}</dt>
                  <dd className="whitespace-pre-line text-fg">
                    {plan[f.key] ?? <span className="text-fg-subtle">Sin completar</span>}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-body-sm text-fg-subtle">
              Todavía no se definió el plan: motivo de consulta, objetivos e indicaciones.
            </p>
          )}
        </Panel>
      ) : (
        <>
          <Panel
            title="Dolor por sesión"
            description="Escala visual analógica (EVA): 0 = sin dolor, 10 = máximo."
          >
            <PainChart notes={notes} />
          </Panel>
          <Panel flush title="Notas de sesión">
            {notes.length === 0 ? (
              <EmptyState
                size="compact"
                icon={<ClipboardList />}
                title="Sin sesiones registradas"
                description="Las notas se registran desde cada cita con «Registrar sesión»."
              />
            ) : (
              <div className="divide-y divide-border">
                {notes.map((n) => (
                  <SessionNoteCard
                    key={n.appointmentId}
                    note={n}
                    editable={isAdmin || n.createdBy.uid === currentUid}
                  />
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {editing && (
        <PlanDialog
          treatmentId={treatmentId}
          serviceName={serviceName}
          plan={plan}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function PlanDialog({
  treatmentId,
  serviceName,
  plan,
  onClose,
}: {
  treatmentId: string;
  serviceName: string;
  plan: TreatmentPlanView | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useSaveTreatmentPlan();
  const [values, setValues] = useState({
    assessment: plan?.assessment ?? '',
    goals: plan?.goals ?? '',
    indications: plan?.indications ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({ treatmentId, ...values });
      toast.success('Plan guardado');
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
      title="Plan del tratamiento"
      description={serviceName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={save.isPending}>
            Guardar plan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {PLAN_FIELDS.map((f) => (
          <FormField key={f.key} label={f.label} optional>
            {(p) => (
              <Textarea
                {...p}
                rows={f.rows}
                maxLength={f.max}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </FormField>
        ))}
      </div>
    </Dialog>
  );
}
