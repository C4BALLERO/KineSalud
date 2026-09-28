import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema } from '@kinesalud/shared';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { sendPasswordReset } from '../api/authApi';
import { authErrorMessage } from '../api/authErrors';
import { AuthLayout } from '../components/AuthLayout';

const schema = z.object({ email: emailSchema });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await sendPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      setError(authErrorMessage(err, 'reset'));
    }
  });

  if (sentTo) {
    return (
      <AuthLayout>
        <div role="status" className="flex flex-col items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary"
          >
            <MailCheck className="size-6" />
          </span>
          <h1 className="text-h1 text-fg">Revisa tu correo</h1>
          <p className="text-body text-fg-muted">
            Si <strong className="font-semibold text-fg">{sentTo}</strong> corresponde a una cuenta
            del consultorio, recibirás un enlace para crear una contraseña nueva. Revisa también la
            carpeta de correo no deseado.
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <Link to="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-h1 text-fg">Recuperar contraseña</h1>
        <p className="text-body text-fg-muted">
          Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.
        </p>
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <InlineAlert tone="danger" title={error} />}
        <FormField label="Correo electrónico" error={errors.email?.message}>
          {(p) => (
            <Input
              {...p}
              {...register('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
            />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Enviar enlace
        </Button>
        <Link
          to="/login"
          className="self-center rounded-sm text-body-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </form>
    </AuthLayout>
  );
}
