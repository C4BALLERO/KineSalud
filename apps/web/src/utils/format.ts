import { CLINIC_LOCALE, CLINIC_TIMEZONE } from '@kinesalud/shared';

/** Iniciales a partir del nombre completo: "Carla Rojas Vda." → "CR". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

const dateTimeFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "27 sept 2026, 14:05" en la zona horaria del consultorio. */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "hace 5 minutos", "ayer", "hace 3 semanas". Por debajo de un minuto: "hace un momento". */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return 'hace un momento';
}
