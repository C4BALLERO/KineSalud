import { useEffect } from 'react';
import { usePermission } from '@/hooks/usePermission';
import { callFunction, usingHttpApi } from '@/lib/callable';

const EVERY_MS = 5 * 60_000;

/**
 * Despliegue gratuito (sin Cloud Scheduler): mientras recepción o
 * administración tienen la app abierta, la cola de recordatorios se procesa
 * cada 5 minutos. Es idempotente, así que varias pestañas no duplican nada.
 * Con Cloud Functions no hace nada: ahí lo hace la tarea programada.
 */
export function useReminderTick() {
  const manages = usePermission('reminders.manage');

  useEffect(() => {
    if (!usingHttpApi || !manages) return;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void callFunction('reminders-tick', {}).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, EVERY_MS);
    return () => window.clearInterval(id);
  }, [manages]);
}
