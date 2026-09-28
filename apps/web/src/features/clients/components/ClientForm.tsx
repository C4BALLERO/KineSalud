import { zodResolver } from '@hookform/resolvers/zod';
import {
  ageOn,
  CI_EXTENSION_LABELS,
  CI_EXTENSIONS,
  clientInputSchema,
  toDateKey,
  type ClientData,
} from '@kinesalud/shared';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { toAppError } from '@/lib/errors';
import type { ClientFormValues } from './clientFormValues';

/** En el formulario los opcionales son texto ('' = vacío); el esquema los normaliza a null. */
const formSchema = clientInputSchema.extend({
  ciExt: z.union([z.enum(CI_EXTENSIONS), z.literal('')]).transform((v) => (v === '' ? null : v)),
});
type FormInput = z.input<typeof formSchema>;

interface ClientFormProps {
  defaultValues: ClientFormValues;
  submitLabel: string;
  cancelTo: string;
  /** Lanza AppError si el servidor rechaza los datos. */
  onSubmit: (data: ClientData) => Promise<void>;
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

export function ClientForm({ defaultValues, submitLabel, cancelTo, onSubmit }: ClientFormProps) {
  const [serverError, setServerError] = useState<{
    message: string;
    existingClientId?: string;
  } | null>(null);
  const today = toDateKey(new Date());

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting, isDirty, isSubmitSuccessful },
  } = useForm<FormInput, unknown, ClientData>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: defaultValues as FormInput,
  });

  const blocker = useUnsavedChanges(isDirty && !isSubmitSuccessful && !isSubmitting);
  const birthDate = useWatch({ control, name: 'birthDate' });
  const age =
    typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && birthDate <= today
      ? ageOn(birthDate, today)
      : null;

  const submit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      const appError = toAppError(err);
      const field = appError.field as keyof FormInput | undefined;
      if (field && field in defaultValues)
        setError(field, { message: appError.message }, { shouldFocus: true });
      const existing = appError.details?.clientId;
      setServerError({
        message: appError.message,
        existingClientId: typeof existing === 'string' ? existing : undefined,
      });
      throw err; // mantiene isSubmitSuccessful en false
    }
  });

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e).catch(() => undefined)}
      className="flex flex-col gap-8"
    >
      {serverError && (
        <InlineAlert
          tone="danger"
          title={serverError.message}
          action={
            serverError.existingClientId && (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/clientes/${serverError.existingClientId}`}>Ver cliente existente</Link>
              </Button>
            )
          }
        />
      )}

      <Fieldset legend="Identificación">
        <FormField
          label="Nombres"
          required
          error={errors.firstName?.message}
          className="md:col-span-3"
        >
          {(p) => <Input {...p} {...register('firstName')} autoComplete="off" />}
        </FormField>
        <FormField
          label="Apellidos"
          required
          error={errors.lastName?.message}
          className="md:col-span-3"
        >
          {(p) => <Input {...p} {...register('lastName')} autoComplete="off" />}
        </FormField>
        <FormField
          label="Carnet de identidad"
          required
          hint="Con complemento si lo tiene, p. ej. 1234567-1A."
          error={errors.ci?.message}
          className="md:col-span-3"
        >
          {(p) => <Input {...p} {...register('ci')} inputMode="text" autoComplete="off" />}
        </FormField>
        <FormField
          label="Expedido en"
          optional
          error={errors.ciExt?.message}
          className="md:col-span-3"
        >
          {(p) => (
            <Select {...p} {...register('ciExt')}>
              <option value="">Sin especificar</option>
              {CI_EXTENSIONS.map((ext) => (
                <option key={ext} value={ext}>
                  {CI_EXTENSION_LABELS[ext]} ({ext})
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Fecha de nacimiento"
          optional
          hint={age !== null ? `${age} ${age === 1 ? 'año' : 'años'}` : undefined}
          error={errors.birthDate?.message}
          className="md:col-span-3"
        >
          {(p) => (
            <Input {...p} {...register('birthDate')} type="date" max={today} min="1900-01-01" />
          )}
        </FormField>
      </Fieldset>

      <Fieldset legend="Contacto">
        <FormField
          label="Teléfono"
          required
          hint="Celular de 8 dígitos o fijo de 7. Se usará para confirmar citas."
          error={errors.phone?.message}
          className="md:col-span-3"
        >
          {(p) => (
            <Input {...p} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" />
          )}
        </FormField>
        <FormField
          label="Correo electrónico"
          optional
          error={errors.email?.message}
          className="md:col-span-3"
        >
          {(p) => (
            <Input
              {...p}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          label="Dirección"
          optional
          error={errors.address?.message}
          className="md:col-span-6"
        >
          {(p) => <Input {...p} {...register('address')} autoComplete="off" />}
        </FormField>
      </Fieldset>

      <Fieldset legend="Notas administrativas">
        <FormField
          label="Notas"
          optional
          hint="Visibles para recepción y administración. No registres aquí información clínica: esa se guarda en la historia clínica."
          error={errors.adminNotes?.message}
          className="md:col-span-6"
        >
          {(p) => <Textarea {...p} {...register('adminNotes')} rows={3} />}
        </FormField>
      </Fieldset>

      {/* Acciones fijas al pie en móvil, para no perderlas en formularios largos. */}
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
