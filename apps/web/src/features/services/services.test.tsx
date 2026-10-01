import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceItem } from '@/features/settings/api/catalog';
import { ServiceDialog } from '@/features/settings/components/ServiceDialog';
import type { ProfessionalItem } from '@/features/staff/api/staff';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { ServiceProfessionalsDialog } from './components/ServiceProfessionalsDialog';

vi.mock('@/features/settings/api/catalog', () => ({
  useSaveService: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetServiceProfessionals: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const service: ServiceItem = {
  id: 'lumbar',
  name: 'Fisioterapia lumbar',
  category: 'FISIOTERAPIA',
  durationMin: 45,
  bufferMin: 15,
  defaultSessions: 10,
  roomKinds: ['CAMILLA'],
  priceCents: 15000,
  active: true,
};

const pro = (over: Partial<ProfessionalItem>) =>
  ({
    id: 'diego',
    displayName: 'Lic. Diego Pérez',
    active: true,
    categories: ['FISIOTERAPIA'],
    serviceIds: [],
    ...over,
  }) as ProfessionalItem;

describe('módulo de servicios', () => {
  it('duplicar precarga los datos con un nombre nuevo y crea otro servicio', () => {
    render(
      <TestSessionProvider asRole="ADMINISTRADOR">
        <ServiceDialog service={null} template={service} onClose={() => {}} />
      </TestSessionProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Nuevo servicio' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Fisioterapia lumbar (copia)');
    expect(screen.getByLabelText(/Precio por sesión/)).toHaveValue('150');
  });

  it('solo se asignan profesionales que atienden el área del servicio', () => {
    render(
      <TestSessionProvider asRole="ADMINISTRADOR">
        <ServiceProfessionalsDialog
          service={service}
          professionals={[
            pro({ serviceIds: ['lumbar'] }),
            pro({ id: 'carla', displayName: 'Lic. Carla Vargas', categories: ['ESTETICA'] }),
          ]}
          onClose={() => {}}
        />
      </TestSessionProvider>,
    );
    expect(screen.getByRole('checkbox', { name: 'Lic. Diego Pérez' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Lic. Carla Vargas' })).toBeDisabled();
    expect(screen.getByText(/No atiende fisioterapia/)).toBeInTheDocument();
  });
});
