import { BellRing, CalendarClock, History, Play } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/toast-context';
import { useClinicSettings } from '@/features/settings/api/catalog';
import { useNow } from '@/hooks/useNow';
import { usePermission } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import {
  useHandledReminders,
  usePendingReminders,
  useRunRemindersNow,
  useScheduledReminders,
  type ReminderItem,
} from '../api/reminders';
import { ReminderRow } from '../components/ReminderRow';

type Tab = 'pendientes' | 'programados' | 'gestionados';
const TABS: Tab[] = ['pendientes', 'programados', 'gestionados'];

/**
 * Recordatorios de citas. Los clientes no tienen la app: recepción los
 * contacta (WhatsApp con el mensaje listo o una llamada) y registra el
 * resultado, que actualiza la cita.
 */
export function RemindersPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t === params.get('vista')) ?? 'pendientes';
  const now = useNow();
  const toast = useToast();
  const isAdmin = usePermission('settings.manage');
  const clinic = useClinicSettings();
  const clinicName = clinic.status === 'success' ? clinic.data.name : 'Kinesalud y Vida';
  const lead = clinic.status === 'success' ? clinic.data.reminderLeadHours : 24;

  const pending = usePendingReminders();
  const scheduled = useScheduledReminders(tab === 'programados');
  const handled = useHandledReminders(tab === 'gestionados');
  const runNow = useRunRemindersNow();
  const [lastRun, setLastRun] = useState<string | null>(null);

  // Solo citas que todavía no empezaron: las pasadas ya no se pueden recordar.
  const upcoming =
    pending.status === 'success' ? pending.data.filter((r) => r.appointmentStartAt > now) : [];

  const run = async () => {
    try {
      const r = await runNow.mutateAsync();
      setLastRun(
        r.queued === 0
          ? 'No había recordatorios vencidos.'
          : `${r.queued} ${r.queued === 1 ? 'recordatorio pasó' : 'recordatorios pasaron'} a "Por gestionar".`,
      );
    } catch (err) {
      toast.error('No se pudo procesar la cola', toAppError(err).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Recordatorios"
        description={`Cada cita se recuerda ${lead} h antes (se configura en Configuración → Consultorio). Contacta al cliente y registra lo que respondió.`}
        actions={
          isAdmin && (
            <Button variant="secondary" onClick={() => void run()} loading={runNow.isPending}>
              <Play aria-hidden="true" />
              Procesar ahora
            </Button>
          )
        }
      />
      {lastRun && (
        <InlineAlert tone="info" className="mb-6">
          {lastRun}
        </InlineAlert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setParams(v === 'pendientes' ? {} : { vista: v }, { replace: true })}
      >
        <TabsList label="Secciones de recordatorios">
          <TabsTrigger
            value="pendientes"
            icon={<BellRing aria-hidden="true" />}
            count={pending.status === 'success' ? upcoming.length : undefined}
          >
            Por gestionar
          </TabsTrigger>
          <TabsTrigger value="programados" icon={<CalendarClock aria-hidden="true" />}>
            Programados
          </TabsTrigger>
          <TabsTrigger value="gestionados" icon={<History aria-hidden="true" />}>
            Gestionados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <ReminderList
            state={pending.status === 'success' ? { status: 'success', data: upcoming } : pending}
            clinicName={clinicName}
            actionable
            empty={{
              title: 'Nada por gestionar',
              description:
                'Cuando se acerque una cita, su recordatorio aparecerá aquí para contactar al cliente.',
            }}
          />
        </TabsContent>
        <TabsContent value="programados">
          <ReminderList
            state={scheduled}
            clinicName={clinicName}
            actionable={false}
            empty={{
              title: 'Sin recordatorios programados',
              description: 'Al agendar una cita se programa su recordatorio automáticamente.',
            }}
          />
        </TabsContent>
        <TabsContent value="gestionados">
          <ReminderList
            state={handled}
            clinicName={clinicName}
            actionable={false}
            empty={{
              title: 'Todavía no hay recordatorios gestionados',
              description: 'Los últimos 50 resultados registrados aparecerán aquí.',
            }}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ReminderList({
  state,
  clinicName,
  actionable,
  empty,
}: {
  state:
    | { status: 'loading' }
    | { status: 'error'; error: { message: string }; retry?: () => void }
    | { status: 'success'; data: ReminderItem[] };
  clinicName: string;
  actionable: boolean;
  empty: { title: string; description: string };
}) {
  return (
    <Panel flush>
      {state.status === 'loading' && <ListSkeleton rows={4} label="Cargando recordatorios…" />}
      {state.status === 'error' && (
        <ErrorState description={state.error.message} onRetry={state.retry} />
      )}
      {state.status === 'success' &&
        (state.data.length === 0 ? (
          <EmptyState icon={<BellRing />} title={empty.title} description={empty.description} />
        ) : (
          <div className="divide-y divide-border">
            {state.data.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                clinicName={clinicName}
                actionable={actionable}
              />
            ))}
          </div>
        ))}
    </Panel>
  );
}
