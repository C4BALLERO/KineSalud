import { clinicDateTime, type Slot } from '@kinesalud/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import type { AgendaAppointment } from './api/appointments';
import { AppointmentBlock } from './components/AppointmentBlock';
import { SlotPicker } from './components/SlotPicker';
import {
  assignLanes,
  availableActions,
  canRescheduleNow,
  gridBounds,
  type AppointmentPermissions,
} from './model';

const DAY = '2026-09-28';

function appt(over: Partial<AgendaAppointment> = {}): AgendaAppointment {
  return {
    id: 'a1',
    clientId: 'cli-1',
    clientName: 'Carla Rojas',
    professionalId: 'diego',
    professionalName: 'Lic. Diego Pérez',
    roomId: 'c1',
    roomName: 'Camilla 1',
    serviceId: 'lumbar',
    serviceName: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    treatmentId: null,
    sessionNumber: 4,
    date: DAY,
    startAt: clinicDateTime(DAY, '09:00'),
    endAt: clinicDateTime(DAY, '09:45'),
    status: 'CONFIRMADA',
    cancelReason: null,
    bufferMin: 15,
    notes: null,
    priceCents: 15000,
    paymentStatus: 'POR_COBRAR',
    paymentId: null,
    sessionRecorded: false,
    createdBy: null,
    ...over,
  };
}

const frontDesk: AppointmentPermissions = {
  manageAll: true,
  canConfirm: true,
  canMarkAttendance: true,
  canCorrect: false,
};

describe('geometría de la grilla', () => {
  it('reparte en carriles las citas superpuestas', () => {
    const a = appt({ id: 'a' });
    const b = appt({
      id: 'b',
      startAt: clinicDateTime(DAY, '09:30'),
      endAt: clinicDateTime(DAY, '10:15'),
    });
    const c = appt({
      id: 'c',
      startAt: clinicDateTime(DAY, '11:00'),
      endAt: clinicDateTime(DAY, '11:45'),
    });
    const lanes = assignLanes([c, b, a]);
    const byId = Object.fromEntries(lanes.map((l) => [l.item.id, l]));
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 });
    expect(byId.c).toMatchObject({ lane: 0, lanes: 1 });
  });

  it('muestra el horario del consultorio y cualquier cita fuera de él', () => {
    expect(gridBounds([{ start: '08:30', end: '12:00' }], [])).toEqual({ start: 480, end: 720 });
    const late = appt({
      startAt: clinicDateTime(DAY, '19:00'),
      endAt: clinicDateTime(DAY, '19:45'),
    });
    expect(gridBounds([{ start: '08:00', end: '12:00' }], [late]).end).toBe(20 * 60);
  });
});

describe('acciones de la cita', () => {
  const before = clinicDateTime(DAY, '08:00');
  const after = clinicDateTime(DAY, '09:10');

  it('antes de la hora: confirmar y cancelar; asistencia deshabilitada con motivo', () => {
    const actions = availableActions(appt({ status: 'PENDIENTE' }), frontDesk, before);
    expect(actions.map((a) => [a.action, a.enabled])).toEqual([
      ['CONFIRMAR', true],
      ['ATENDER', false],
      ['NO_ASISTIO', false],
      ['CANCELAR', true],
    ]);
    expect(actions[1]?.reason).toMatch(/desde la hora de inicio/);
  });

  it('el profesional no cancela ni reprograma; las citas cerradas no tienen acciones', () => {
    const own: AppointmentPermissions = { ...frontDesk, manageAll: false };
    expect(availableActions(appt(), own, after).map((a) => a.action)).toEqual([
      'ATENDER',
      'NO_ASISTIO',
    ]);
    expect(canRescheduleNow(appt(), own)).toBe(false);
    expect(availableActions(appt({ status: 'ATENDIDA' }), frontDesk, after)).toEqual([]);
    expect(canRescheduleNow(appt({ status: 'CANCELADA' }), frontDesk)).toBe(false);
  });
});

describe('componentes', () => {
  it('el bloque de cita describe todo en su nombre accesible y abre el detalle', async () => {
    const onOpen = vi.fn();
    render(
      <AppointmentBlock appointment={appt({ status: 'CANCELADA' })} style={{}} onOpen={onOpen} />,
    );
    const button = screen.getByRole('button', {
      name: '09:00 a 09:45, Carla Rojas, Fisioterapia lumbar, Fisioterapia, Lic. Diego Pérez, Camilla 1, Cancelada',
    });
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith('a1');
  });

  it('el selector de horarios agrupa por mañana y tarde como opciones de radio', async () => {
    const slots: Slot[] = [
      { start: '09:00', end: '09:45', professionalId: 'diego', roomId: 'c1' },
      { start: '15:00', end: '15:45', professionalId: 'ana', roomId: 'c2' },
    ];
    const onChange = vi.fn();
    render(
      <TestSessionProvider>
        <SlotPicker
          slots={slots}
          value={null}
          onChange={onChange}
          label="Horarios"
          professionalName={(id) => (id === 'ana' ? 'Lic. Ana' : 'Lic. Diego')}
        />
      </TestSessionProvider>,
    );
    expect(screen.getByText('Mañana')).toBeInTheDocument();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '15:00, Lic. Ana' }));
    expect(onChange).toHaveBeenCalledWith(slots[1]);
  });
});
