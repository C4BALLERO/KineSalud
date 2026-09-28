import { describe, expect, it } from 'vitest';
import {
  ageOn,
  buildClientSearchKeywords,
  clientInputSchema,
  normalizeCi,
  normalizePhone,
  normalizeSearchText,
  searchTermFor,
} from './clients';

describe('normalización', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizeSearchText('  María  José ÁLVAREZ ')).toBe('maria jose alvarez');
  });
  it('normaliza CI y teléfono', () => {
    expect(normalizeCi('1234567-1a')).toBe('12345671A');
    expect(normalizePhone('+591 712-34567')).toBe('71234567');
    expect(normalizePhone('4 4256789')).toBe('44256789');
  });
});

describe('buildClientSearchKeywords', () => {
  const kw = buildClientSearchKeywords({
    firstName: 'María José',
    lastName: 'Rojas Vda.',
    ci: '3400000',
    phone: '71234567',
  });

  it('incluye prefijos de cada nombre y apellido, sin tildes', () => {
    expect(kw).toEqual(expect.arrayContaining(['m', 'mar', 'maria', 'jo', 'jose', 'roj', 'rojas']));
  });
  it('incluye prefijos de CI y teléfono', () => {
    expect(kw).toEqual(expect.arrayContaining(['340', '3400000', '712', '71234567']));
  });
  it('no repite palabras clave', () => {
    expect(new Set(kw).size).toBe(kw.length);
  });
});

describe('searchTermFor', () => {
  it('usa la primera palabra normalizada', () => {
    expect(searchTermFor('  Rojás Vargas')).toBe('rojas');
    expect(searchTermFor('712-345')).toBe('712345');
    expect(searchTermFor('   ')).toBeNull();
  });
});

describe('clientInputSchema', () => {
  const valid = {
    firstName: ' Carla ',
    lastName: 'Rojas Vda.',
    ci: '3400000',
    ciExt: 'CB',
    phone: '712 34567',
    email: '',
    birthDate: '1990-05-14',
    address: '',
    adminNotes: '',
  };

  it('acepta y normaliza un cliente válido', () => {
    expect(clientInputSchema.parse(valid)).toEqual({
      firstName: 'Carla',
      lastName: 'Rojas Vda.',
      ci: '3400000',
      ciExt: 'CB',
      phone: '71234567',
      email: null,
      birthDate: '1990-05-14',
      address: null,
      adminNotes: null,
    });
  });

  it.each([
    ['nombre vacío', { firstName: '' }, 'Ingresa los nombres.'],
    ['nombre con números', { firstName: 'C4rla' }, 'Usa solo letras, espacios, puntos o guiones.'],
    [
      'CI corto',
      { ci: '12' },
      'El carnet debe tener entre 4 y 10 dígitos (y complemento opcional).',
    ],
    ['teléfono inválido', { phone: '123' }, 'Ingresa un celular de 8 dígitos o un fijo de 7.'],
    ['correo inválido', { email: 'carla@' }, 'Ingresa un correo electrónico válido.'],
    ['fecha futura', { birthDate: '2999-01-01' }, 'La fecha de nacimiento no puede ser futura.'],
  ])('rechaza %s con un mensaje claro', (_, patch, message) => {
    const r = clientInputSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });
});

describe('ageOn', () => {
  it('calcula la edad cumplida', () => {
    expect(ageOn('1990-09-28', '2026-09-28')).toBe(36);
    expect(ageOn('1990-09-29', '2026-09-28')).toBe(35);
  });
});
