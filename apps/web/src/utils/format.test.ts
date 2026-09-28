import { describe, expect, it } from 'vitest';
import { formatRelative, initialsOf } from './format';

describe('initialsOf', () => {
  it('toma la inicial del nombre y del primer apellido', () => {
    expect(initialsOf('Carla Rojas Vda.')).toBe('CR');
  });
  it('funciona con un solo nombre y espacios extra', () => {
    expect(initialsOf('  ana ')).toBe('A');
  });
  it('devuelve "?" si el nombre está vacío', () => {
    expect(initialsOf('')).toBe('?');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  it('usa "hace un momento" por debajo de un minuto', () => {
    expect(formatRelative(new Date('2026-09-27T11:59:30Z'), now)).toBe('hace un momento');
  });
  it('expresa minutos, días y semanas', () => {
    expect(formatRelative(new Date('2026-09-27T11:55:00Z'), now)).toBe('hace 5 minutos');
    expect(formatRelative(new Date('2026-09-26T12:00:00Z'), now)).toBe('ayer');
    expect(formatRelative(new Date('2026-09-13T12:00:00Z'), now)).toBe('hace 2 semanas');
  });
});
