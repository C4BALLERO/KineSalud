/** Zona horaria única del consultorio (Bolivia, UTC−4, sin horario de verano). */
export const CLINIC_TIMEZONE = 'America/La_Paz';

/** Locale para formatos de fecha, número y ordenamiento. */
export const CLINIC_LOCALE = 'es-BO';

/** Fecha local del consultorio en formato `YYYY-MM-DD` (clave de consulta por día). */
export type DateKey = string;

const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Día (en la zona del consultorio) al que pertenece un instante. */
export function toDateKey(instant: Date): DateKey {
  return dateKeyFormat.format(instant);
}

function parseKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function fromUtcDate(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

/** Día de la semana de una fecha (lunes = 'mon'). */
export function weekdayOf(key: DateKey): Weekday {
  const jsDay = parseKey(key).getUTCDay(); // 0 = domingo
  return WEEKDAYS[(jsDay + 6) % 7]!;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -WEEKDAYS.indexOf(weekdayOf(key)));
}

/**
 * Instante correspondiente a una fecha y hora locales del consultorio.
 * Bolivia no tiene horario de verano: el desfase es siempre UTC−4.
 */
export function clinicDateTime(key: DateKey, time: string): Date {
  return new Date(`${key}T${time}:00-04:00`);
}
