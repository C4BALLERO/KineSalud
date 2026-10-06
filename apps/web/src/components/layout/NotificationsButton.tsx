import { Bell, BellOff } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EmptyState } from '@/components/feedback/States';
import { Tooltip } from '@/components/ui/Tooltip';
import { useSession } from '@/features/auth/session';
import { markNotificationsRead, useMyNotifications } from '@/features/reminders/api/reminders';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/format';

/**
 * Bandeja de notificaciones del personal (colección `notifications`, en
 * tiempo real). Abrir un aviso lo marca como leído y lleva a su pantalla.
 */
export function NotificationsButton() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useMyNotifications(session?.uid ?? null);
  const items = notifications.status === 'success' ? notifications.data : [];
  const unread = items.filter((n) => !n.read);
  const label = unread.length > 0 ? `Notificaciones, ${unread.length} sin leer` : 'Notificaciones';

  const openItem = (id: string, read: boolean, link: string | null) => {
    if (!read) void markNotificationsRead([id]).catch(() => undefined);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip content="Notificaciones">
        <Popover.Trigger
          aria-label={label}
          className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg md:size-9"
        >
          <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} />
          {unread.length > 0 && (
            <span
              aria-hidden="true"
              className="tabular absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] leading-4 font-semibold text-on-danger ring-2 ring-surface"
            >
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="animate-pop z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface shadow-md"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-h3 text-fg">Notificaciones</h2>
            {unread.length > 1 && (
              <button
                type="button"
                className="cursor-pointer text-caption font-semibold text-primary underline-offset-2 hover:underline"
                onClick={() => void markNotificationsRead(unread.map((n) => n.id))}
              >
                Marcar todas como leídas
              </button>
            )}
          </header>
          {items.length === 0 ? (
            <EmptyState
              size="compact"
              icon={<BellOff />}
              title="Todo al día"
              description="Aquí verás avisos de recordatorios por gestionar y otras novedades."
            />
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n.id, n.read, n.link)}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted',
                      !n.read && 'bg-primary-subtle/50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.read ? 'bg-transparent' : 'bg-primary',
                      )}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-body-sm font-semibold text-fg">
                        {n.title}
                        {!n.read && <span className="sr-only"> (sin leer)</span>}
                      </span>
                      <span className="text-caption text-fg-muted">{n.body}</span>
                      {n.createdAt && (
                        <span className="text-caption text-fg-subtle">
                          {formatRelative(n.createdAt)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
