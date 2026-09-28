import { UserX } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { useClient, useUpdateClient } from '../api/clients';
import { ClientForm } from '../components/ClientForm';

export function ClientEditPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useClient(clientId);
  const updateClient = useUpdateClient();

  if (client.status === 'loading') {
    return (
      <LoadingRegion label="Cargando datos del cliente" className="flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </LoadingRegion>
    );
  }
  if (client.status === 'error')
    return <ErrorState description={client.error.message} onRetry={client.retry} />;
  if (client.status === 'not-found') {
    return (
      <EmptyState
        icon={<UserX />}
        title="Cliente no encontrado"
        description="El enlace no corresponde a ningún cliente registrado."
        action={
          <Button asChild>
            <Link to="/clientes">Ir a clientes</Link>
          </Button>
        }
      />
    );
  }

  const c = client.data;
  const profileUrl = `/clientes/${c.id}`;

  return (
    <>
      <PageHeader back={{ to: profileUrl, label: c.fullName }} title="Editar cliente" />
      <Panel className="max-w-4xl">
        <ClientForm
          key={c.id}
          defaultValues={{
            firstName: c.firstName,
            lastName: c.lastName,
            ci: c.ci,
            ciExt: c.ciExt ?? '',
            phone: c.phone,
            email: c.email ?? '',
            birthDate: c.birthDate ?? '',
            address: c.address ?? '',
            adminNotes: c.adminNotes ?? '',
          }}
          submitLabel="Guardar cambios"
          cancelTo={profileUrl}
          onSubmit={async (data) => {
            await updateClient.mutateAsync({ clientId: c.id, ...data });
            toast.success('Cambios guardados');
            navigate(profileUrl, { replace: true });
          }}
        />
      </Panel>
    </>
  );
}
