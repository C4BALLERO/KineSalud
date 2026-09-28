import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** `right`: panel lateral (detalle de cita). `bottom`: hoja inferior (menú "Más" en móvil). */
  side?: 'right' | 'bottom';
  /** Ancho del panel lateral en escritorio. */
  width?: 'md' | 'lg';
}

/**
 * Panel deslizante. En escritorio mantiene visible el contexto (p. ej. la
 * agenda) mientras se consulta un detalle.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  width = 'md',
}: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-overlay fixed inset-0 z-40 bg-overlay" />
        <RadixDialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-lg',
            side === 'right' &&
              cn(
                'animate-sheet-right inset-y-0 right-0 w-full border-l border-border',
                width === 'md' ? 'sm:max-w-md' : 'sm:max-w-xl',
              ),
            side === 'bottom' &&
              'animate-sheet-bottom safe-bottom inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t border-border',
          )}
        >
          {side === 'bottom' && (
            <span
              aria-hidden="true"
              className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong"
            />
          )}
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <RadixDialog.Title className="text-h2 text-fg">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-body-sm text-fg-muted">
                  {description}
                </RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Cerrar"
              className="-mt-1 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg md:size-9"
            >
              <X aria-hidden="true" className="size-5" />
            </RadixDialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
