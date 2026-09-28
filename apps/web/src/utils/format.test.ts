import { describe, expect, it } from 'vitest';
import {
  formatDateLong,
  formatDayLong,
  formatDayShort,
  formatRelative,
  formatTime,
  greetingFor,
  initialsOf,
} from './format';

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

describe('formatos de fecha del consultorio', () => {
  it('formatea la hora en la zona de Bolivia', () => {
    expect(formatTime(new Date('2026-09-28T13:30:00Z'))).toBe('09:30');
  });
  it('formatea días largos y cortos en español', () => {
    expect(formatDayLong('2026-09-28')).toBe('lunes 28 de septiembre');
    expect(formatDateLong('1990-03-03')).toBe('3 de marzo de 1990');
    expect(formatDayShort('2026-09-28')).toMatch(/^lun 28$/);
  });
  it('saluda según la hora local', () => {
    expect(greetingFor(new Date('2026-09-28T13:00:00Z'))).toBe('Buenos días'); // 09:00
    expect(greetingFor(new Date('2026-09-28T19:00:00Z'))).toBe('Buenas tardes'); // 15:00
    expect(greetingFor(new Date('2026-09-29T01:00:00Z'))).toBe('Buenas noches'); // 21:00
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
