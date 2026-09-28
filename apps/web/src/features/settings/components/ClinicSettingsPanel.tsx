import {
  clinicSettingsInputSchema,
  REMINDER_LEAD_OPTIONS,
  SLOT_MINUTES_OPTIONS,
  weeklyScheduleSchema,
  type ClinicSettingsDoc,
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
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toast-context';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { toAppError } from '@/lib/errors';
import { useUpdateClinic } from '../api/catalog';

const DEFAULTS: ClinicSettingsDoc = {
  name: 'Kinesalud y Vida',
  timezone: 'America/La_Paz',
  slotMinutes: 15,
  reminderLeadHours: 24,
  openingHours: {},
};

interface ClinicSettingsPanelProps {
  /** Configuración guardada; null si todavía no se configuró. */
  settings: ClinicSettingsDoc | null;
}

/** Datos generales y horario de atención del consultorio. */
export function ClinicSettingsPanel({ settings }: ClinicSettingsPanelProps) {
  const toast = useToast();
  const update = useUpdateClinic();
  const saved = settings ?? DEFAULTS;
  const savedWeek = toEditableWeek(saved.openingHours);

  const [name, setName] = useState(saved.name);
  const [slotMinutes, setSlotMinutes] = useState(saved.slotMinutes);
  const [reminderLeadHours, setReminderLeadHours] = useState(saved.reminderLeadHours);
  const [week, setWeek] = useState<EditableWeek>(savedWeek);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const dirty =
    name !== saved.name ||
    slotMinutes !== saved.slotMinutes ||
    reminderLeadHours !== saved.reminderLeadHours ||
    !sameWeek(week, savedWeek);
  const blocker = useUnsavedChanges(dirty && !update.isPending);

  const dayErrors = validateWeek(week);
  const parsed = clinicSettingsInputSchema.safeParse({
    name,
    slotMinutes,
    reminderLeadHours,
    openingHours: week,
  });
  const nameError = parsed.error?.issues.find((i) => i.path[0] === 'name')?.message;
  const hoursError =
    Object.keys(dayErrors).length === 0
      ? parsed.error?.issues.find((i) => i.path[0] === 'openingHours')?.message
      : undefined;

  const reset = () => {
    setName(saved.name);
    setSlotMinutes(saved.slotMinutes);
    setReminderLeadHours(saved.reminderLeadHours);
    setWeek(savedWeek);
    setShowErrors(false);
    setServerError(null);
  };

  const save = async () => {
    setShowErrors(true);
    setServerError(null);
    if (!parsed.success) return;
    try {
      const { professionalsOutside } = await update.mutateAsync({
        ...parsed.data,
        openingHours: weeklyScheduleSchema.parse(week),
      });
      if (professionalsOutside.length > 0) {
        toast.show({
          tone: 'warning',
          title: 'Configuración guardada',
          description: `El horario de ${professionalsOutside.join(', ')} queda fuera del nuevo horario de atención. Ajústalo desde Personal.`,
        });
      } else {
        toast.success('Configuración guardada');
      }
      setShowErrors(false);
    } catch (err) {
      setServerError(toAppError(err).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!settings && (
        <InlineAlert tone="info" title="El consultorio aún no está configurado.">
          Define el horario de atención: la agenda y los horarios del personal se validan contra él.
        </InlineAlert>
      )}
      {serverError && <InlineAlert tone="danger" title={serverError} />}

      <Panel title="Datos generales">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <FormField
            label="Nombre del consultorio"
            required
            error={showErrors ? nameError : undefined}
            className="md:col-span-3 md:max-w-lg"
          >
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField
            label="Intervalo de la agenda"
            hint="Cada cuántos minutos se ofrecen horarios al agendar."
          >
            {(p) => (
              <Select
                {...p}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
              >
                {SLOT_MINUTES_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label="Recordatorio de citas"
            hint="Con cuánta anticipación se recuerda cada cita."
          >
            {(p) => (
              <Select
                {...p}
                value={reminderLeadHours}
                onChange={(e) => setReminderLeadHours(Number(e.target.value))}
              >
                {REMINDER_LEAD_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h} horas antes
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Zona horaria" hint="Fija para Bolivia (UTC−4, sin horario de verano).">
            {(p) => <Input {...p} value="América/La Paz" readOnly />}
          </FormField>
        </div>
      </Panel>

      <Panel
        title="Horario de atención"
        description="Los horarios del personal y las citas deben caer dentro de este horario."
      >
        <div className="flex flex-col gap-4">
          {showErrors && hoursError && <InlineAlert tone="danger" title={hoursError} />}
          <WeeklyScheduleEditor
            value={week}
            onChange={setWeek}
            errors={showErrors ? dayErrors : {}}
            stepMinutes={slotMinutes}
            disabled={update.isPending}
          />
        </div>
      </Panel>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={!dirty || update.isPending} onClick={reset}>
          Descartar cambios
        </Button>
        <Button onClick={() => void save()} disabled={!dirty} loading={update.isPending}>
          Guardar configuración
        </Button>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="¿Salir sin guardar?"
        description="Hay cambios en la configuración que todavía no se guardaron. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
