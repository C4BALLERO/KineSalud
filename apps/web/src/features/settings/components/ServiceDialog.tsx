import { zodResolver } from '@hookform/resolvers/zod';
import {
  ROOM_KIND_LABELS,
  ROOM_KINDS,
  serviceInputSchema,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type ServiceInput,
} from '@kinesalud/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { useSaveService, type ServiceItem } from '../api/catalog';

interface ServiceDialogProps {
  service: ServiceItem | null;
  onClose: () => void;
}

const numberField = { valueAsNumber: true } as const;

/** Crear o editar un servicio del catálogo. */
export function ServiceDialog({ service, onClose }: ServiceDialogProps) {
  const toast = useToast();
  const saveService = useSaveService();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceInputSchema),
    mode: 'onTouched',
    defaultValues: {
      serviceId: service?.id ?? null,
      name: service?.name ?? '',
      category: service?.category ?? 'FISIOTERAPIA',
      durationMin: service?.durationMin ?? 45,
      bufferMin: service?.bufferMin ?? 15,
      defaultSessions: service?.defaultSessions ?? 10,
      roomKinds: service?.roomKinds ?? [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await saveService.mutateAsync(values);
      toast.success(service ? 'Servicio actualizado' : 'Servicio creado');
      onClose();
    } catch (err) {
      const appError = toAppError(err);
      if (appError.field === 'name' || appError.field === 'category') {
        setError(appError.field, { message: appError.message });
      } else {
        setServerError(appError.message);
      }
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !isSubmitting && onClose()}
      title={service ? 'Editar servicio' : 'Nuevo servicio'}
      description="La duración y la preparación definen cuánto tiempo ocupa cada cita en la agenda."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="service-form"
            loading={isSubmitting}
            disabled={!!service && !isDirty}
          >
            {service ? 'Guardar cambios' : 'Crear servicio'}
          </Button>
        </>
      }
    >
      <form
        id="service-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-6"
      >
        {serverError && <InlineAlert tone="danger" title={serverError} className="sm:col-span-6" />}
        <FormField label="Nombre" required error={errors.name?.message} className="sm:col-span-4">
          {(p) => <Input {...p} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Área" required error={errors.category?.message} className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register('category')}>
              {TREATMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TREATMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Duración (min)"
          required
          error={errors.durationMin?.message}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              {...register('durationMin', numberField)}
              type="number"
              inputMode="numeric"
              min={15}
              max={240}
              step={5}
            />
          )}
        </FormField>
        <FormField
          label="Preparación (min)"
          required
          hint="Tiempo entre citas para limpiar o preparar el espacio."
          error={errors.bufferMin?.message}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              {...register('bufferMin', numberField)}
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              step={5}
            />
          )}
        </FormField>
        <FormField
          label="Sesiones sugeridas"
          required
          hint="Valor inicial al crear un tratamiento."
          error={errors.defaultSessions?.message}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              {...register('defaultSessions', numberField)}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
            />
          )}
        </FormField>
        <Controller
          control={control}
          name="roomKinds"
          render={({ field }) => (
            <CheckboxGroup
              label="Dónde puede realizarse"
              required
              error={errors.roomKinds?.message}
              className="sm:col-span-6"
            >
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {ROOM_KINDS.map((k) => (
                  <Checkbox
                    key={k}
                    label={ROOM_KIND_LABELS[k]}
                    checked={field.value.includes(k)}
                    onCheckedChange={(on) =>
                      field.onChange(on ? [...field.value, k] : field.value.filter((v) => v !== k))
                    }
                  />
                ))}
              </div>
            </CheckboxGroup>
          )}
        />
      </form>
    </Dialog>
  );
}
