import { describe, expect, it } from 'vitest';
import { createUserInputSchema, newPasswordSchema } from './users';

describe('createUserInputSchema', () => {
  it('normaliza correo y nombre', () => {
    const r = createUserInputSchema.parse({
      displayName: '  Lucía Mendoza ',
      email: ' Recepcion@KineSalud.test ',
      role: 'RECEPCIONISTA',
    });
    expect(r).toEqual({
      displayName: 'Lucía Mendoza',
      email: 'recepcion@kinesalud.test',
      role: 'RECEPCIONISTA',
      professionalId: null,
    });
  });

  it('rechaza correos inválidos con un mensaje comprensible', () => {
    const r = createUserInputSchema.safeParse({
      displayName: 'Ana',
      email: 'ana@',
      role: 'PROFESIONAL',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Ingresa un correo electrónico válido.');
  });

  it('rechaza roles inexistentes', () => {
    const r = createUserInputSchema.safeParse({
      displayName: 'Ana Pérez',
      email: 'a@b.co',
      role: 'ROOT',
    });
    expect(r.success).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it.each([
    ['corta', 'abc12'],
    ['sin número', 'solamenteletras'],
    ['sin letra', '1234567890'],
  ])('rechaza una contraseña %s', (_, value) => {
    expect(newPasswordSchema.safeParse(value).success).toBe(false);
  });

  it('acepta una contraseña con letras y números', () => {
    expect(newPasswordSchema.safeParse('Kinesalud2026').success).toBe(true);
  });
});
