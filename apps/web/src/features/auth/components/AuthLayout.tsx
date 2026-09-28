import type { ReactNode } from 'react';
import { Logo, LogoSymbol } from '@/components/brand/Logo';

/**
 * Layout de las pantallas públicas (login, recuperación). En escritorio
 * muestra un panel de marca claro con el logo oficial a color; en móvil,
 * el logo sobre el formulario.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden border-r border-primary-border bg-primary-subtle p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo variant="brand" size="lg" className="relative z-10 self-start" />

        <div className="relative z-10 flex max-w-md flex-col gap-4">
          <h2 className="text-display text-balance text-fg">
            Gestión clínica para el cuidado del movimiento.
          </h2>
          <p className="text-body text-fg-muted">
            Agenda, pacientes y seguimiento de tratamientos de fisioterapia, rehabilitación y
            estética en un solo lugar.
          </p>
        </div>

        <p className="relative z-10 text-body-sm text-fg-muted">
          Kinesalud y Vida · Cochabamba, Bolivia
        </p>

        {/* Símbolo ampliado y muy tenue como elemento gráfico de marca. */}
        <LogoSymbol className="pointer-events-none absolute -right-20 -bottom-16 size-[26rem] opacity-[0.07]" />
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo variant="brand" size="md" className="mb-10 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
