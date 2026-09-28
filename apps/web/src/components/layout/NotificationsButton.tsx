import { Bell, BellOff } from 'lucide-react';
import { Popover } from 'radix-ui';
import { EmptyState } from '@/components/feedback/States';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * Bandeja de notificaciones del personal. En la Fase 13 se conecta a la
 * colección `notifications`; por ahora muestra su estado vacío.
 */
export function NotificationsButton() {
  const unread = 0;
  const label = unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones';

  return (
    <Popover.Root>
      <Tooltip content="Notificaciones">
        <Popover.Trigger
          aria-label={label}
          className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg md:size-9"
        >
          <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 size-2 rounded-full bg-danger ring-2 ring-surface md:top-1.5 md:right-1.5"
            />
          )}
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="animate-pop z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface shadow-md"
        >
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-h3 text-fg">Notificaciones</h2>
          </header>
          <EmptyState
            size="compact"
            icon={<BellOff />}
            title="Todo al día"
            description="Aquí verás avisos de citas por confirmar y recordatorios que requieren atención."
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
