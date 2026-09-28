import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, LinkIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Spinner } from '@/components/ui/Spinner';
import { confirmReset, verifyResetCode } from '../api/authApi';
import { authErrorMessage } from '../api/authErrors';
import { AuthLayout } from '../components/AuthLayout';
import { NewPasswordFields } from '../components/NewPasswordFields';
import { newPasswordFormSchema } from '../schemas';

type Values = z.infer<typeof newPasswordFormSchema>;
type Stage =
  | { name: 'verifying' }
  | { name: 'invalid'; message: string }
  | { name: 'form'; email: string }
  | { name: 'done' };

function Message({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary [&_svg]:size-6"
      >
        {icon}
      </span>
      <h1 className="text-h1 text-fg">{title}</h1>
      {children}
    </div>
  );
}

/**
 * Manejador de enlaces de Firebase Auth (`/auth/accion?mode=resetPassword&oobCode=…`).
 * Sirve tanto para restablecer como para crear la primera contraseña de una cuenta nueva.
 */
export function AuthActionPage() {
  const [params] = useSearchParams();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const validLink = mode === 'resetPassword' && !!oobCode;
  const [verified, setVerified] = useState<Stage>({ name: 'verifying' });
  const stage: Stage = validLink
    ? verified
    : { name: 'invalid', message: 'El enlace no es válido o está incompleto.' };
  const setStage = setVerified;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(newPasswordFormSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!validLink) return;
    let cancelled = false;
    verifyResetCode(oobCode)
      .then((email) => !cancelled && setVerified({ name: 'form', email }))
      .catch(
        (err) =>
          !cancelled && setVerified({ name: 'invalid', message: authErrorMessage(err, 'reset') }),
      );
    return () => {
      cancelled = true;
    };
  }, [validLink, oobCode]);

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    if (!oobCode) return;
    setSubmitError(null);
    try {
      await confirmReset(oobCode, newPassword);
      setStage({ name: 'done' });
    } catch (err) {
      setSubmitError(authErrorMessage(err, 'reset'));
    }
  });

  return (
    <AuthLayout>
      {stage.name === 'verifying' && (
        <div className="flex items-center gap-3 text-body text-fg-muted">
          <Spinner className="text-primary" label="Verificando el enlace" />
          Verificando el enlace…
        </div>
      )}

      {stage.name === 'invalid' && (
        <Message icon={<LinkIcon />} title="No pudimos usar este enlace">
          <p className="text-body text-fg-muted">{stage.message}</p>
          <Button asChild variant="secondary" className="mt-2">
            <Link to="/recuperar-contrasena">Solicitar un enlace nuevo</Link>
          </Button>
        </Message>
      )}

      {stage.name === 'done' && (
        <Message icon={<CircleCheck />} title="Contraseña guardada">
          <p className="text-body text-fg-muted">Ya puedes ingresar con tu contraseña nueva.</p>
          <Button asChild className="mt-2">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </Message>
      )}

      {stage.name === 'form' && (
        <>
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-h1 text-fg">Crea tu contraseña</h1>
            <p className="text-body text-fg-muted">
              Para la cuenta <strong className="font-semibold text-fg">{stage.email}</strong>.
            </p>
          </div>
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
            {submitError && <InlineAlert tone="danger" title={submitError} />}
            <NewPasswordFields register={register} errors={errors} />
            <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
              Guardar contraseña
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
