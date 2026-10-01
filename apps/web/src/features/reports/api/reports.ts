import type {
  DailyIncomeDoc,
  DailyStatsDoc,
  DateKey,
  RebuildReportsInput,
} from '@kinesalud/shared';
import { useMutation } from '@tanstack/react-query';
import { collection, query, where } from 'firebase/firestore';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { db } from '@/lib/firebase';

/** Resúmenes diarios de citas del período (un documento por día con actividad). */
export function useDailyStats(from: DateKey, to: DateKey) {
  return useLiveQuery(
    `dailyStats|${from}|${to}`,
    () => query(collection(db, 'dailyStats'), where('date', '>=', from), where('date', '<=', to)),
    (d) => d.data() as DailyStatsDoc,
  );
}

/** Ingresos por día del período (solo administración). */
export function useDailyIncome(from: DateKey, to: DateKey, enabled: boolean) {
  return useLiveQuery(
    enabled ? `dailyIncome|${from}|${to}` : null,
    () => query(collection(db, 'dailyIncome'), where('date', '>=', from), where('date', '<=', to)),
    (d) => d.data() as DailyIncomeDoc,
  );
}

export function useRebuildReports() {
  return useMutation({
    mutationFn: (input: RebuildReportsInput) =>
      callFunction<RebuildReportsInput, { days: number }>('reports-rebuild', input),
  });
}
