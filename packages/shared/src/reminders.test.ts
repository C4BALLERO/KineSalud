import { describe, expect, it } from 'vitest';
import {
  handleReminderInputSchema,
  isReminderPending,
  reminderMessage,
  reminderPlan,
  whatsappUrl,
} from './reminders';
import { clinicDateTime } from './time';

const NOW = new Date('2026-09-28T12:00:00Z');

describe('plan del recordatorio', () => {
  it('se programa con la anticipación configurada y pide confirmar si la cita está pendiente', () => {
    const startAt = new Date(NOW.getTime() + 48 * 3_600_000);
    expect(reminderPlan({ status: 'PENDIENTE', startAt }, 24, NOW)).toEqual({
      action: 'schedule',
      scheduledFor: new Date(NOW.getTime() + 24 * 3_600_000),
      type: 'CONFIRMACION',
    });
    expect(reminderPlan({ status: 'CONFIRMADA', startAt }, 2, NOW)).toMatchObject({
      type: 'RECORDATORIO',
    });
  });

  it('se anula para citas cerradas o que ya empezaron', () => {
    const future = new Date(NOW.getTime() + 3_600_000);
    expect(reminderPlan({ status: 'CANCELADA', startAt: future }, 24, NOW)).toEqual({
      action: 'cancel',
    });
    expect(reminderPlan({ status: 'PENDIENTE', startAt: NOW }, 24, NOW)).toEqual({
      action: 'cancel',
    });
  });

  it('solo "por gestionar" y "sin respuesta" esperan acción de recepción', () => {
    expect(isReminderPending('ENVIADO')).toBe(true);
    expect(isReminderPending('SIN_RESPUESTA')).toBe(true);
    expect(isReminderPending('PROGRAMADO')).toBe(false);
    expect(isReminderPending('CONFIRMADO')).toBe(false);
  });
});

describe('mensaje al cliente', () => {
  const reminder = {
    clientName: 'Carla Rojas',
    serviceName: 'Fisioterapia lumbar',
    professionalName: 'Lic. Diego Pérez',
    appointmentStartAt: clinicDateTime('2026-09-30', '09:30'),
    type: 'CONFIRMACION' as const,
  };

  it('usa el nombre de pila, el día y la hora del consultorio, sin datos clínicos', () => {
    const text = reminderMessage(reminder, 'Kinesalud y Vida');
    expect(text).toBe(
      'Hola Carla, le recordamos su cita de Fisioterapia lumbar en Kinesalud y Vida el miércoles 30 de septiembre a las 09:30 con Lic. Diego Pérez. ¿Nos confirma su asistencia? Si necesita cambiar el horario, responda este mensaje.',
    );
  });

  it('arma el enlace de WhatsApp sin "+" y con el texto codificado', () => {
    expect(whatsappUrl('+59171234567', 'Hola ¿todo bien?')).toBe(
      'https://wa.me/59171234567?text=Hola%20%C2%BFtodo%20bien%3F',
    );
  });

  it('cancelar exige un motivo', () => {
    expect(
      handleReminderInputSchema.safeParse({ reminderId: 'r', outcome: 'CANCELADO' }).success,
    ).toBe(false);
    expect(
      handleReminderInputSchema.safeParse({ reminderId: 'r', outcome: 'SIN_RESPUESTA' }).success,
    ).toBe(true);
  });
});
