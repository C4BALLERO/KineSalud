import {
  formatRanges,
  WEEKDAY_LABELS,
  WEEKDAYS,
  weeklyScheduleSchema,
  type WeeklySchedule,
} from '@kinesalud/shared';
import { useState } from 'react';
import { WeeklyScheduleEditor } from '@/components/domain/WeeklyScheduleEditor';
import {
  sameWeek,
  toEditableWeek,
  validateWeek,
  type EditableWeek,
} from '@/components/domain/scheduleEditorModel';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toast-context';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { toAppError } from '@/lib/errors';
import { cn } from '@/utils/cn';
import { useSetSchedule } from '../api/staff';

interface SchedulePanelProps {
  professionalId: string;
  schedule: WeeklySchedule;
  /** Horario del consultorio: guía y límite del horario del profesional. */
  clinicHours?: WeeklySchedule;
  stepMinutes?: number;
  canEdit: boolean;
}

/** Horario semanal del profesional: editable por la administración, de lectura para el resto. */
export function SchedulePanel(props: SchedulePanelProps) {
  if (!props.canEdit) return <ScheduleView schedule={props.schedule} />;
  // La clave reinicia el editor al cambiar de profesional.
  return <ScheduleEditorPanel key={props.professionalId} {...props} />;
}

function ScheduleView({ schedule }: { schedule: WeeklySchedule }) {
  return (
    <Panel title="Horario semanal">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="flex items-baseline justify-between gap-4 border-b border-border pb-2"
          >
            <dt className="text-body-sm font-medium text-fg">{WEEKDAY_LABELS[d]}</dt>
            <dd
              className={cn(
                'tabular text-body-sm',
                schedule[d]?.length ? 'text-fg' : 'text-fg-subtle',
              )}
            >
              {formatRanges(schedule[d])}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ScheduleEditorPanel({
  professionalId,
  schedule,
  clinicHours,
  stepMinutes,
}: SchedulePanelProps) {
  const toast = useToast();
  const setSchedule = useSetSchedule();
  const saved = toEditableWeek(schedule);
  const [week, setWeek] = useState<EditableWeek>(saved);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const dirty = !sameWeek(week, saved);
  const blocker = useUnsavedChanges(dirty && !setSchedule.isPending);
  const errors = validateWeek(week, clinicHours);
  const hasErrors = Object.keys(errors).length > 0;

  const save = async () => {
    setShowErrors(true);
    setServerError(null);
    if (hasErrors) return;
    try {
      await setSchedule.mutateAsync({
        professionalId,
        weeklySchedule: weeklyScheduleSchema.parse(week),
      });
      toast.success('Horario guardado', 'La agenda usará este horario desde ahora.');
    } catch (err) {
      setServerError(toAppError(err).message);
    }
  };

  return (
    <Panel title="Horario semanal" description="Días y horas en que se le pueden agendar citas.">
      <div className="flex flex-col gap-4">
        {!clinicHours && (
          <InlineAlert tone="info">
            El consultorio aún no tiene horario de atención configurado; por eso no se valida el
            horario contra él.
          </InlineAlert>
        )}
        {serverError && <InlineAlert tone="danger" title={serverError} />}
        {showErrors && hasErrors && (
          <InlineAlert tone="danger" title="Revisa los días marcados antes de guardar." />
        )}
        <WeeklyScheduleEditor
          value={week}
          onChange={setWeek}
          errors={showErrors ? errors : {}}
          reference={clinicHours}
          stepMinutes={stepMinutes}
          disabled={setSchedule.isPending}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={!dirty || setSchedule.isPending}
            onClick={() => {
              setWeek(saved);
              setShowErrors(false);
              setServerError(null);
            }}
          >
            Descartar cambios
          </Button>
          <Button onClick={() => void save()} disabled={!dirty} loading={setSchedule.isPending}>
            Guardar horario
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="¿Salir sin guardar el horario?"
        description="Hay cambios en el horario que todavía no se guardaron. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </Panel>
  );
}
