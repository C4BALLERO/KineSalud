import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTreatmentInputSchema,
  toDateKey,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type CreateTreatmentInput,
} from '@kinesalud/shared';
import { useMemo, useState, type ChangeEvent } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorState, NoPermissionState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { ClientPicker } from '@/features/appointments/components/ClientPicker';
import { useRequiredSession } from '@/features/auth/session';
import { useClient, useMyPatients } from '@/features/clients/api/clients';
import { useServices } from '@/features/settings/api/catalog';
import { useProfessionals } from '@/features/staff/api/staff';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import { formatCi } from '@/utils/format';
import { useCreateTreatment } from '../api/treatments';

interface ChosenClient {
  id: string;
  fullName: string;
  detail: string;
}

/**
 * Abrir un tratamiento: cliente, servicio, profesional que lo realiza, inicio
 * y sesiones previstas. Lo clínico (objetivos, indicaciones) se agrega en la
 * fase de seguimiento, con acceso restringido.
 */
export function TreatmentCreatePage() {
  const session = useRequiredSession();
  const canManage = usePermission('treatments.manage');
  const clinicWide = usePermissionScope('treatments.manage') === 'all';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateTreatment();

  const prefilled = useClient(params.get('cliente') ?? undefined);
  const patients = useMyPatients(clinicWide ? null : session.professionalId);
  const services = useServices();
  const professionals = useProfessionals();
  const [picked, setPicked] = useState<ChosenClient | null | undefined>(undefined);
  const [changingClient, setChangingClient] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<CreateTreatmentInput>({
    resolver: zodResolver(createTreatmentInputSchema),
    mode: 'onTouched',
    defaultValues: {
      clientId: params.get('cliente') ?? '',
      serviceId: '',
      professionalId: clinicWide ? '' : (session.professionalId ?? ''),
      startDate: toDateKey(new Date()),
      plannedSessions: 10,
      notes: null,
    },
  });
  const serviceId = useWatch({ control, name: 'serviceId' });

  const client: ChosenClient | null =
    picked !== undefined
      ? picked
      : prefilled.status === 'success' && prefilled.data.status === 'ACTIVO'
        ? {
            id: prefilled.data.id,
            fullName: prefilled.data.fullName,
            detail: `CI ${formatCi(prefilled.data.ci, prefilled.data.ciExt)}`,
          }
        : null;

  const service =
    services.status === 'success' ? services.data.find((s) => s.id === serviceId) : undefined;
  const eligible = useMemo(
    () =>
      professionals.status === 'success' && serviceId
        ? professionals.data.filter((p) => p.active && p.serviceIds.includes(serviceId))
        : [],
    [professionals, serviceId],
  );

  if (!canManage) {
    return <NoPermissionState description="Tu rol no permite abrir tratamientos." />;
  }
  const loading =
    services.status === 'loading' ||
    professionals.status === 'loading' ||
    (params.get('cliente') && prefilled.status === 'loading');
  if (loading) {
    return (
      <LoadingRegion label="Preparando el formulario" className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </LoadingRegion>
    );
  }
  const failed = [services, professionals].find((q) => q.status === 'error');
  if (failed && failed.status === 'error') {
    return <ErrorState description={failed.error.message} onRetry={failed.retry} />;
  }

  const chooseClient = (c: ChosenClient) => {
    setPicked(c);
    setChangingClient(false);
    setValue('clientId', c.id, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { treatmentId } = await create.mutateAsync(values);
      toast.success('Tratamiento abierto', 'Ya puedes agendar su primera sesión.');
      navigate(`/tratamientos/${treatmentId}`);
    } catch (err) {
      const e = toAppError(err);
      if (e.field === 'serviceId' || e.field === 'professionalId' || e.field === 'clientId') {
        setError(e.field, { message: e.message });
      } else {
        setServerError(e.message);
      }
    }
  });

  const serviceList = services.status === 'success' ? services.data.filter((s) => s.active) : [];

  return (
    <>
      <PageHeader
        title="Nuevo tratamiento"
        description="Un plan de sesiones de un servicio con un profesional. Las citas se agendan después desde la agenda o desde el tratamiento."
        back={{ to: '/tratamientos', label: 'Tratamientos' }}
      />

      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex max-w-3xl flex-col gap-6">
        {serverError && <InlineAlert tone="danger" title={serverError} />}
        {params.get('cliente') &&
          prefilled.status === 'success' &&
          prefilled.data.status !== 'ACTIVO' &&
          picked === undefined && (
            <InlineAlert tone="warning" title="El cliente está inactivo.">
              Reactívalo desde su perfil para abrirle un tratamiento, o elige otro cliente.
            </InlineAlert>
          )}

        <Panel title="Cliente">
          {client && !changingClient ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={client.fullName} size="sm" />
                <div className="flex flex-col">
                  <span className="font-medium text-fg">{client.fullName}</span>
                  <span className="text-caption text-fg-muted">{client.detail}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setChangingClient(true)}
              >
                Cambiar
              </Button>
            </div>
          ) : clinicWide ? (
            <ClientPicker
              selectedId={client?.id ?? null}
              onSelect={(c) =>
                chooseClient({
                  id: c.id,
                  fullName: c.fullName,
                  detail: `CI ${formatCi(c.ci, c.ciExt)}`,
                })
              }
            />
          ) : (
            <FormField label="Paciente" required error={errors.clientId?.message}>
              {(p) => (
                <Select
                  {...p}
                  value={client?.id ?? ''}
                  onChange={(e) => {
                    const c =
                      patients.status === 'success'
                        ? patients.data.find((x) => x.id === e.target.value)
                        : undefined;
                    if (c)
                      chooseClient({
                        id: c.id,
                        fullName: c.fullName,
                        detail: `CI ${formatCi(c.ci, c.ciExt)}`,
                      });
                  }}
                >
                  <option value="">Elige uno de tus pacientes</option>
                  {patients.status === 'success' &&
                    patients.data
                      .filter((c) => c.status === 'ACTIVO')
                      .sort((a, b) => a.lastNameLower.localeCompare(b.lastNameLower))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                </Select>
              )}
            </FormField>
          )}
          {errors.clientId && clinicWide && (
            <p className="mt-2 text-caption text-danger">{errors.clientId.message}</p>
          )}
        </Panel>

        <Panel title="Plan">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <FormField
              label="Servicio"
              required
              error={errors.serviceId?.message}
              className="sm:col-span-6"
            >
              {(p) => (
                <Select
                  {...p}
                  {...register('serviceId', {
                    onChange: (e: ChangeEvent<HTMLSelectElement>) => {
                      const s = serviceList.find((x) => x.id === e.target.value);
                      if (s && !getFieldState('plannedSessions').isDirty) {
                        setValue('plannedSessions', s.defaultSessions);
                      }
                      if (clinicWide) setValue('professionalId', '');
                    },
                  })}
                >
                  <option value="">Elige el servicio</option>
                  {TREATMENT_CATEGORIES.map((c) => {
                    const list = serviceList.filter((s) => s.category === c);
                    if (list.length === 0) return null;
                    return (
                      <optgroup key={c} label={TREATMENT_CATEGORY_LABELS[c]}>
                        {list.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </Select>
              )}
            </FormField>

            {clinicWide ? (
              <FormField
                label="Profesional"
                required
                error={errors.professionalId?.message}
                hint={
                  serviceId && eligible.length === 0
                    ? 'Ningún profesional activo realiza este servicio.'
                    : 'Solo los que realizan el servicio elegido.'
                }
                className="sm:col-span-6"
              >
                {(p) => (
                  <Select {...p} {...register('professionalId')} disabled={!serviceId}>
                    <option value="">
                      {serviceId ? 'Elige el profesional' : 'Primero elige el servicio'}
                    </option>
                    {eligible.map((pro) => (
                      <option key={pro.id} value={pro.id}>
                        {pro.displayName}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : (
              serviceId &&
              !eligible.some((p) => p.id === session.professionalId) && (
                <InlineAlert tone="warning" className="sm:col-span-6">
                  Este servicio no figura entre los que realizas. Pide a la administración que lo
                  agregue a tu ficha.
                </InlineAlert>
              )
            )}

            <FormField
              label="Inicio"
              required
              error={errors.startDate?.message}
              className="sm:col-span-3"
            >
              {(p) => <Input {...p} {...register('startDate')} type="date" />}
            </FormField>
            <FormField
              label="Sesiones previstas"
              required
              error={errors.plannedSessions?.message}
              hint={
                service ? `Sugeridas para este servicio: ${service.defaultSessions}.` : undefined
              }
              className="sm:col-span-3"
            >
              {(p) => (
                <Input
                  {...p}
                  {...register('plannedSessions', { valueAsNumber: true })}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                />
              )}
            </FormField>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <FormField
                  label="Nota administrativa"
                  optional
                  hint="Por ejemplo, quién lo derivó. No escribas aquí información clínica."
                  error={errors.notes?.message}
                  className="sm:col-span-6"
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={2}
                      maxLength={300}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    />
                  )}
                </FormField>
              )}
            />
          </div>
        </Panel>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Abrir tratamiento
          </Button>
        </div>
      </form>
    </>
  );
}
