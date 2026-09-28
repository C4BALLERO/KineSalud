import { zodResolver } from '@hookform/resolvers/zod';
import {
  addExceptionInputSchema,
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPES,
  toDateKey,
  type AddExceptionInput,
} from '@kinesalud/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { useAddException } from '../api/staff';

interface ExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  professionalName: string;
}

/** Registrar vacaciones, permisos o bloqueos de agenda (días completos). */
export function ExceptionDialog({
  open,
  onOpenChange,
  professionalId,
  professionalName,
}: ExceptionDialogProps) {
  const toast = useToast();
  const addException = useAddException();
  const [serverError, setServerError] = useState<string | null>(null);
  const today = toDateKey(new Date());

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddExceptionInput>({
    resolver: zodResolver(addExceptionInputSchema),
    mode: 'onTouched',
    defaultValues: { professionalId, type: 'VACACIONES', dateFrom: today, dateTo: today, note: '' },
  });
  const dateFrom = useWatch({ control, name: 'dateFrom' });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { affectedAppointments } = await addException.mutateAsync(values);
      if (affectedAppointments > 0) {
        toast.show({
          tone: 'warning',
          title: 'Ausencia registrada',
          description: `${professionalName} tiene ${affectedAppointments} cita${affectedAppointments > 1 ? 's' : ''} pendiente${affectedAppointments > 1 ? 's' : ''} en esas fechas. Reprográmala${affectedAppointments > 1 ? 's' : ''} desde la agenda.`,
        });
      } else {
        toast.success('Ausencia registrada', 'Esos días no se le podrán agendar citas.');
      }
      onOpenChange(false);
    } catch (err) {
      const appError = toAppError(err);
      if (appError.field === 'dateFrom' || appError.field === 'dateTo') {
        setError(appError.field, { message: appError.message });
      } else {
        setServerError(appError.message);
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !isSubmitting && onOpenChange(o)}
      title="Registrar ausencia"
      description={`Los días elegidos ${professionalName} no aparecerá disponible en la agenda.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="exception-form" loading={isSubmitting}>
            Registrar ausencia
          </Button>
        </>
      }
    >
      <form
        id="exception-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-4 pb-2"
      >
        {serverError && <InlineAlert tone="danger" title={serverError} />}
        <FormField label="Tipo" required error={errors.type?.message}>
          {(p) => (
            <Select {...p} {...register('type')}>
              {EXCEPTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EXCEPTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Desde" required error={errors.dateFrom?.message}>
            {(p) => <Input {...p} {...register('dateFrom')} type="date" min={today} />}
          </FormField>
          <FormField label="Hasta (incluido)" required error={errors.dateTo?.message}>
            {(p) => <Input {...p} {...register('dateTo')} type="date" min={dateFrom || today} />}
          </FormField>
        </div>
        <FormField
          label="Nota"
          optional
          hint="Visible para el personal, p. ej. el motivo o quién cubre sus pacientes."
          error={errors.note?.message}
        >
          {(p) => <Textarea {...p} {...register('note')} rows={2} />}
        </FormField>
      </form>
    </Dialog>
  );
}
