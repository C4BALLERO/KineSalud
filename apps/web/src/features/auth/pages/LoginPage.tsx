import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema } from '@kinesalud/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { signIn } from '../api/authApi';
import { authErrorMessage } from '../api/authErrors';
import { AuthLayout } from '../components/AuthLayout';
import { IDLE_SIGNOUT_FLAG } from '../idle/IdleSignOut';

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});
type LoginValues = z.infer<typeof loginSchema>;

/** ¿La sesión anterior se cerró por inactividad? Se lee una sola vez y se borra. */
function consumeIdleFlag(): boolean {
  try {
    const flagged = sessionStorage.getItem(IDLE_SIGNOUT_FLAG) === '1';
    sessionStorage.removeItem(IDLE_SIGNOUT_FLAG);
    return flagged;
  } catch {
    return false;
  }
}

export function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [idleSignOut] = useState(consumeIdleFlag);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  // La redirección tras iniciar sesión la resuelve PublicOnlyRoute.
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setAuthError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setAuthError(authErrorMessage(err, 'login'));
    }
  });

  return (
    <AuthLayout>
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-h1 text-fg">Iniciar sesión</h1>
        <p className="text-body text-fg-muted">
          Ingresa con la cuenta que te asignó el consultorio.
        </p>
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {authError && <InlineAlert tone="danger" title={authError} />}
        {!authError && idleSignOut && (
          <InlineAlert tone="info" title="Cerramos tu sesión por inactividad.">
            Pasaron 30 minutos sin uso. Ingresa de nuevo para continuar.
          </InlineAlert>
        )}

        <FormField label="Correo electrónico" error={errors.email?.message}>
          {(p) => (
            <Input
              {...p}
              {...register('email')}
              type="email"
              autoComplete="username"
              inputMode="email"
            />
          )}
        </FormField>

        <div className="flex flex-col gap-1.5">
          <FormField label="Contraseña" error={errors.password?.message}>
            {(p) => (
              <PasswordInput {...p} {...register('password')} autoComplete="current-password" />
            )}
          </FormField>
          <Link
            to="/recuperar-contrasena"
            className="self-end rounded-sm text-body-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <p className="mt-8 text-caption text-fg-subtle">
        ¿No tienes cuenta? Solicítala al administrador del consultorio.
      </p>
    </AuthLayout>
  );
}
