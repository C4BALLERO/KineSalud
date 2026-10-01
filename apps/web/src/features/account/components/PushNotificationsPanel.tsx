import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/Checkbox';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toast-context';
import {
  disablePush,
  enablePush,
  pushAvailability,
  pushEnabledHere,
  type PushAvailability,
} from '@/lib/push';

/**
 * Avisos push en este navegador (recordatorios por gestionar). Es opcional:
 * la bandeja de la app y la pantalla Recordatorios funcionan sin push.
 */
export function PushNotificationsPanel({ uid }: { uid: string }) {
  const toast = useToast();
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [enabled, setEnabled] = useState(() => pushEnabledHere());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void pushAvailability().then((a) => !cancelled && setAvailability(a));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (on) await enablePush(uid);
      else await disablePush(uid);
      setEnabled(on);
      toast.success(on ? 'Avisos activados en este navegador' : 'Avisos desactivados');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cambiar los avisos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Avisos en este dispositivo"
      description="Recibe un aviso del navegador cuando haya recordatorios para gestionar, aunque la app esté cerrada."
    >
      {availability === null ? null : availability === 'available' ? (
        <div className="flex flex-col gap-3">
          <Switch
            label="Notificaciones push"
            description="Se activan solo en este navegador. Los avisos no incluyen datos de pacientes."
            checked={enabled}
            disabled={busy}
            onCheckedChange={(v) => void toggle(v)}
          />
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        </div>
      ) : (
        <p className="flex items-start gap-2 text-body-sm text-fg-muted">
          <BellRing aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {availability === 'unsupported'
            ? 'Este navegador no admite notificaciones push. Los avisos siguen llegando a la campana de la app.'
            : 'Las notificaciones push todavía no están configuradas en el consultorio. Los avisos llegan a la campana de la app.'}
        </p>
      )}
    </Panel>
  );
}
