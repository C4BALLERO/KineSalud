import { CLINIC_LOCALE, CLINIC_TIMEZONE } from '@kinesalud/shared';

/** "3400000 CB" (CI con su departamento de expedición). */
export function formatCi(ci: string, ext: string | null): string {
  return ext ? `${ci} ${ext}` : ci;
}

/** Celular "7123 4567", fijo "425 6789". */
export function formatPhone(phone: string): string {
  if (phone.length === 8) return `${phone.slice(0, 4)} ${phone.slice(4)}`;
  if (phone.length === 7) return `${phone.slice(0, 3)} ${phone.slice(3)}`;
  return phone;
}

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

const timeFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "09:30" en la zona horaria del consultorio. */
export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

/** Una fecha `YYYY-MM-DD` interpretada al mediodía local (evita saltos de día por zona horaria). */
function dateKeyToDate(key: string): Date {
  return new Date(`${key}T12:00:00-04:00`);
}

const dayLongFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "lunes 28 de septiembre". */
export function formatDayLong(key: string): string {
  return dayLongFormat.format(dateKeyToDate(key)).replace(',', '');
}

const dateLongFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "3 de marzo de 1990", para fechas de nacimiento y documentos. */
export function formatDateLong(key: string): string {
  return dateLongFormat.format(dateKeyToDate(key));
}

/** Primera letra en mayúscula (no usar `capitalize` de CSS: afecta a cada palabra). */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const dayShortFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
});

/** "lun 28". */
export function formatDayShort(key: string): string {
  return dayShortFormat.format(dateKeyToDate(key)).replace(/[.,]/g, '');
}

const dayMonthFormat = new Intl.DateTimeFormat(CLINIC_LOCALE, {
  timeZone: CLINIC_TIMEZONE,
  day: 'numeric',
  month: 'long',
});

/** "5 de octubre". */
export function formatDayMonth(key: string): string {
  return dayMonthFormat.format(dateKeyToDate(key));
}

/** "7 de octubre", "5 al 9 de octubre" o "28 de septiembre al 2 de octubre". */
export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDayMonth(from);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${Number(from.slice(8))} al ${formatDayMonth(to)}`;
  }
  return `${formatDayMonth(from)} al ${formatDayMonth(to)}`;
}

/** Saludo según la hora local del consultorio. */
export function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: CLINIC_TIMEZONE,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
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

const moneyFormat = new Intl.NumberFormat(CLINIC_LOCALE, { style: 'currency', currency: 'BOB' });

/** "Bs 1.350,50" a partir de centavos. */
export function formatMoney(cents: number): string {
  return moneyFormat.format(cents / 100);
}
