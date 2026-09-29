import {
  canCharge,
  emptyMethodTotals,
  totalOf,
  type Cents,
  type MethodTotals,
  type PaymentStatus,
} from '@kinesalud/shared';
import type { AgendaAppointment } from '@/features/appointments/api/appointments';
import { formatMoney } from '@/utils/format';

export interface PaymentSums {
  total: Cents;
  count: number;
  byMethod: MethodTotals;
}

/** Suma de los cobros válidos (los anulados no cuentan). */
export function sumPayments(
  payments: readonly { status: PaymentStatus; method: keyof MethodTotals; amountCents: Cents }[],
): PaymentSums {
  const byMethod = emptyMethodTotals();
  let count = 0;
  for (const p of payments) {
    if (p.status !== 'VALIDO') continue;
    byMethod[p.method] += p.amountCents;
    count += 1;
  }
  return { total: totalOf(byMethod), count, byMethod };
}

/** Citas de hoy que todavía se pueden cobrar, en orden de hora. */
export function chargeable(appointments: readonly AgendaAppointment[]): AgendaAppointment[] {
  return appointments.filter(canCharge);
}

export interface DifferenceView {
  tone: 'success' | 'warning' | 'danger';
  label: string;
}

/** "Cuadra", "Sobran Bs 10,00" o "Faltan Bs 10,00". */
export function differenceView(diff: Cents): DifferenceView {
  if (diff === 0) return { tone: 'success', label: 'Cuadra' };
  if (diff > 0) return { tone: 'warning', label: `Sobran ${formatMoney(diff)}` };
  return { tone: 'danger', label: `Faltan ${formatMoney(-diff)}` };
}

export interface IncomeDay {
  date: string;
  cents: Cents;
}

/** Días del mes hasta hoy (o completos si es un mes pasado), con su ingreso. */
export function incomeByDay(
  month: string,
  byDay: Record<string, Cents>,
  today: string,
): IncomeDay[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = today.startsWith(month) ? Number(today.slice(8, 10)) : daysInMonth;
  return Array.from({ length: last }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0');
    return { date: `${month}-${dd}`, cents: byDay[dd] ?? 0 };
  });
}
