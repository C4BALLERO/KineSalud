import type { ProfessionalData } from '@kinesalud/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { toEditableWeek, validateWeek } from '@/components/domain/scheduleEditorModel';
import { WeeklyScheduleEditor } from '@/components/domain/WeeklyScheduleEditor';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { formatDateRange } from '@/utils/format';
import { ProfessionalForm } from './components/ProfessionalForm';
import { availabilitySummary, EMPTY_PROFESSIONAL_FORM } from './model';

vi.mock('@/features/settings/api/catalog', () => ({
  useServices: () => ({
    status: 'success',
    retry: () => undefined,
    data: [
      {
        id: 'srv-lumbar',
        name: 'Fisioterapia lumbar',
        category: 'FISIOTERAPIA',
        durationMin: 45,
        active: true,
      },
      {
        id: 'srv-facial',
        name: 'Limpieza facial',
        category: 'ESTETICA',
        durationMin: 60,
        active: true,
      },
      {
        id: 'srv-viejo',
        name: 'Servicio retirado',
        category: 'FISIOTERAPIA',
        durationMin: 30,
        active: false,
      },
    ],
  }),
}));

const morning = [{ start: '08:00', end: '12:00' }];

describe('validación del horario', () => {
  it('marca solo los días con errores', () => {
    const week = toEditableWeek({
      mon: morning,
      tue: [{ start: '12:00', end: '09:00' }],
      wed: [
        { start: '08:00', end: '11:00' },
        { start: '10:00', end: '12:00' },
      ],
    });
    expect(validateWeek(week)).toEqual({
      tue: 'La hora de fin debe ser posterior a la de inicio.',
      wed: 'Los tramos del día no pueden superponerse.',
    });
  });

  it('exige quedar dentro del horario del consultorio', () => {
    const week = toEditableWeek({ mon: [{ start: '07:00', end: '12:00' }], sun: morning });
    const errors = validateWeek(week, { mon: morning });
    expect(errors.mon).toBe('Debe estar dentro del horario del consultorio (08:00–12:00).');
    expect(errors.sun).toBe('El consultorio no atiende este día.');
  });
});

describe('disponibilidad del día', () => {
  const pro = { active: true, weeklySchedule: { mon: morning } };

  it('resume horario, ausencias e inactividad', () => {
    expect(availabilitySummary(pro, [], '2026-09-28')).toEqual({
      tone: 'success',
      label: 'Atiende hoy',
      detail: '08:00–12:00',
    });
    expect(
      availabilitySummary(
        pro,
        [
          {
            id: 'e1',
            professionalId: 'p',
            type: 'VACACIONES',
            dateFrom: '2026-09-28',
            dateTo: '2026-10-02',
            note: null,
            createdBy: null,
          },
        ],
        '2026-09-28',
      ),
    ).toMatchObject({ tone: 'warning', label: 'Vacaciones', detail: 'Hasta el 2 de octubre' });
    expect(availabilitySummary(pro, [], '2026-09-29').label).toBe('No atiende hoy');
    expect(availabilitySummary({ ...pro, active: false }, [], '2026-09-28').label).toBe('Inactivo');
  });

  it('formatea rangos de fechas', () => {
    expect(formatDateRange('2026-10-07', '2026-10-07')).toBe('7 de octubre');
    expect(formatDateRange('2026-10-05', '2026-10-09')).toBe('5 al 9 de octubre');
    expect(formatDateRange('2026-09-28', '2026-10-02')).toBe('28 de septiembre al 2 de octubre');
  });
});

describe('WeeklyScheduleEditor', () => {
  function Harness() {
    const [week, setWeek] = useState(toEditableWeek({ mon: morning }));
    return (
      <>
        <WeeklyScheduleEditor
          value={week}
          onChange={setWeek}
          reference={{ mon: morning, tue: morning }}
        />
        <output data-testid="week">{JSON.stringify(week)}</output>
      </>
    );
  }

  it('habilita un día con el horario del consultorio y bloquea los días cerrados', async () => {
    render(
      <TestSessionProvider>
        <Harness />
      </TestSessionProvider>,
    );
    expect(screen.getByRole('checkbox', { name: 'Domingo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Martes' }));
    expect(JSON.parse(screen.getByTestId('week').textContent!).tue).toEqual(morning);
    expect(screen.getByLabelText('Martes, tramo 1: desde')).toHaveValue('08:00');

    await userEvent.click(screen.getByRole('button', { name: 'Quitar tramo 1 del martes' }));
    expect(JSON.parse(screen.getByTestId('week').textContent!).tue).toEqual([]);
  });
});

function renderForm(onSubmit: (data: ProfessionalData) => Promise<void>) {
  const router = createMemoryRouter(
    [
      {
        path: '/personal/nuevo',
        element: (
          <ProfessionalForm
            defaultValues={EMPTY_PROFESSIONAL_FORM}
            submitLabel="Registrar profesional"
            cancelTo="/personal"
            onSubmit={onSubmit}
          />
        ),
      },
    ],
    { initialEntries: ['/personal/nuevo'] },
  );
  render(
    <TestSessionProvider asRole="ADMINISTRADOR">
      <RouterProvider router={router} />
    </TestSessionProvider>,
  );
}

describe('ProfessionalForm', () => {
  it('exige nombres, apellidos y al menos un área', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar profesional' }));
    expect(await screen.findByText('Ingresa los nombres.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa los apellidos.')).toBeInTheDocument();
    expect(screen.getByText('Elige al menos un área de atención.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('muestra los servicios del área elegida y envía los datos normalizados', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    expect(screen.getByText('Elige primero las áreas de atención.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^Nombres/), 'Diego');
    await userEvent.type(screen.getByLabelText(/^Apellidos/), 'Pérez');
    await userEvent.type(screen.getByLabelText(/^Celular/), '7123 4567');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fisioterapia' }));
    // Los servicios desactivados no se ofrecen para nuevas asignaciones.
    expect(screen.queryByRole('checkbox', { name: 'Servicio retirado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Limpieza facial' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fisioterapia lumbar' }));
    await userEvent.type(screen.getByLabelText(/^Especialidades/), 'Deportiva, Neurológica');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar profesional' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: 'Lic.',
      firstName: 'Diego',
      lastName: 'Pérez',
      phone: '71234567',
      categories: ['FISIOTERAPIA'],
      serviceIds: ['srv-lumbar'],
      specialties: ['Deportiva', 'Neurológica'],
    });
  });

  it('al quitar un área también quita sus servicios', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/^Nombres/), 'Carla');
    await userEvent.type(screen.getByLabelText(/^Apellidos/), 'Vargas');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fisioterapia' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Estética' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fisioterapia lumbar' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Limpieza facial' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fisioterapia' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar profesional' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      categories: ['ESTETICA'],
      serviceIds: ['srv-facial'],
    });
  });
});
