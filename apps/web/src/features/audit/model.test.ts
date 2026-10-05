import { describe, expect, it } from 'vitest';
import { auditActionLabel, auditMetaSummary, auditModuleOf, isClinicalAccess } from './model';

describe('auditoría: presentación', () => {
  it('agrupa por módulo y traduce las acciones conocidas', () => {
    expect(auditModuleOf('payment.void')).toBe('caja');
    expect(auditModuleOf('appointment.no_asistio')).toBe('citas');
    expect(auditActionLabel('appointment.no_asistio')).toBe('Marcó una inasistencia');
    expect(isClinicalAccess('clinical.read')).toBe(true);
    expect(isClinicalAccess('client.update')).toBe(false);
  });

  it('una acción desconocida se muestra con su código, en "Otros"', () => {
    expect(auditActionLabel('nuevo.modulo')).toBe('nuevo.modulo');
    expect(auditModuleOf('nuevo.modulo')).toBe('otros');
  });

  it('el detalle resume solo valores simples y acorta los largos', () => {
    expect(
      auditMetaSummary({
        amount: 15000,
        reason: 'x'.repeat(60),
        voided: true,
        nested: { a: 1 },
        list: [1, 2],
      }),
    ).toBe(`amount: 15000 · reason: ${'x'.repeat(39)}… · voided: sí`);
    expect(auditMetaSummary(undefined)).toBe('');
  });
});
