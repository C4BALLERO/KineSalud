import type { ReactNode } from 'react';
import type { Permission } from '@kinesalud/shared';
import { Link } from 'react-router';
import { NoPermissionState } from '@/components/feedback/States';
import { Button } from '@/components/ui/Button';
import { usePermission } from '@/hooks/usePermission';

/**
 * Guardia de ruta por permiso. Si el rol no puede acceder, muestra un estado
 * "sin permiso" dentro del layout (no una pantalla en blanco).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const allowed = usePermission(permission);
  if (allowed) return children;
  return (
    <NoPermissionState
      action={
        <Button asChild variant="secondary">
          <Link to="/inicio">Volver al inicio</Link>
        </Button>
      }
    />
  );
}
