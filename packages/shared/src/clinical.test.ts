import { describe, expect, it } from 'vitest';
import {
  canEditNote,
  canRecordSession,
  painChange,
  painLabel,
  sessionNoteInputSchema,
} from './clinical';
import { hasPermission } from './permissions';

const start = new Date('2026-09-28T13:00:00Z');

describe('registro de la sesión', () => {
  it('se registra desde la hora de inicio, nunca en citas canceladas o perdidas', () => {
    const before = new Date(start.getTime() - 60_000);
    expect(canRecordSession({ status: 'CONFIRMADA', startAt: start }, before).ok).toBe(false);
    expect(canRecordSession({ status: 'CONFIRMADA', startAt: start }, start).ok).toBe(true);
    expect(canRecordSession({ status: 'ATENDIDA', startAt: start }, before).ok).toBe(true);
    expect(canRecordSession({ status: 'CANCELADA', startAt: start }, start).ok).toBe(false);
    expect(canRecordSession({ status: 'NO_ASISTIO', startAt: start }, start).ok).toBe(false);
  });

  it('las observaciones son obligatorias y el dolor va de 0 a 10', () => {
    const ok = sessionNoteInputSchema.parse({ appointmentId: 'a', observations: 'TENS 15 min' });
    expect(ok).toMatchObject({ evolution: null, painBefore: null, painAfter: null });
    expect(
      sessionNoteInputSchema.safeParse({ appointmentId: 'a', observations: ' ' }).success,
    ).toBe(false);
    expect(
      sessionNoteInputSchema.safeParse({ appointmentId: 'a', observations: 'x x x', painAfter: 11 })
        .success,
    ).toBe(false);
  });
});

describe('edición de notas', () => {
  const note = { createdAt: new Date('2026-09-28T14:00:00Z'), createdBy: { uid: 'u-diego' } };
  const soon = new Date('2026-09-30T10:00:00Z');
  const late = new Date('2026-10-10T10:00:00Z');

  it('el autor la edita 7 días; otro profesional nunca; la administración siempre', () => {
    expect(canEditNote(note, { uid: 'u-diego', isAdmin: false }, soon).ok).toBe(true);
    expect(canEditNote(note, { uid: 'u-diego', isAdmin: false }, late).ok).toBe(false);
    expect(canEditNote(note, { uid: 'u-carla', isAdmin: false }, soon).ok).toBe(false);
    expect(canEditNote(note, { uid: 'u-admin', isAdmin: true }, late).ok).toBe(true);
  });
});

describe('escala de dolor', () => {
  it('nombra el nivel y calcula el cambio en la sesión', () => {
    expect([0, 2, 5, 8, 10].map(painLabel)).toEqual([
      'Sin dolor',
      'Leve',
      'Moderado',
      'Intenso',
      'Máximo',
    ]);
    expect(painChange({ painBefore: 7, painAfter: 4 })).toBe(-3);
    expect(painChange({ painBefore: 7, painAfter: null })).toBeNull();
  });
});

describe('permisos clínicos', () => {
  it('la recepción no tiene ningún permiso clínico', () => {
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'clinical.read')).toBe(false);
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'clinical.write')).toBe(false);
  });
});
