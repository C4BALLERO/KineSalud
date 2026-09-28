import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink, useMatch } from 'react-router';
import { groupedNavItems, NAV_GROUP_LABELS, navLabel, type NavItem } from '@/app/navigation';
import { Logo } from '@/components/brand/Logo';
import { Tooltip } from '@/components/ui/Tooltip';
import { useRequiredSession } from '@/features/auth/session';
import { cn } from '@/utils/cn';

/**
 * El estado activo se calcula con useMatch (y no con la función className de
 * NavLink) porque el Tooltip de Radix combina className como texto.
 */
function SidebarLink({
  item,
  label,
  collapsed,
}: {
  item: NavItem;
  label: string;
  collapsed: boolean;
}) {
  const isActive = useMatch({ path: item.to, end: false }) !== null;
  const link = (
    <NavLink
      to={item.to}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-md text-body-sm font-medium transition-colors duration-150',
        collapsed ? 'justify-center' : 'px-3',
        isActive
          ? 'bg-primary-subtle font-semibold text-primary'
          : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
      )}
    >
      <item.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

interface SidebarProps {
  /** Riel de solo iconos (tablet/laptop) o sidebar completo (escritorio). */
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  const session = useRequiredSession();
  const groups = groupedNavItems(session);

  return (
    <div
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface',
        'transition-[width] duration-200 ease-standard',
        collapsed ? 'w-(--rail-width)' : 'w-(--sidebar-width)',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-(--topbar-height) shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        <NavLink to="/inicio" aria-label="Kinesalud y Vida — ir al inicio" className="rounded-md">
          <Logo variant={collapsed ? 'symbol' : 'full'} />
        </NavLink>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map(({ group, items }, index) => (
          <div key={group} className={cn(index > 0 && 'mt-5')}>
            {collapsed ? (
              index > 0 && <hr aria-hidden="true" className="mx-2 mb-4 border-border" />
            ) : (
              <p className="px-3 pb-2 text-overline text-fg-subtle uppercase">
                {NAV_GROUP_LABELS[group]}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.id}>
                  <SidebarLink
                    item={item}
                    label={navLabel(item, session.role)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-border p-3', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          className={cn(
            'flex h-10 cursor-pointer items-center gap-3 rounded-md text-body-sm text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg',
            collapsed ? 'w-10 justify-center' : 'w-full px-3',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5" strokeWidth={1.75} />
          ) : (
            <>
              <PanelLeftClose aria-hidden="true" className="size-5" strokeWidth={1.75} />
              <span>Contraer menú</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
