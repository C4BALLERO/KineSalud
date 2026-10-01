import {
  addDays,
  APPOINTMENT_STATUSES,
  bucketOf,
  bucketsBetween,
  daysBetween,
  emptyStatusCounts,
  granularityFor,
  MAX_REPORT_DAYS,
  startOfWeek,
  type DailyIncomeDoc,
  type DateKey,
  type Granularity,
  type StatusCounts,
} from '@kinesalud/shared';
import { formatDayMonth, formatDayShort } from '@/utils/format';

/* ---------- Períodos ---------- */

export const PRESETS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: '30-dias', label: 'Últimos 30 días' },
  { value: 'anio', label: 'Este año' },
  { value: 'personalizado', label: 'Rango personalizado' },
] as const;
export type Preset = (typeof PRESETS)[number]['value'];

export interface Range {
  from: DateKey;
  to: DateKey;
}

export function rangeForPreset(preset: Exclude<Preset, 'personalizado'>, today: DateKey): Range {
  switch (preset) {
    case 'hoy':
      return { from: today, to: today };
    case 'semana':
      return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) };
    case 'mes':
      return { from: `${today.slice(0, 7)}-01`, to: lastDayOfMonth(today.slice(0, 7)) };
    case 'mes-anterior': {
      const prev = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
      return { from: `${prev}-01`, to: lastDayOfMonth(prev) };
    }
    case '30-dias':
      return { from: addDays(today, -29), to: today };
    case 'anio':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
}

function lastDayOfMonth(month: string): DateKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** Valida un rango personalizado de la URL; devuelve un mensaje si no sirve. */
export function rangeError(range: Range): string | null {
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if (!valid.test(range.from) || !valid.test(range.to)) return 'Elige las dos fechas del rango.';
  if (range.from > range.to) return 'La fecha de inicio debe ser anterior a la de fin.';
  if (daysBetween(range.from, range.to) > MAX_REPORT_DAYS) {
    return `El rango no puede superar ${MAX_REPORT_DAYS} días.`;
  }
  return null;
}

/* ---------- Series para los gráficos ---------- */

export interface Bucket<T> {
  key: string;
  label: string;
  /** Texto largo para tooltip y nombre accesible. */
  longLabel: string;
  value: T;
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
];

function bucketLabels(key: string, granularity: Granularity): { label: string; longLabel: string } {
  if (granularity === 'day') {
    return { label: formatDayShort(key), longLabel: formatDayMonth(key) };
  }
  if (granularity === 'week') {
    return {
      label: formatDayMonth(key).replace(' de ', ' '),
      longLabel: `Semana del ${formatDayMonth(key)}`,
    };
  }
  const month = MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
  return { label: month, longLabel: `${month} ${key.slice(0, 4)}` };
}

/** Citas por estado agrupadas por día, semana o mes (incluye grupos vacíos). */
export function statusSeries(
  byDay: Map<DateKey, StatusCounts>,
  range: Range,
): { granularity: Granularity; buckets: Bucket<StatusCounts>[] } {
  const granularity = granularityFor(range.from, range.to);
  const totals = new Map<string, StatusCounts>();
  for (const [date, counts] of byDay) {
    const key = bucketOf(date, granularity);
    const t = totals.get(key) ?? emptyStatusCounts();
    for (const s of APPOINTMENT_STATUSES) t[s] += counts[s];
    totals.set(key, t);
  }
  return {
    granularity,
    buckets: bucketsBetween(range.from, range.to, granularity).map((key) => ({
      key,
      ...bucketLabels(key, granularity),
      value: totals.get(key) ?? emptyStatusCounts(),
    })),
  };
}

export function incomeSeries(days: readonly DailyIncomeDoc[], range: Range): Bucket<number>[] {
  const granularity = granularityFor(range.from, range.to);
  const totals = new Map<string, number>();
  for (const d of days) {
    const key = bucketOf(d.date, granularity);
    totals.set(key, (totals.get(key) ?? 0) + d.totalCents);
  }
  return bucketsBetween(range.from, range.to, granularity).map((key) => ({
    key,
    ...bucketLabels(key, granularity),
    value: totals.get(key) ?? 0,
  }));
}

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: 'por día',
  week: 'por semana',
  month: 'por mes',
};

/* ---------- Formato y exportación ---------- */

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)} %`;
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * CSV con separador ";" y BOM UTF-8: así Excel en español lo abre con las
 * columnas y las tildes correctas.
 */
export function toCsv(rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return String.fromCharCode(0xfeff) + rows.map((r) => r.map(escape).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
