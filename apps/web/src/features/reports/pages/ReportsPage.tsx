import {
  addDays,
  attendanceRate,
  cancellationRate,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  summarizeStats,
  toDateKey,
  totalAppointments,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type DailyIncomeDoc,
  type TreatmentCategory,
  type WorkloadRow,
} from '@kinesalud/shared';
import { ChartColumn, Download, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { EmptyState, ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/toast-context';
import { IncomeBreakdown } from '@/features/dashboard/components/IncomeChart';
import { useProfessionals } from '@/features/staff/api/staff';
import { useTreatments } from '@/features/treatments/api/treatments';
import { useNow } from '@/hooks/useNow';
import { usePermission } from '@/hooks/usePermission';
import { toAppError } from '@/lib/errors';
import { formatDateRange, formatMoney } from '@/utils/format';
import { useDailyIncome, useDailyStats, useRebuildReports } from '../api/reports';
import { StatusChart, ValueChart } from '../components/ReportCharts';
import {
  downloadCsv,
  formatHours,
  formatPercent,
  GRANULARITY_LABELS,
  incomeSeries,
  PRESETS,
  rangeError,
  rangeForPreset,
  statusSeries,
  toCsv,
  type Preset,
  type Range,
} from '../model';

/**
 * Reportes del consultorio: citas y asistencia, áreas, tratamientos y, para la
 * administración, carga por profesional e ingresos. Lee los resúmenes diarios
 * (`dailyStats`, `dailyIncome`), no las citas una por una.
 */
export function ReportsPage() {
  const now = useNow();
  const today = toDateKey(now);
  const seesWorkload = usePermission('reports.viewWorkload');
  const seesIncome = usePermission('income.view');
  const canRebuild = usePermission('settings.manage');
  const [params, setParams] = useSearchParams();

  const preset: Preset = PRESETS.find((p) => p.value === params.get('periodo'))?.value ?? 'mes';
  const range: Range =
    preset === 'personalizado'
      ? { from: params.get('desde') ?? '', to: params.get('hasta') ?? '' }
      : rangeForPreset(preset, today);
  const invalid = rangeError(range);
  const category =
    TREATMENT_CATEGORIES.find((c) => c === params.get('area')) ??
    (null as TreatmentCategory | null);
  const professionalId = seesWorkload ? params.get('profesional') : null;

  const setParam = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );

  // Con un rango inválido se consulta un día fijo y no se muestra nada.
  const queryRange = invalid ? { from: today, to: today } : range;
  const stats = useDailyStats(queryRange.from, queryRange.to);
  const income = useDailyIncome(queryRange.from, queryRange.to, seesIncome);
  const treatments = useTreatments(null, null);
  const professionals = useProfessionals();
  const names = useMemo(
    () =>
      Object.fromEntries(
        (professionals.status === 'success' ? professionals.data : []).map((p) => [
          p.id,
          p.displayName,
        ]),
      ),
    [professionals],
  );

  const summary = useMemo(
    () =>
      stats.status === 'success' ? summarizeStats(stats.data, { professionalId, category }) : null,
    [stats, professionalId, category],
  );
  const series = summary ? statusSeries(summary.byDay, range) : null;
  const incomeDays = useMemo(
    () => filterIncome(income.status === 'success' ? income.data : [], professionalId, category),
    [income, professionalId, category],
  );

  const exportCsv = () => {
    if (!summary) return;
    const header = [
      'Fecha',
      'Citas',
      'Atendidas',
      'Por atender',
      'No asistió',
      'Canceladas',
      ...(seesIncome ? ['Ingresos (Bs)'] : []),
    ];
    const byDate = new Map(incomeDays.map((d) => [d.date, d]));
    const rows: (string | number)[][] = [header];
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
      const c = summary.byDay.get(d);
      if (!c && !byDate.get(d)) continue;
      const counts = c ?? { PENDIENTE: 0, CONFIRMADA: 0, ATENDIDA: 0, CANCELADA: 0, NO_ASISTIO: 0 };
      rows.push([
        d,
        totalAppointments(counts),
        counts.ATENDIDA,
        counts.PENDIENTE + counts.CONFIRMADA,
        counts.NO_ASISTIO,
        counts.CANCELADA,
        ...(seesIncome
          ? [((byDate.get(d)?.totalCents ?? 0) / 100).toFixed(2).replace('.', ',')]
          : []),
      ]);
    }
    downloadCsv(`reporte-kinesalud_${range.from}_${range.to}.csv`, toCsv(rows));
  };

  const empty = summary && totalAppointments(summary.totals) === 0 && summary.newClients === 0;

  return (
    <>
      <PageHeader
        title="Reportes"
        description={
          seesWorkload
            ? 'Citas, asistencia, tratamientos, carga de trabajo e ingresos del consultorio.'
            : 'Citas, asistencia y tratamientos del consultorio.'
        }
        actions={
          <>
            {canRebuild && !invalid && <RebuildButton range={range} />}
            <Button variant="secondary" onClick={exportCsv} disabled={!summary || !!invalid}>
              <Download aria-hidden="true" />
              Exportar CSV
            </Button>
          </>
        }
      />

      <Panel className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <FormField label="Período" className="lg:w-52">
            {(p) => (
              <Select
                {...p}
                value={preset}
                onChange={(e) => {
                  const value = e.target.value as Preset;
                  const current = preset === 'personalizado' ? null : rangeForPreset(preset, today);
                  setParam({
                    periodo: value === 'mes' ? null : value,
                    desde: value === 'personalizado' ? (current?.from ?? today) : null,
                    hasta: value === 'personalizado' ? (current?.to ?? today) : null,
                  });
                }}
              >
                {PRESETS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          {preset === 'personalizado' && (
            <>
              <FormField label="Desde" className="lg:w-44">
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    value={range.from}
                    onChange={(e) => setParam({ desde: e.target.value })}
                  />
                )}
              </FormField>
              <FormField label="Hasta" className="lg:w-44">
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    value={range.to}
                    onChange={(e) => setParam({ hasta: e.target.value })}
                  />
                )}
              </FormField>
            </>
          )}
          <FormField label="Área" className="lg:w-48">
            {(p) => (
              <Select
                {...p}
                value={category ?? ''}
                onChange={(e) => setParam({ area: e.target.value || null })}
              >
                <option value="">Todas las áreas</option>
                {TREATMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TREATMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          {seesWorkload && (
            <FormField label="Profesional" className="lg:w-56">
              {(p) => (
                <Select
                  {...p}
                  value={professionalId ?? ''}
                  onChange={(e) => setParam({ profesional: e.target.value || null })}
                >
                  <option value="">Todos los profesionales</option>
                  {professionals.status === 'success' &&
                    professionals.data.map((pro) => (
                      <option key={pro.id} value={pro.id}>
                        {pro.displayName}
                      </option>
                    ))}
                </Select>
              )}
            </FormField>
          )}
          {!invalid && series && (
            <p className="text-body-sm text-fg-muted lg:ml-auto lg:pb-2.5">
              {formatDateRange(range.from, range.to)} · {GRANULARITY_LABELS[series.granularity]}
            </p>
          )}
        </div>
      </Panel>

      {invalid ? (
        <InlineAlert tone="warning" title={invalid} />
      ) : stats.status === 'loading' ? (
        <LoadingRegion label="Cargando el reporte" className="flex flex-col gap-6">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </LoadingRegion>
      ) : stats.status === 'error' ? (
        <ErrorState description={stats.error.message} onRetry={stats.retry} />
      ) : empty ? (
        <Panel>
          <EmptyState
            icon={<ChartColumn />}
            title="Sin actividad en el período"
            description={
              canRebuild
                ? 'No hay citas ni clientes nuevos en estas fechas. Si hay datos cargados antes de activar los reportes, usa "Recalcular".'
                : 'No hay citas ni clientes nuevos en estas fechas. Prueba con otro período.'
            }
          />
        </Panel>
      ) : (
        summary &&
        series && (
          <div className="flex flex-col gap-6">
            <Panel>
              <h2 className="sr-only">Indicadores del período</h2>
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6 lg:gap-6">
                <Stat
                  label="Citas"
                  value={totalAppointments(summary.totals)}
                  hint="Agendadas en el período"
                />
                <Stat
                  label="Atendidas"
                  value={summary.totals.ATENDIDA}
                  hint={formatHours(summary.totals.attendedMinutes)}
                />
                <Stat
                  label="Asistencia"
                  value={formatPercent(attendanceRate(summary.totals))}
                  hint={`${summary.totals.NO_ASISTIO} no asistieron`}
                />
                <Stat
                  label="Cancelaciones"
                  value={formatPercent(cancellationRate(summary.totals))}
                  hint={`${summary.totals.CANCELADA} canceladas`}
                />
                <Stat
                  label="Clientes nuevos"
                  value={summary.newClients}
                  hint={professionalId || category ? 'De todo el consultorio' : undefined}
                />
                {seesIncome && (
                  <Stat
                    label="Ingresos"
                    value={
                      income.status === 'success'
                        ? formatMoney(incomeDays.reduce((s, d) => s + d.totalCents, 0))
                        : '—'
                    }
                  />
                )}
              </div>
            </Panel>

            <Panel
              title={`Citas ${GRANULARITY_LABELS[series.granularity]}`}
              description="Por estado. Pasa el cursor sobre una barra para ver el detalle."
            >
              <StatusChart buckets={series.buckets} />
            </Panel>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
              <CategoryPanel summary={summary.byCategory} />
              <TreatmentsPanel
                range={range}
                category={category}
                professionalId={professionalId}
                treatments={treatments.status === 'success' ? treatments.data : null}
              />
            </div>

            {seesWorkload && (
              <WorkloadPanel
                rows={summary.byProfessional}
                names={names}
                income={seesIncome ? incomeDays : null}
              />
            )}

            {seesIncome && (
              <Panel
                title="Ingresos"
                description="Cobros de sesiones registrados en el período (sin los anulados)."
              >
                {income.status === 'loading' && <Skeleton className="h-40 w-full" />}
                {income.status === 'error' && (
                  <ErrorState
                    size="compact"
                    description={income.error.message}
                    onRetry={income.retry}
                  />
                )}
                {income.status === 'success' && <IncomeSection days={incomeDays} range={range} />}
              </Panel>
            )}
          </div>
        )
      )}
    </>
  );
}

/* ---------- Secciones ---------- */

function CategoryPanel({ summary }: { summary: ReturnType<typeof summarizeStats>['byCategory'] }) {
  const rows = TREATMENT_CATEGORIES.filter((c) => summary[c]).map((c) => ({
    category: c,
    ...summary[c]!,
  }));
  return (
    <Panel flush title="Por área">
      {rows.length === 0 ? (
        <p className="p-4 text-body-sm text-fg-subtle md:px-5">Sin citas en el período.</p>
      ) : (
        <table className="w-full text-left text-body-sm">
          <caption className="sr-only">Citas por área</caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted text-caption text-fg-muted">
              <th scope="col" className="px-4 py-2 font-semibold md:pl-5">
                Área
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Citas
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Atendidas
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold md:pr-5">
                Asistencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.category}>
                <th scope="row" className="px-4 py-2.5 font-normal md:pl-5">
                  <CategoryTag category={r.category} />
                </th>
                <td className="tabular px-2 py-2.5 text-right">{totalAppointments(r)}</td>
                <td className="tabular px-2 py-2.5 text-right">{r.ATENDIDA}</td>
                <td className="tabular px-4 py-2.5 text-right md:pr-5">
                  {formatPercent(attendanceRate(r))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function TreatmentsPanel({
  range,
  category,
  professionalId,
  treatments,
}: {
  range: Range;
  category: TreatmentCategory | null;
  professionalId: string | null;
  treatments: ReturnType<typeof useTreatments>['data'] | null;
}) {
  const view = useMemo(() => {
    if (!treatments) return null;
    const list = treatments.filter(
      (t) =>
        (!category || t.category === category) &&
        (!professionalId || t.professionalId === professionalId),
    );
    const inRange = (d: string | null) => !!d && d >= range.from && d <= range.to;
    return {
      active: list.filter((t) => t.status === 'ACTIVO').length,
      started: list.filter((t) => inRange(t.startDate)).length,
      finished: list.filter(
        (t) =>
          t.status === 'FINALIZADO' && inRange(t.statusChangedAt && toDateKey(t.statusChangedAt)),
      ).length,
      suspended: list.filter((t) => t.status === 'SUSPENDIDO').length,
    };
  }, [treatments, category, professionalId, range]);

  return (
    <Panel title="Tratamientos">
      {!view ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <Stat label="Iniciados en el período" value={view.started} />
          <Stat label="Finalizados en el período" value={view.finished} />
          <Stat label="Activos hoy" value={view.active} />
          <Stat label="Suspendidos hoy" value={view.suspended} />
        </div>
      )}
    </Panel>
  );
}

type WorkloadItem = WorkloadRow & { id: string; name: string; incomeCents: number | null };

function WorkloadPanel({
  rows,
  names,
  income,
}: {
  rows: Record<string, WorkloadRow>;
  names: Record<string, string>;
  income: DailyIncomeDoc[] | null;
}) {
  const items: WorkloadItem[] = Object.entries(rows)
    .map(([id, r]) => ({
      ...r,
      id,
      name: names[id] ?? 'Profesional',
      incomeCents: income ? income.reduce((s, d) => s + (d.byProfessional?.[id] ?? 0), 0) : null,
    }))
    .sort((a, b) => b.attendedMinutes - a.attendedMinutes);

  const columns: Column<WorkloadItem>[] = [
    {
      id: 'profesional',
      header: 'Profesional',
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: 'citas',
      header: 'Citas',
      cell: (r) => totalAppointments(r),
      className: 'w-20 text-right tabular',
    },
    {
      id: 'atendidas',
      header: 'Atendidas',
      cell: (r) => r.ATENDIDA,
      className: 'w-24 text-right tabular',
    },
    {
      id: 'horas',
      header: 'Horas atendidas',
      cell: (r) => formatHours(r.attendedMinutes),
      className: 'w-36 text-right tabular',
    },
    {
      id: 'asistencia',
      header: 'Asistencia',
      cell: (r) => formatPercent(attendanceRate(r)),
      className: 'w-28 text-right tabular',
      hideBelowLg: true,
    },
    {
      id: 'cancelaciones',
      header: 'Cancelaciones',
      cell: (r) => formatPercent(cancellationRate(r)),
      className: 'w-32 text-right tabular',
      hideBelowLg: true,
    },
    ...(income
      ? [
          {
            id: 'ingresos',
            header: 'Ingresos',
            cell: (r: WorkloadItem) => formatMoney(r.incomeCents ?? 0),
            className: 'w-32 text-right tabular',
          },
        ]
      : []),
  ];

  return (
    <Panel flush title="Carga por profesional" description="Ordenada por horas atendidas.">
      {items.length === 0 ? (
        <p className="p-4 text-body-sm text-fg-subtle md:px-5">Sin citas en el período.</p>
      ) : (
        <DataTable
          rows={items}
          columns={columns}
          getRowKey={(r) => r.id}
          caption="Carga de trabajo por profesional"
          renderMobileRow={(r) => (
            <div className="flex flex-col gap-1 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-fg">{r.name}</span>
                <span className="tabular text-body-sm text-fg">
                  {formatHours(r.attendedMinutes)}
                </span>
              </div>
              <p className="tabular text-caption text-fg-muted">
                {totalAppointments(r)} citas · {r.ATENDIDA} atendidas · asistencia{' '}
                {formatPercent(attendanceRate(r))}
                {r.incomeCents !== null && ` · ${formatMoney(r.incomeCents)}`}
              </p>
            </div>
          )}
        />
      )}
    </Panel>
  );
}

function IncomeSection({ days, range }: { days: DailyIncomeDoc[]; range: Range }) {
  const total = days.reduce((s, d) => s + d.totalCents, 0);
  const count = days.reduce((s, d) => s + d.count, 0);
  const byMethod = PAYMENT_METHODS.map((m) => ({
    key: m,
    label: PAYMENT_METHOD_LABELS[m],
    cents: days.reduce((s, d) => s + (d.byMethod?.[m] ?? 0), 0),
  }));
  const byCategory = TREATMENT_CATEGORIES.map((c) => ({
    key: c,
    label: TREATMENT_CATEGORY_LABELS[c],
    cents: days.reduce((s, d) => s + (d.byCategory?.[c] ?? 0), 0),
  })).filter((c) => c.cents > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Stat label="Total cobrado" value={formatMoney(total)} />
        <Stat label="Cobros" value={count} />
        <Stat
          label="Promedio por cobro"
          value={count > 0 ? formatMoney(Math.round(total / count)) : '—'}
        />
      </div>
      <ValueChart buckets={incomeSeries(days, range)} format={formatMoney} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="text-body-sm font-semibold text-fg">Por medio de pago</h3>
          <IncomeBreakdown label="Ingresos por medio de pago" items={byMethod} />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-body-sm font-semibold text-fg">Por área</h3>
          {byCategory.length > 0 ? (
            <IncomeBreakdown label="Ingresos por área" items={byCategory} />
          ) : (
            <p className="text-body-sm text-fg-subtle">Sin cobros en el período.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Los ingresos diarios guardan totales por profesional y por área, no su
 * combinación: con un filtro se usa ese total; con los dos, el del profesional.
 */
function filterIncome(
  days: DailyIncomeDoc[],
  professionalId: string | null,
  category: TreatmentCategory | null,
): DailyIncomeDoc[] {
  if (!professionalId && !category) return days;
  return days.map((d) => {
    const cents = professionalId
      ? (d.byProfessional?.[professionalId] ?? 0)
      : (d.byCategory?.[category!] ?? 0);
    return { ...d, totalCents: cents };
  });
}

function RebuildButton({ range }: { range: Range }) {
  const toast = useToast();
  const rebuild = useRebuildReports();
  const [open, setOpen] = useState(false);

  const run = async () => {
    try {
      const { days } = await rebuild.mutateAsync(range);
      toast.success(
        'Estadísticas recalculadas',
        `${days} ${days === 1 ? 'día' : 'días'} actualizados.`,
      );
      setOpen(false);
    } catch (err) {
      toast.error('No se pudo recalcular', toAppError(err).message);
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <RefreshCw aria-hidden="true" />
        Recalcular
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Recalcular las estadísticas del período?"
        description={`Se vuelven a calcular los resúmenes del ${formatDateRange(range.from, range.to)} a partir de las citas y cobros registrados. Úsalo si cargaste datos antes de activar los reportes o si una cifra no coincide.`}
        confirmLabel="Recalcular"
        loading={rebuild.isPending}
        onConfirm={() => void run()}
      />
    </>
  );
}
