import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { FirebaseSessionProvider } from '@/features/auth/FirebaseSessionProvider';
import { queryClient } from '@/lib/queryClient';

/** Proveedores globales de la aplicación. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseSessionProvider>
        <UiProviders>{children}</UiProviders>
      </FirebaseSessionProvider>
    </QueryClientProvider>
  );
}

/** Proveedores de interfaz (también usados por las pruebas con una sesión simulada). */
export function UiProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <ToastProvider>{children}</ToastProvider>
    </TooltipProvider>
  );
}
