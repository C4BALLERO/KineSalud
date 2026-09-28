import { zodResolver } from '@hookform/resolvers/zod';
import {
  displayNameSchema,
  emailSchema,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  roleSchema,
  type Role,
} from '@kinesalud/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { RadioCardGroup } from '@/components/ui/RadioCardGroup';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { useCreateUser, useUpdateUser, type UserListItem } from '../api/users';
import { ROLE_ICONS } from './roleIcons';

const formSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: roleSchema,
});
type FormValues = z.input<typeof formSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Usuario a editar; si se omite, el diálogo crea uno nuevo. */
  user?: UserListItem | null;
  /** uid de la sesión: no puede cambiar su propio rol. */
  currentUid: string;
}

const roleOptions = ROLES.map((role) => {
  const Icon = ROLE_ICONS[role];
  return {
    value: role,
    label: ROLE_LABELS[role],
    description: ROLE_DESCRIPTIONS[role],
    icon: <Icon />,
  };
});

export function UserFormDialog({ open, onOpenChange, user, currentUid }: UserFormDialogProps) {
  const isEdit = !!user;
  const isSelf = user?.uid === currentUid;
  const toast = useToast();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [serverError, setServerError] = useState<string | null>(null);

  // El padre monta el diálogo con una `key` nueva en cada apertura, así el
  // formulario y el error del servidor siempre parten limpios.
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: {
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      role: user?.role as Role,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (user) {
        await updateUser.mutateAsync({
          uid: user.uid,
          displayName: values.displayName,
          role: values.role,
          professionalId: user.professionalId,
        });
        toast.success(
          'Cambios guardados',
          `${values.displayName} ya ve la interfaz de su rol actualizado.`,
        );
      } else {
        const { accessLinkSent } = await createUser.mutateAsync({
          displayName: values.displayName,
          email: values.email,
          role: values.role,
        });
        if (accessLinkSent) {
          toast.success(
            'Cuenta creada',
            `Enviamos a ${values.email} un enlace para crear su contraseña.`,
          );
        } else {
          toast.show({
            tone: 'info',
            title: 'Cuenta creada, correo no enviado',
            description: 'Usa "Enviar enlace de acceso" desde el menú del usuario para reintentar.',
          });
        }
      }
      onOpenChange(false);
    } catch (err) {
      setServerError(toAppError(err).message);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !isSubmitting && onOpenChange(o)}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      description={
        isEdit
          ? 'Los cambios de rol se aplican de inmediato en la sesión de la persona.'
          : 'La persona recibirá un correo para crear su propia contraseña.'
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="user-form"
            loading={isSubmitting}
            disabled={isEdit && !isDirty}
          >
            {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </>
      }
    >
      <form id="user-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-5 pb-2">
        {serverError && <InlineAlert tone="danger" title={serverError} />}

        <FormField label="Nombre completo" required error={errors.displayName?.message}>
          {(p) => <Input {...p} {...register('displayName')} autoComplete="off" />}
        </FormField>

        <FormField
          label="Correo electrónico"
          required={!isEdit}
          error={errors.email?.message}
          hint={
            isEdit ? 'El correo es el identificador de la cuenta y no se puede cambiar.' : undefined
          }
        >
          {(p) => (
            <Input
              {...p}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
              readOnly={isEdit}
            />
          )}
        </FormField>

        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RadioCardGroup
              label="Rol"
              required
              value={field.value}
              onChange={field.onChange}
              options={roleOptions}
              error={errors.role?.message}
              disabled={isSelf}
              hint={isSelf ? 'No puedes cambiar tu propio rol.' : undefined}
            />
          )}
        />
      </form>
    </Dialog>
  );
}
