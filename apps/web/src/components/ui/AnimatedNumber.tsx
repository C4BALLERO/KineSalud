import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 750;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function canAnimate() {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return typeof IntersectionObserver !== 'undefined' && !reduced;
}

/**
 * Cifra que cuenta hasta su valor al aparecer y al cambiar (p. ej. ingresos
 * del día). Los lectores de pantalla oyen solo el valor final; sin
 * IntersectionObserver (pruebas) o con "reducir movimiento" se muestra directo.
 */
export function AnimatedNumber({
  value,
  format = String,
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  // Empieza en 0 si va a contar (evita mostrar el final y saltar a 0).
  const [display, setDisplay] = useState<number | null>(() => (canAnimate() ? 0 : null));

  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return;
    let frame = 0;
    const from = shown.current;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const current = from + (value - from) * easeOutCubic(t);
        shown.current = current;
        setDisplay(t < 1 ? current : null);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    // Solo cuando se ve: si está fuera de pantalla, cuenta al llegar a ella.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        run();
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      shown.current = value;
    };
  }, [value]);

  if (display === null) {
    return <span ref={ref}>{format(value)}</span>;
  }
  // Durante la cuenta, el valor final queda para lectores de pantalla.
  return (
    <span ref={ref}>
      <span aria-hidden="true">
        {format(Number.isInteger(value) ? Math.round(display) : display)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
