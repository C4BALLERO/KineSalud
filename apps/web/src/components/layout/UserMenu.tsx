import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { ROLE_LABELS } from '@kinesalud/shared';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useRequiredSession, useSession } from '@/features/auth/session';

export function UserMenu() {
  const session = useRequiredSession();
  const { signOut } = useSession();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menú de usuario: ${session.displayName}, ${ROLE_LABELS[session.role]}`}
        className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 transition-colors hover:bg-surface-muted md:h-10 lg:pr-2"
      >
        <Avatar name={session.displayName} size="sm" />
        <span className="hidden min-w-0 flex-col text-left lg:flex">
          <span className="max-w-40 truncate text-body-sm font-semibold text-fg">
            {session.displayName}
          </span>
          <span className="text-caption text-fg-subtle">{ROLE_LABELS[session.role]}</span>
        </span>
        <ChevronDown aria-hidden="true" className="hidden size-4 text-fg-subtle lg:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="px-2.5 py-2">
          <p className="truncate text-body-sm font-semibold text-fg">{session.displayName}</p>
          <p className="truncate text-caption text-fg-subtle">{session.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={<UserRound aria-hidden="true" />}
          onSelect={() => navigate('/mi-cuenta')}
        >
          Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Al cerrar sesión, ProtectedRoute redirige al login. */}
        <DropdownMenuItem icon={<LogOut aria-hidden="true" />} onSelect={() => void signOut()}>
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
