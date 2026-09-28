import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_DESCRIPTIONS } from '@kinesalud/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Panel } from '@/components/ui/Panel';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/toast-context';
import { changePassword } from '@/features/auth/api/authApi';
import { authErrorMessage } from '@/features/auth/api/authErrors';
import { NewPasswordFields } from '@/features/auth/components/NewPasswordFields';
import { changePasswordFormSchema } from '@/features/auth/schemas';
import { useRequiredSession } from '@/features/auth/session';
import { RoleBadge } from '@/features/users/components/UserBadges';

type PasswordValues = z.infer<typeof changePasswordFormSchema>;

function ChangePasswordForm() {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      reset();
      toast.success('Contraseña actualizada', 'Úsala la próxima vez que ingreses.');
    } catch (err) {
      setError(authErrorMessage(err, 'change-password'));
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-(--container-form) flex-col gap-5">
      {error && <InlineAlert tone="danger" title={error} />}
      <FormField label="Contraseña actual" error={errors.currentPassword?.message}>
        {(p) => (
          <PasswordInput {...p} {...register('currentPassword')} autoComplete="current-password" />
        )}
      </FormField>
      <NewPasswordFields register={register} errors={errors} />
      <div>
        <Button type="submit" loading={isSubmitting}>
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}

export function AccountPage() {
  const session = useRequiredSession();

  return (
    <>
      <PageHeader
        title="Mi cuenta"
        description="Tus datos de acceso al sistema."
        leading={<Avatar name={session.displayName} size="lg" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <Panel title="Datos de la cuenta">
          <div className="flex flex-col gap-5">
            <KeyValueList
              columns={1}
              items={[
                { label: 'Nombre', value: session.displayName },
                { label: 'Correo electrónico', value: session.email },
                { label: 'Rol', value: <RoleBadge role={session.role} /> },
              ]}
            />
            <p className="text-caption text-fg-subtle">
              {ROLE_DESCRIPTIONS[session.role]}{' '}
              {session.role === 'ADMINISTRADOR'
                ? 'Puedes editar tu nombre desde la sección Usuarios.'
                : 'Para cambiar tu nombre o tu rol, contacta al administrador del consultorio.'}
            </p>
          </div>
        </Panel>
        <Panel
          title="Cambiar contraseña"
          description="Por seguridad, confirma tu contraseña actual."
        >
          <ChangePasswordForm />
        </Panel>
      </div>
    </>
  );
}
