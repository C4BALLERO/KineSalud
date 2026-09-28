import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';

/**
 * Layout de las pantallas públicas (login, recuperación). En escritorio muestra
 * un panel de marca sólido (sin gradientes); en móvil, solo el formulario.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo inverse size="md" />

        <div className="relative z-10 flex max-w-md flex-col gap-4">
          <h2 className="text-display text-balance">
            Gestión clínica para el cuidado del movimiento.
          </h2>
          <p className="text-body">
            Agenda, pacientes y seguimiento de tratamientos de fisioterapia, rehabilitación y
            estética en un solo lugar.
          </p>
        </div>

        <p className="relative z-10 text-body-sm">Kinesalud y Vida · Cochabamba, Bolivia</p>

        {/* Trazos del símbolo ampliados como elemento gráfico de marca. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          className="pointer-events-none absolute -right-24 -bottom-28 size-[26rem] text-primary-hover"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M11.5 25.5C11.5 20 12.2 15.5 14 11.5" />
          <path d="M13 16.6C16.5 15.4 19.5 12.8 21.8 9.2" />
          <path d="M12.8 18.6L20.5 24.8" />
          <circle cx="15.8" cy="6.8" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
