import { TREATMENT_CATEGORY_LABELS } from '@kinesalud/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useToast } from '@/components/ui/toast-context';
import { useSetServiceProfessionals, type ServiceItem } from '@/features/settings/api/catalog';
import type { ProfessionalItem } from '@/features/staff/api/staff';
import { toAppError } from '@/lib/errors';

/**
 * Qué profesionales realizan el servicio. Solo se pueden marcar quienes
 * atienden su área; el resto aparece deshabilitado con el motivo.
 */
export function ServiceProfessionalsDialog({
  service,
  professionals,
  onClose,
}: {
  service: ServiceItem;
  professionals: ProfessionalItem[];
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useSetServiceProfessionals();
  const [selected, setSelected] = useState(
    () => new Set(professionals.filter((p) => p.serviceIds.includes(service.id)).map((p) => p.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const area = TREATMENT_CATEGORY_LABELS[service.category].toLowerCase();
  const list = [...professionals].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName),
  );

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({ serviceId: service.id, professionalIds: [...selected] });
      toast.success('Profesionales actualizados', `${selected.size} realizan «${service.name}».`);
      onClose();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      title="Profesionales del servicio"
      description={`Quiénes realizan «${service.name}». Solo a ellos se les puede agendar.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {list.length === 0 ? (
          <p className="text-body-sm text-fg-muted">Todavía no hay profesionales registrados.</p>
        ) : (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Profesionales</legend>
            {list.map((p) => {
              const fits = p.categories.includes(service.category);
              return (
                <Checkbox
                  key={p.id}
                  label={p.displayName}
                  description={
                    !fits
                      ? `No atiende ${area}: agrega el área en su ficha para asignarle este servicio.`
                      : !p.active
                        ? 'Ficha inactiva'
                        : undefined
                  }
                  disabled={!fits && !selected.has(p.id)}
                  checked={selected.has(p.id)}
                  onCheckedChange={(on) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    })
                  }
                />
              );
            })}
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}
