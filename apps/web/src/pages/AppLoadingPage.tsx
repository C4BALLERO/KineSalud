import { LogoSymbol } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/Spinner';

/** Pantalla de carga inicial (antes de resolver la primera ruta o la sesión). */
export function AppLoadingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas">
      <LogoSymbol className="size-12" />
      <Spinner className="size-5 text-primary" label="Cargando Kinesalud y Vida" />
    </main>
  );
}
