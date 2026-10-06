import { TREATMENT_CATEGORIES } from '@kinesalud/shared';
import { useState } from 'react';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useServices } from '@/features/settings/api/catalog';
import { useProfessional, useSetMyServices } from '@/features/staff/api/staff';
import { toAppError } from '@/lib/errors';

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * El profesional marca los servicios que ofrece, dentro de las áreas de
 * atención de su ficha. Solo esos servicios se le pueden agendar.
 */
export function MyServicesPanel({ professionalId }: { professionalId: string }) {
  const toast = useToast();
  const professional = useProfessional(professionalId);
  const services = useServices();
  const save = useSetMyServices();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const body = (() => {
    if (professional.status === 'loading' || services.status === 'loading') {
      return (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-5 w-48" />
        </div>
      );
    }
    if (professional.status === 'not-found') {
      return (
        <p className="text-body-sm text-fg-muted">
          No se encontró tu ficha de profesional. Pide a la administración que la revise.
        </p>
      );
    }
    if (professional.status === 'error' || services.status === 'error') {
      const failed = professional.status === 'error' ? professional : services;
      return (
        <InlineAlert tone="danger" title="No se pudieron cargar tus servicios.">
          {failed.status === 'error' ? failed.error.message : null}
        </InlineAlert>
      );
    }

    const saved = professional.data.serviceIds;
    const selected = draft ?? saved;
    const dirty = !sameSet(selected, saved);
    const areas = TREATMENT_CATEGORIES.filter((c) => professional.data.categories.includes(c));
    const toggle = (id: string, on: boolean) => {
      setError(null);
      setDraft(on ? [...selected, id] : selected.filter((s) => s !== id));
    };

    const submit = async () => {
      setError(null);
      try {
        await save.mutateAsync({ serviceIds: selected });
        setDraft(null);
        toast.success('Servicios actualizados', 'Ya se te pueden agendar los servicios marcados.');
      } catch (err) {
        setError(toAppError(err).message);
      }
    };

    if (areas.length === 0) {
      return (
        <p className="text-body-sm text-fg-muted">
          Tu ficha aún no tiene áreas de atención. Pide a la administración que las defina.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        {error && <InlineAlert tone="danger" title={error} />}
        <CheckboxGroup
          label="Servicios que ofrezco"
          hint="Solo se te podrán agendar estos servicios. Para atender otra área, pide a la administración que la agregue a tu ficha."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((c) => {
              const options = services.data.filter(
                (s) => s.category === c && (s.active || selected.includes(s.id)),
              );
              return (
                <div key={c} className="flex flex-col gap-2.5">
                  <CategoryTag category={c} />
                  {options.length === 0 ? (
                    <p className="text-caption text-fg-subtle">No hay servicios de esta área.</p>
                  ) : (
                    options.map((s) => (
                      <Checkbox
                        key={s.id}
                        label={s.name}
                        description={s.active ? `${s.durationMin} min` : 'Servicio desactivado'}
                        checked={selected.includes(s.id)}
                        onCheckedChange={(on) => toggle(s.id, on)}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </CheckboxGroup>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {dirty && (
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={save.isPending}>
              Descartar cambios
            </Button>
          )}
          <Button onClick={() => void submit()} disabled={!dirty} loading={save.isPending}>
            Guardar servicios
          </Button>
        </div>
      </div>
    );
  })();

  return (
    <Panel
      title="Servicios que ofrezco"
      description="Marca lo que atiendes: recepción y tú solo podrán agendarte esos servicios."
      className="lg:col-span-2"
    >
      {body}
    </Panel>
  );
}
