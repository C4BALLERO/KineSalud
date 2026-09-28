import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Describe la consecuencia concreta de la acción. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Acciones destructivas usan el botón rojo. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  /** Contenido extra, p. ej. un campo "motivo de cancelación". */
  children?: ReactNode;
}

/**
 * Confirmación para acciones irreversibles o destructivas. Usa AlertDialog:
 * no se cierra al hacer clic fuera y el foco inicial queda en "Cancelar".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="animate-overlay fixed inset-0 z-40 bg-overlay" />
        <AlertDialog.Content className="animate-pop fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-lg">
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-h2 text-fg">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-body-sm text-fg-muted">
              {description}
            </AlertDialog.Description>
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={loading}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
