import { zodResolver } from '@hookform/resolvers/zod';
import {
  PROFESSIONAL_TITLE_LABELS,
  PROFESSIONAL_TITLES,
  professionalInputSchema,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type ProfessionalData,
  type TreatmentCategory,
} from '@kinesalud/shared';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useServices } from '@/features/settings/api/catalog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { toAppError } from '@/lib/errors';
import type { ProfessionalFormValues } from '../model';

/** En el formulario el título vacío es '' y las especialidades, texto separado por comas. */
const formSchema = professionalInputSchema.extend({
  title: z
    .union([z.enum(PROFESSIONAL_TITLES), z.literal('')])
    .transform((v) => (v === '' ? null : v)),
  specialties: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .superRefine((list, ctx) => {
      const message =
        list.length > 6
          ? 'Máximo 6 especialidades.'
          : list.some((s) => s.length < 2)
            ? 'Cada especialidad debe tener al menos 2 letras.'
            : list.some((s) => s.length > 40)
              ? 'Cada especialidad puede tener hasta 40 caracteres.'
              : null;
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
});
type FormInput = z.input<typeof formSchema>;

interface ProfessionalFormProps {
  defaultValues: ProfessionalFormValues;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (data: ProfessionalData) => Promise<void>;
}

function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-5 border-b border-border pb-8 last-of-type:border-b-0 md:grid-cols-6">
      <legend className="mb-1 md:col-span-6">
        <span className="block text-h3 text-fg">{legend}</span>
        {description && <span className="block text-body-sm text-fg-muted">{description}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export function ProfessionalForm({
  defaultValues,
  submitLabel,
  cancelTo,
  onSubmit,
}: ProfessionalFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const services = useServices();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty, isSubmitSuccessful },
  } = useForm<FormInput, unknown, ProfessionalData>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: defaultValues as FormInput,
  });

  const blocker = useUnsavedChanges(isDirty && !isSubmitSuccessful && !isSubmitting);
  const categories = (useWatch({ control, name: 'categories' }) ?? []) as TreatmentCategory[];

  const toggleCategory = (category: TreatmentCategory, on: boolean) => {
    const next = on ? [...categories, category] : categories.filter((c) => c !== category);
    setValue('categories', next, { shouldDirty: true, shouldValidate: true });
    if (!on && services.status === 'success') {
      // Al quitar un área se quitan sus servicios, para no dejar asignaciones inválidas.
      const removed = new Set(
        services.data.filter((s) => s.category === category).map((s) => s.id),
      );
      const current = getValues('serviceIds') ?? [];
      setValue(
        'serviceIds',
        current.filter((id) => !removed.has(id)),
        { shouldDirty: true },
      );
    }
  };

  const submit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      const appError = toAppError(err);
      const field = appError.field as keyof FormInput | undefined;
      if (field && field in defaultValues) setError(field, { message: appError.message });
      else setServerError(appError.message);
      throw err;
    }
  });

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e).catch(() => undefined)}
      className="flex flex-col gap-8"
    >
      {serverError && <InlineAlert tone="danger" title={serverError} />}

      <Fieldset legend="Datos personales">
        <FormField label="Título" optional error={errors.title?.message} className="md:col-span-2">
          {(p) => (
            <Select {...p} {...register('title')}>
              <option value="">Sin título</option>
              {PROFESSIONAL_TITLES.map((t) => (
                <option key={t} value={t}>
                  {PROFESSIONAL_TITLE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Nombres"
          required
          error={errors.firstName?.message}
          className="md:col-span-2"
        >
          {(p) => <Input {...p} {...register('firstName')} autoComplete="off" />}
        </FormField>
        <FormField
          label="Apellidos"
          required
          error={errors.lastName?.message}
          className="md:col-span-2"
        >
          {(p) => <Input {...p} {...register('lastName')} autoComplete="off" />}
        </FormField>
        <FormField
          label="Celular"
          optional
          hint="Para coordinar la agenda. No se muestra a los clientes."
          error={errors.phone?.message}
          className="md:col-span-3"
        >
          {(p) => (
            <Input {...p} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" />
          )}
        </FormField>
      </Fieldset>

      <Fieldset legend="Atención" description="Define qué puede agendarse con este profesional.">
        <CheckboxGroup
          label="Áreas de atención"
          required
          error={errors.categories?.message}
          className="md:col-span-6"
        >
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {TREATMENT_CATEGORIES.map((c) => (
              <Checkbox
                key={c}
                label={TREATMENT_CATEGORY_LABELS[c]}
                checked={categories.includes(c)}
                onCheckedChange={(on) => toggleCategory(c, on)}
              />
            ))}
          </div>
        </CheckboxGroup>

        <FormField
          label="Especialidades"
          optional
          hint="Separadas por comas, p. ej. Deportiva, Neurológica."
          error={errors.specialties?.message}
          className="md:col-span-6"
        >
          {(p) => <Input {...p} {...register('specialties')} autoComplete="off" />}
        </FormField>

        <Controller
          control={control}
          name="serviceIds"
          render={({ field }) => {
            const selected = field.value ?? [];
            const toggle = (id: string, on: boolean) =>
              field.onChange(on ? [...selected, id] : selected.filter((s) => s !== id));
            return (
              <CheckboxGroup
                label="Servicios que realiza"
                error={errors.serviceIds?.message}
                hint="Solo se le podrán agendar estos servicios."
                className="md:col-span-6"
              >
                {categories.length === 0 ? (
                  <p className="text-body-sm text-fg-subtle">
                    Elige primero las áreas de atención.
                  </p>
                ) : services.status === 'loading' ? (
                  <div className="flex flex-col gap-2" aria-busy="true">
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-5 w-56" />
                  </div>
                ) : services.status === 'error' ? (
                  <InlineAlert tone="danger" title="No se pudo cargar el catálogo de servicios.">
                    {services.error.message}
                  </InlineAlert>
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {TREATMENT_CATEGORIES.filter((c) => categories.includes(c)).map((c) => {
                      const options = services.data.filter(
                        (s) => s.category === c && (s.active || selected.includes(s.id)),
                      );
                      return (
                        <div key={c} className="flex flex-col gap-2.5">
                          <CategoryTag category={c} />
                          {options.length === 0 ? (
                            <p className="text-caption text-fg-subtle">
                              No hay servicios de esta área.{' '}
                              <Link
                                to="/servicios"
                                className="font-medium text-primary underline underline-offset-2"
                              >
                                Crear en Configuración
                              </Link>
                            </p>
                          ) : (
                            options.map((s) => (
                              <Checkbox
                                key={s.id}
                                label={s.name}
                                description={
                                  s.active ? `${s.durationMin} min` : 'Servicio desactivado'
                                }
                                checked={selected.includes(s.id)}
                                onCheckedChange={(on) => toggle(s.id, on)}
                              />
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CheckboxGroup>
            );
          }}
        />
      </Fieldset>

      <div className="safe-bottom sticky bottom-[var(--bottomnav-height)] -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-surface px-4 py-3 sm:flex-row sm:justify-end md:static md:mx-0 md:border-t-0 md:bg-transparent md:p-0">
        <Button asChild variant="secondary">
          <Link to={cancelTo}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="¿Salir sin guardar?"
        description="Hay cambios en el formulario que todavía no se guardaron. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  );
}
