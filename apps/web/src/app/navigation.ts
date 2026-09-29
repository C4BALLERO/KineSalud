import {
  BellRing,
  CalendarDays,
  ChartColumn,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { hasPermission, permissionScope, type AccessSubject, type Role } from '@kinesalud/shared';

export type NavGroup = 'operacion' | 'gestion' | 'administracion';

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  operacion: 'Operación',
  gestion: 'Gestión',
  administracion: 'Administración',
};

export interface NavItem {
  id: string;
  to: string;
  label: string;
  /** Etiqueta alternativa según el rol (p. ej. "Mi agenda" para el profesional). */
  labelByRole?: Partial<Record<Role, string>>;
  /** Etiqueta corta para la barra inferior móvil, si la normal no cabe. */
  mobileLabelByRole?: Partial<Record<Role, string>>;
  icon: LucideIcon;
  group: NavGroup;
  /** Regla de visibilidad; la ruta tiene además su propia guardia. */
  visible: (subject: AccessSubject) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'inicio',
    to: '/inicio',
    label: 'Inicio',
    labelByRole: { PROFESIONAL: 'Mi día' },
    icon: LayoutDashboard,
    group: 'operacion',
    visible: () => true,
  },
  {
    id: 'agenda',
    to: '/agenda',
    label: 'Agenda',
    labelByRole: { PROFESIONAL: 'Mi agenda' },
    icon: CalendarDays,
    group: 'operacion',
    visible: (s) => hasPermission(s, 'appointments.read'),
  },
  {
    id: 'caja',
    to: '/caja',
    label: 'Caja',
    icon: Wallet,
    group: 'operacion',
    visible: (s) => hasPermission(s, 'payments.manage'),
  },
  {
    id: 'clientes',
    to: '/clientes',
    label: 'Clientes',
    labelByRole: { PROFESIONAL: 'Mis pacientes' },
    mobileLabelByRole: { PROFESIONAL: 'Pacientes' },
    icon: Users,
    group: 'operacion',
    visible: (s) => hasPermission(s, 'clients.read'),
  },
  {
    id: 'tratamientos',
    to: '/tratamientos',
    label: 'Tratamientos',
    icon: HeartPulse,
    group: 'operacion',
    visible: (s) => hasPermission(s, 'treatments.read'),
  },
  {
    id: 'personal',
    to: '/personal',
    label: 'Personal',
    icon: Stethoscope,
    group: 'gestion',
    // El profesional consulta su propia ficha desde "Mi cuenta", no desde el directorio.
    visible: (s) => permissionScope(s, 'staff.read') === 'all',
  },
  {
    id: 'recordatorios',
    to: '/recordatorios',
    label: 'Recordatorios',
    icon: BellRing,
    group: 'gestion',
    visible: (s) => hasPermission(s, 'reminders.manage'),
  },
  {
    id: 'reportes',
    to: '/reportes',
    label: 'Reportes',
    icon: ChartColumn,
    group: 'gestion',
    visible: (s) => hasPermission(s, 'reports.view'),
  },
  {
    id: 'usuarios',
    to: '/usuarios',
    label: 'Usuarios',
    icon: ShieldCheck,
    group: 'administracion',
    visible: (s) => hasPermission(s, 'users.manage'),
  },
  {
    id: 'configuracion',
    to: '/configuracion',
    label: 'Configuración',
    icon: Settings,
    group: 'administracion',
    visible: (s) => hasPermission(s, 'settings.manage'),
  },
];

export function navLabel(item: NavItem, role: Role): string {
  return item.labelByRole?.[role] ?? item.label;
}

export function mobileNavLabel(item: NavItem, role: Role): string {
  return item.mobileLabelByRole?.[role] ?? navLabel(item, role);
}

export function visibleNavItems(subject: AccessSubject): NavItem[] {
  return NAV_ITEMS.filter((item) => item.visible(subject));
}

/** Ítems agrupados en el orden de NAV_GROUP_LABELS, omitiendo grupos vacíos. */
export function groupedNavItems(subject: AccessSubject): { group: NavGroup; items: NavItem[] }[] {
  const items = visibleNavItems(subject);
  return (Object.keys(NAV_GROUP_LABELS) as NavGroup[])
    .map((group) => ({ group, items: items.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);
}

/** Cuántos accesos directos caben en la barra inferior móvil antes de "Más". */
export const BOTTOM_NAV_SLOTS = 4;

export function splitForBottomNav(subject: AccessSubject): {
  primary: NavItem[];
  overflow: NavItem[];
} {
  const items = visibleNavItems(subject);
  return { primary: items.slice(0, BOTTOM_NAV_SLOTS), overflow: items.slice(BOTTOM_NAV_SLOTS) };
}
