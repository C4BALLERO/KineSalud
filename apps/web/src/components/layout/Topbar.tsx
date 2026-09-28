import { CalendarPlus, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { usePermission, usePermissionScope } from '@/hooks/usePermission';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsButton } from './NotificationsButton';
import { UserMenu } from './UserMenu';

export function Topbar() {
  const navigate = useNavigate();
  const canSearchClients = usePermission('clients.read');
  // "Nueva cita" es una acción de recepción/administración (alcance total).
  const canCreateAppointments = usePermissionScope('appointments.manage') === 'all';

  return (
    <header className="sticky top-0 z-20 flex h-(--topbar-height) items-center gap-3 border-b border-border bg-surface px-4 md:px-6 lg:px-8">
      <Link
        to="/inicio"
        aria-label="Kinesalud y Vida — ir al inicio"
        className="rounded-md md:hidden"
      >
        <Logo size="sm" />
      </Link>

      {canSearchClients && <GlobalSearch className="hidden md:block" />}

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {canSearchClients && (
          <IconButton
            className="md:hidden"
            label="Buscar cliente"
            icon={<Search strokeWidth={1.75} />}
            onClick={() => navigate('/clientes?buscar=1')}
          />
        )}
        {canCreateAppointments && (
          <Button asChild className="hidden md:inline-flex">
            <Link to="/agenda/nueva">
              <CalendarPlus aria-hidden="true" />
              Nueva cita
            </Link>
          </Button>
        )}
        <NotificationsButton />
        <UserMenu />
      </div>
    </header>
  );
}
