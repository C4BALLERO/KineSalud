import { Ellipsis, UserRound } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { mobileNavLabel, navLabel, splitForBottomNav } from '@/app/navigation';
import { Sheet } from '@/components/ui/Sheet';
import { useRequiredSession } from '@/features/auth/session';
import { cn } from '@/utils/cn';

const tabClasses = (active: boolean) =>
  cn(
    'flex h-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-tab transition-colors duration-150',
    active ? 'text-primary' : 'text-fg-muted',
  );

/** Navegación inferior en móvil: 4 accesos directos + "Más". */
export function BottomNav({ className }: { className?: string }) {
  const session = useRequiredSession();
  const { primary, overflow } = splitForBottomNav(session);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive =
    overflow.some((i) => pathname.startsWith(i.to)) || pathname.startsWith('/mi-cuenta');

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className={cn(
          'safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface',
          className,
        )}
      >
        <ul className="grid h-(--bottomnav-height) grid-cols-5">
          {primary.map((item) => (
            <li key={item.id} className="min-w-0">
              <NavLink to={item.to} className={({ isActive }) => tabClasses(isActive)}>
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                        isActive && 'bg-primary-subtle',
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        className="size-5"
                        strokeWidth={isActive ? 2 : 1.75}
                      />
                    </span>
                    <span className="max-w-full truncate">
                      {mobileNavLabel(item, session.role)}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="min-w-0">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(tabClasses(moreActive), 'w-full cursor-pointer')}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full',
                  moreActive && 'bg-primary-subtle',
                )}
              >
                <Ellipsis aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} side="bottom" title="Más opciones">
        <ul className="-mx-2 flex flex-col">
          {[
            ...overflow.map((i) => ({
              id: i.id,
              to: i.to,
              icon: i.icon,
              label: navLabel(i, session.role),
            })),
            { id: 'cuenta', to: '/mi-cuenta', icon: UserRound, label: 'Mi cuenta' },
          ].map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex h-12 items-center gap-3 rounded-md px-3 text-body font-medium',
                    isActive ? 'bg-primary-subtle text-primary' : 'text-fg hover:bg-surface-muted',
                  )
                }
              >
                <item.icon aria-hidden="true" className="size-5 text-fg-muted" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
