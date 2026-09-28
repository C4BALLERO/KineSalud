import {
  hasPermission,
  permissionScope,
  type Permission,
  type PermissionScope,
} from '@kinesalud/shared';
import { useSession } from '@/features/auth/session';

/** ¿La sesión actual tiene el permiso? (Solo controla la UI; el servidor vuelve a validar.) */
export function usePermission(permission: Permission): boolean {
  const { session } = useSession();
  return !!session && hasPermission(session, permission);
}

export function usePermissionScope(permission: Permission): PermissionScope | null {
  const { session } = useSession();
  return session ? permissionScope(session, permission) : null;
}
