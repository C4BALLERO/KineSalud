import { ShieldAlert, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from '../components/AuthLayout';
import { useSession, type BlockedReason } from '../session';

const COPY: Record<BlockedReason, { title: string; description: string; icon: ReactNode }> = {
  inactive: {
    title: 'Tu cuenta está desactivada',
    description:
      'Un administrador desactivó el acceso de esta cuenta. Si crees que es un error, contacta al administrador del consultorio.',
    icon: <UserX />,
  },
  'no-role': {
    title: 'Tu cuenta aún no tiene un rol',
    description:
      'La cuenta existe, pero todavía no se le asignó un rol en el sistema. Pide al administrador que complete la configuración.',
    icon: <ShieldAlert />,
  },
};

/** Sesión autenticada que no puede usar el sistema (sin rol o desactivada). */
export function AccountBlockedPage() {
  const { blockedReason, signOut } = useSession();
  const [leaving, setLeaving] = useState(false);
  const copy = COPY[blockedReason ?? 'no-role'];

  return (
    <AuthLayout>
      <div role="alert" className="flex flex-col items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-warning-subtle text-warning [&_svg]:size-6"
        >
          {copy.icon}
        </span>
        <h1 className="text-h1 text-fg">{copy.title}</h1>
        <p className="text-body text-fg-muted">{copy.description}</p>
        <Button
          variant="secondary"
          loading={leaving}
          className="mt-2"
          onClick={() => {
            setLeaving(true);
            void signOut();
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    </AuthLayout>
  );
}
