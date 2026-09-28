import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toast-context';
import { useCreateClient } from '../api/clients';
import { ClientForm } from '../components/ClientForm';
import { EMPTY_CLIENT_FORM } from '../components/clientFormValues';

export function ClientCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createClient = useCreateClient();

  return (
    <>
      <PageHeader
        back={{ to: '/clientes', label: 'Clientes' }}
        title="Registrar cliente"
        description="Los campos marcados con * son obligatorios."
      />
      <Panel className="max-w-4xl">
        <ClientForm
          defaultValues={EMPTY_CLIENT_FORM}
          submitLabel="Registrar cliente"
          cancelTo="/clientes"
          onSubmit={async (data) => {
            const { clientId } = await createClient.mutateAsync(data);
            toast.show({
              tone: 'success',
              title: 'Cliente registrado',
              description: `${data.firstName} ${data.lastName} ya puede agendar citas.`,
              action: {
                label: 'Agendar cita',
                onClick: () => navigate(`/agenda/nueva?cliente=${clientId}`),
              },
            });
            navigate(`/clientes/${clientId}`, { replace: true });
          }}
        />
      </Panel>
    </>
  );
}
