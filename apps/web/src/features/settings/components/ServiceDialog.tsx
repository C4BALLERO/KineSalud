import { zodResolver } from '@hookform/resolvers/zod';
import {
  centsToInput,
  parseMoney,
  ROOM_KIND_LABELS,
  ROOM_KINDS,
  serviceInputSchema,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type ServiceInput,
} from '@kinesalud/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MoneyInput } from '@/components/domain/MoneyInput';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, type FieldControlProps } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { useSaveService, type ServiceItem } from '../api/catalog';

interface ServiceDialogProps {
  service: ServiceItem | null;
  /** Al duplicar: valores iniciales de otro servicio (se crea uno nuevo). */
  template?: ServiceItem;
  onClose: () => void;
}

const numberField = { valueAsNumber: true } as const;

/** Crear o editar un servicio del catálogo. */
export function ServiceDialog({ service, template, onClose }: ServiceDialogProps) {
  const base = service ?? template;
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
      name: service?.name ?? (template ? `${template.name} (copia)` : ''),
      category: base?.category ?? 'FISIOTERAPIA',
      durationMin: base?.durationMin ?? 45,
      bufferMin: base?.bufferMin ?? 15,
      defaultSessions: base?.defaultSessions ?? 10,
      roomKinds: base?.roomKinds ?? [],
      // NaN = vacío: el esquema pide completarlo.
      priceCents: base?.priceCents ?? Number.NaN,
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
        <Controller
          control={control}
          name="priceCents"
          render={({ field }) => (
            <FormField
              label="Precio por sesión"
              required
              error={errors.priceCents?.message}
              className="sm:col-span-2"
            >
              {(p) => (
                <PriceInput
                  {...p}
                  initial={base?.priceCents ?? null}
                  onBlur={field.onBlur}
                  onChange={(cents) => field.onChange(cents ?? Number.NaN)}
                />
              )}
            </FormField>
          )}
        />
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

/** Texto libre en bolivianos ("150", "150,50") que se entrega al formulario en centavos. */
function PriceInput({
  initial,
  onChange,
  onBlur,
  ...control
}: {
  initial: number | null;
  onChange: (cents: number | null) => void;
  onBlur: () => void;
} & FieldControlProps) {
  const [text, setText] = useState(initial !== null ? centsToInput(initial) : '');
  return (
    <MoneyInput
      {...control}
      value={text}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseMoney(e.target.value));
      }}
    />
  );
}
