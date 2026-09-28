import { findSlots, toDateKey, type Slot, type SlotAlternative } from '@kinesalud/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useNow } from '@/hooks/useNow';
import { toAppError } from '@/lib/errors';
import { capitalizeFirst, formatDayLong, formatTime } from '@/utils/format';
import {
  useAgendaAppointments,
  useRescheduleAppointment,
  type AgendaAppointment,
} from '../api/appointments';
import { useAgendaCatalogs } from '../hooks/useAgendaCatalogs';
import { alternativesOf, buildDayContext } from '../model';
import { SlotPicker } from './SlotPicker';

/** Reprogramar: nueva fecha, profesional y horario libre (la cita vuelve a Pendiente). */
export function RescheduleDialog({
  appointment,
  onClose,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
}) {
  const toast = useToast();
  const now = useNow();
  const today = toDateKey(now);
  const reschedule = useRescheduleAppointment();
  const [date, setDate] = useState(appointment.date >= today ? appointment.date : today);
  const [professionalId, setProfessionalId] = useState(appointment.professionalId);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<{ message: string; alternatives: SlotAlternative[] } | null>(
    null,
  );

  const catalogs = useAgendaCatalogs(date);
  const day = useAgendaAppointments(null, date, date, !!date);

  const ready = catalogs.status === 'success' && day.status === 'success';
  const service = ready
    ? catalogs.data.services.find((s) => s.id === appointment.serviceId)
    : undefined;
  const professionals = ready
    ? catalogs.data.professionals.filter(
        (p) =>
          (p.active && p.serviceIds.includes(appointment.serviceId)) ||
          p.id === appointment.professionalId,
      )
    : [];
  const slots =
    ready && service && catalogs.data.clinic && date >= today
      ? findSlots(
          buildDayContext({
            date,
            clinic: catalogs.data.clinic,
            professionals: catalogs.data.professionals,
            exceptions: catalogs.data.exceptions,
            rooms: catalogs.data.rooms,
            appointments: day.data,
            now,
          }),
          {
            service,
            clientId: appointment.clientId,
            ignoreAppointmentId: appointment.id,
            professionalId,
          },
        )
      : [];

  const submit = async (target: { start: string; professionalId: string }) => {
    setError(null);
    try {
      await reschedule.mutateAsync({
        appointmentId: appointment.id,
        professionalId: target.professionalId,
        date,
        start: target.start,
      });
      toast.success(
        'Cita reprogramada',
        `${capitalizeFirst(formatDayLong(date))} a las ${target.start}. Queda pendiente de confirmar con el cliente.`,
      );
      onClose();
    } catch (err) {
      setError({ message: toAppError(err).message, alternatives: alternativesOf(err) });
      setSlot(null);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && !reschedule.isPending && onClose()}
      title="Reprogramar cita"
      description={`${appointment.clientName} · ${appointment.serviceName}. Actual: ${formatDayLong(appointment.date)}, ${formatTime(appointment.startAt)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reschedule.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => slot && void submit(slot)}
            disabled={!slot}
            loading={reschedule.isPending}
          >
            Reprogramar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {error && (
          <InlineAlert tone="danger" title={error.message}>
            {error.alternatives.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="w-full">Horarios cercanos libres:</span>
                {error.alternatives.map((a) => (
                  <Button
                    key={`${a.start}|${a.professionalId}`}
                    variant="secondary"
                    size="sm"
                    onClick={() => void submit(a)}
                  >
                    {a.start} · {a.professionalName}
                  </Button>
                ))}
              </div>
            )}
          </InlineAlert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nueva fecha" required>
            {(p) => (
              <Input
                {...p}
                type="date"
                min={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlot(null);
                }}
              />
            )}
          </FormField>
          <FormField label="Profesional" required>
            {(p) => (
              <Select
                {...p}
                value={professionalId}
                onChange={(e) => {
                  setProfessionalId(e.target.value);
                  setSlot(null);
                }}
                disabled={!ready}
              >
                {professionals.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.displayName}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {!ready ? (
          <div className="flex flex-wrap gap-2" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-16" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <InlineAlert tone="info" title="No hay horarios libres ese día.">
            Prueba otra fecha u otro profesional.
          </InlineAlert>
        ) : (
          <SlotPicker slots={slots} value={slot} onChange={setSlot} label="Horario" />
        )}
      </div>
    </Dialog>
  );
}
