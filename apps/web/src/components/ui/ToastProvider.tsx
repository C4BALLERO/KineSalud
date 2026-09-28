import { Toast } from 'radix-ui';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from './toast-context';

interface ToastItem extends ToastOptions {
  id: number;
  open: boolean;
}

const toneStyles: Record<ToastTone, { icon: ReactNode; bar: string }> = {
  success: { icon: <CircleCheck aria-hidden="true" className="text-success" />, bar: 'bg-success' },
  error: { icon: <CircleAlert aria-hidden="true" className="text-danger" />, bar: 'bg-danger' },
  info: { icon: <Info aria-hidden="true" className="text-info" />, bar: 'bg-info' },
  warning: {
    icon: <TriangleAlert aria-hidden="true" className="text-warning" />,
    bar: 'bg-warning',
  },
};

let nextId = 1;

/**
 * Notificaciones breves de resultado (guardado, error de red…). Los errores
 * permanecen más tiempo y se anuncian con prioridad alta a lectores de pantalla.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((options: ToastOptions) => {
    setToasts((prev) => [...prev.slice(-2), { ...options, id: nextId++, open: true }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, tone: 'success' }),
      error: (title, description) => show({ title, description, tone: 'error' }),
    }),
    [show],
  );

  const close = (id: number) =>
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="right" label="Notificaciones">
        {children}
        {toasts.map((t) => {
          const tone = t.tone ?? 'info';
          return (
            <Toast.Root
              key={t.id}
              open={t.open}
              type={tone === 'error' || tone === 'warning' ? 'foreground' : 'background'}
              duration={tone === 'error' || tone === 'warning' ? 8000 : 4500}
              onOpenChange={(open) => (open ? undefined : close(t.id))}
              onAnimationEnd={() => !t.open && remove(t.id)}
              className={cn(
                'animate-pop relative flex items-start gap-3 overflow-hidden rounded-md border border-border bg-surface py-3 pr-2 pl-4 shadow-md',
                '[&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0',
                'data-[swipe=end]:animate-none data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('absolute inset-y-0 left-0 w-1', toneStyles[tone].bar)}
              />
              {toneStyles[tone].icon}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Toast.Title className="text-body-sm font-semibold text-fg">{t.title}</Toast.Title>
                {t.description && (
                  <Toast.Description className="text-body-sm text-fg-muted">
                    {t.description}
                  </Toast.Description>
                )}
                {t.action && (
                  <Toast.Action altText={t.action.label} asChild>
                    <button
                      type="button"
                      onClick={t.action.onClick}
                      className="mt-1 self-start text-body-sm font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {t.action.label}
                    </button>
                  </Toast.Action>
                )}
              </div>
              <Toast.Close
                aria-label="Cerrar notificación"
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-muted hover:text-fg"
              >
                <X aria-hidden="true" className="size-4" />
              </Toast.Close>
            </Toast.Root>
          );
        })}
        <Toast.Viewport className="fixed right-0 bottom-[calc(var(--bottomnav-height)+0.5rem)] z-60 flex w-full max-w-sm flex-col gap-2 p-4 outline-none md:bottom-0" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
