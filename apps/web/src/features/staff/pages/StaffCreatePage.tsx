import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toast-context';
import { useCreateProfessional } from '../api/staff';
import { ProfessionalForm } from '../components/ProfessionalForm';
import { EMPTY_PROFESSIONAL_FORM } from '../model';

export function StaffCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateProfessional();

  return (
    <>
      <PageHeader
        back={{ to: '/personal', label: 'Personal' }}
        title="Nuevo profesional"
        description="Después de registrarlo, define su horario de atención."
      />
      <Panel className="max-w-4xl">
        <ProfessionalForm
          defaultValues={EMPTY_PROFESSIONAL_FORM}
          submitLabel="Registrar profesional"
          cancelTo="/personal"
          onSubmit={async (data) => {
            const { professionalId } = await create.mutateAsync(data);
            toast.success(
              'Profesional registrado',
              'Ahora define los días y horas en que atiende.',
            );
            navigate(`/personal/${professionalId}?tab=horario`, { replace: true });
          }}
        />
      </Panel>
    </>
  );
}
