import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Botones de acción, alineados a la derecha (apilados en móvil). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-overlay fixed inset-0 z-40 bg-overlay" />
        <RadixDialog.Content
          className={cn(
            'animate-pop fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-lg border border-border bg-surface shadow-lg',
            widths[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="flex flex-col gap-1">
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
          {children && <div className="overflow-y-auto px-5 pb-2">{children}</div>}
          {footer && (
            <footer className="flex flex-col-reverse gap-2 px-5 pt-3 pb-5 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
