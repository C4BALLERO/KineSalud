import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toast-context';
import { usePermissionScope } from '@/hooks/usePermission';
import { useCreateClient } from '../api/clients';
import { ClientForm } from '../components/ClientForm';
import { EMPTY_CLIENT_FORM } from '../components/clientFormValues';

export function ClientCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createClient = useCreateClient();
  // Desde el asistente de nueva cita: al registrar, se vuelve a él con el cliente elegido.
  const [params] = useSearchParams();
  const fromAppointment = params.get('volver') === 'cita';
  const ownPatients = usePermissionScope('clients.write') === 'own';
  const listLabel = ownPatients ? 'Mis pacientes' : 'Clientes';

  return (
    <>
      <PageHeader
        back={
          fromAppointment
            ? { to: '/agenda/nueva', label: 'Nueva cita' }
            : { to: '/clientes', label: listLabel }
        }
        title={ownPatients ? 'Registrar paciente' : 'Registrar cliente'}
        description={
          ownPatients
            ? 'Queda entre tus pacientes. Los campos marcados con * son obligatorios.'
            : 'Los campos marcados con * son obligatorios.'
        }
      />
      <Panel className="max-w-4xl">
        <ClientForm
          defaultValues={EMPTY_CLIENT_FORM}
          submitLabel={ownPatients ? 'Registrar paciente' : 'Registrar cliente'}
          cancelTo={fromAppointment ? '/agenda/nueva' : '/clientes'}
          onSubmit={async (data) => {
            const { clientId, linked } = await createClient.mutateAsync(data);
            // Si el carnet ya estaba registrado con el mismo nombre, el servidor lo
            // suma a los pacientes del profesional en lugar de duplicarlo.
            const title = linked ? 'Paciente agregado' : 'Cliente registrado';
            if (linked) {
              toast.show({
                tone: 'info',
                title: 'Ya estaba registrado en el consultorio',
                description: `${data.firstName} ${data.lastName} ahora está entre tus pacientes, con los datos que ya tenía.`,
              });
            }
            if (fromAppointment) {
              toast.success(title, 'Continúa con los datos de la cita.');
              navigate(`/agenda/nueva?cliente=${clientId}`, { replace: true });
              return;
            }
            toast.show({
              tone: 'success',
              title,
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
