import { UserX } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useProfessional, useUpdateProfessional } from '../api/staff';
import { ProfessionalForm } from '../components/ProfessionalForm';
import { toProfessionalFormValues } from '../model';

export function StaffEditPage() {
  const { professionalId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const professional = useProfessional(professionalId);
  const update = useUpdateProfessional();

  if (professional.status === 'loading') {
    return (
      <LoadingRegion
        label="Cargando ficha del profesional"
        className="flex max-w-4xl flex-col gap-4"
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </LoadingRegion>
    );
  }
  if (professional.status === 'error') {
    return <ErrorState description={professional.error.message} onRetry={professional.retry} />;
  }
  if (professional.status === 'not-found') {
    return (
      <EmptyState
        icon={<UserX />}
        title="Profesional no encontrado"
        description="El enlace no corresponde a ninguna ficha registrada."
        action={
          <Button asChild>
            <Link to="/personal">Ir a personal</Link>
          </Button>
        }
      />
    );
  }

  const p = professional.data;
  const profileUrl = `/personal/${p.id}`;

  return (
    <>
      <PageHeader back={{ to: profileUrl, label: p.displayName }} title="Editar profesional" />
      <Panel className="max-w-4xl">
        <ProfessionalForm
          key={p.id}
          defaultValues={toProfessionalFormValues(p)}
          submitLabel="Guardar cambios"
          cancelTo={profileUrl}
          onSubmit={async (data) => {
            await update.mutateAsync({ professionalId: p.id, ...data });
            toast.success('Cambios guardados');
            navigate(profileUrl, { replace: true });
          }}
        />
      </Panel>
    </>
  );
}
