import type { ReactNode } from 'react';
import type { Permission } from '@kinesalud/shared';
import { usePermission } from '@/hooks/usePermission';

interface CanProps {
  permission: Permission;
  children: ReactNode;
  /** Qué mostrar si no hay permiso (por defecto, nada). */
  fallback?: ReactNode;
}

/** Muestra su contenido solo si la sesión tiene el permiso. */
export function Can({ permission, children, fallback = null }: CanProps) {
  return usePermission(permission) ? children : fallback;
}
