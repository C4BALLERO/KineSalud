import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * Protege un formulario con cambios sin guardar: bloquea la navegación
 * interna (se confirma con un diálogo) y avisa al cerrar o recargar la pestaña.
 */
export function useUnsavedChanges(dirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return blocker;
}
