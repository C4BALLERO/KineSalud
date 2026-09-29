import { describe, expect, it } from 'vitest';
import { addDays, toDateKey } from './time';
import {
  canApplyTreatmentAction,
  createTreatmentInputSchema,
  minPlannedSessions,
  treatmentActionNeedsReason,
} from './treatments';

const active = { status: 'ACTIVO' as const, plannedSessions: 10, completedSessions: 4 };

describe('estados del tratamiento', () => {
  it('no finaliza ni suspende con citas agendadas por delante', () => {
    const check = canApplyTreatmentAction(active, 'FINALIZAR', 2);
    expect(check).toEqual({
      ok: false,
      reason: 'Tiene 2 citas agendadas de este tratamiento. Cancélalas antes de finalizarlo.',
    });
    expect(canApplyTreatmentAction(active, 'SUSPENDER', 0).ok).toBe(true);
  });

  it('solo se suspende uno activo y se reactiva uno suspendido o finalizado', () => {
    const suspended = { ...active, status: 'SUSPENDIDO' as const };
    expect(canApplyTreatmentAction(suspended, 'SUSPENDER', 0).ok).toBe(false);
    expect(canApplyTreatmentAction(suspended, 'REACTIVAR', 0).ok).toBe(true);
    expect(canApplyTreatmentAction(active, 'REACTIVAR', 0).ok).toBe(false);
    expect(canApplyTreatmentAction(suspended, 'FINALIZAR', 0).ok).toBe(true);
  });

  it('pide motivo al suspender, al finalizar antes de tiempo y al reabrir', () => {
    expect(treatmentActionNeedsReason(active, 'SUSPENDER')).toBe(true);
    expect(treatmentActionNeedsReason(active, 'FINALIZAR')).toBe(true);
    expect(treatmentActionNeedsReason({ ...active, completedSessions: 10 }, 'FINALIZAR')).toBe(
      false,
    );
    expect(treatmentActionNeedsReason({ ...active, status: 'FINALIZADO' }, 'REACTIVAR')).toBe(true);
    expect(treatmentActionNeedsReason({ ...active, status: 'SUSPENDIDO' }, 'REACTIVAR')).toBe(
      false,
    );
  });

  it('las sesiones previstas no bajan de las realizadas más las agendadas', () => {
    expect(minPlannedSessions(4, 2)).toBe(6);
    expect(minPlannedSessions(0, 0)).toBe(1);
  });
});

describe('nuevo tratamiento', () => {
  const base = { clientId: 'c', serviceId: 's', professionalId: 'p', plannedSessions: 10 };

  it('acepta un inicio reciente o próximo y rechaza fechas lejanas', () => {
    const today = toDateKey(new Date());
    expect(createTreatmentInputSchema.safeParse({ ...base, startDate: today }).success).toBe(true);
    expect(
      createTreatmentInputSchema.safeParse({ ...base, startDate: addDays(today, -400) }).success,
    ).toBe(false);
    expect(
      createTreatmentInputSchema.safeParse({ ...base, startDate: addDays(today, 120) }).success,
    ).toBe(false);
  });

  it('exige servicio y profesional con mensajes claros', () => {
    const r = createTreatmentInputSchema.safeParse({
      ...base,
      serviceId: '',
      startDate: toDateKey(new Date()),
    });
    expect(r.error?.issues[0]?.message).toBe('Elige el servicio.');
  });
});
