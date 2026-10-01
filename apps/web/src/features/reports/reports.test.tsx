import { emptyStatusCounts } from '@kinesalud/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { StatusChart } from './components/ReportCharts';
import {
  formatHours,
  formatPercent,
  incomeSeries,
  rangeError,
  rangeForPreset,
  statusSeries,
  toCsv,
} from './model';

const TODAY = '2026-09-30';

describe('períodos', () => {
  it('calcula los rangos predefinidos respecto de hoy', () => {
    expect(rangeForPreset('hoy', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(rangeForPreset('semana', TODAY)).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(rangeForPreset('mes', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeForPreset('mes-anterior', TODAY)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(rangeForPreset('30-dias', TODAY)).toEqual({ from: '2026-09-01', to: TODAY });
    expect(rangeForPreset('mes-anterior', '2026-03-15')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('valida un rango personalizado', () => {
    expect(rangeError({ from: '', to: TODAY })).toMatch(/dos fechas/);
    expect(rangeError({ from: TODAY, to: '2026-09-01' })).toMatch(/anterior/);
    expect(rangeError({ from: '2024-01-01', to: TODAY })).toMatch(/366/);
    expect(rangeError({ from: '2026-01-01', to: TODAY })).toBeNull();
  });
});

describe('series', () => {
  it('agrupa por semana los rangos de más de un mes e incluye semanas vacías', () => {
    const byDay = new Map([
      ['2026-08-03', { ...emptyStatusCounts(), ATENDIDA: 2 }],
      ['2026-08-05', { ...emptyStatusCounts(), CANCELADA: 1 }],
    ]);
    const { granularity, buckets } = statusSeries(byDay, { from: '2026-08-03', to: '2026-09-27' });
    expect(granularity).toBe('week');
    expect(buckets).toHaveLength(8);
    expect(buckets[0]?.value).toMatchObject({ ATENDIDA: 2, CANCELADA: 1 });
    expect(buckets[1]?.value.ATENDIDA).toBe(0);
  });

  it('suma los ingresos por día del período', () => {
    const days = [
      {
        date: '2026-09-02',
        totalCents: 5000,
        count: 1,
        byMethod: { EFECTIVO: 5000, QR: 0, TARJETA: 0 },
        byProfessional: {},
        byCategory: {},
      },
    ];
    const series = incomeSeries(days, { from: '2026-09-01', to: '2026-09-03' });
    expect(series.map((b) => b.value)).toEqual([0, 5000, 0]);
  });
});

describe('formato y exportación', () => {
  it('muestra porcentajes y horas', () => {
    expect(formatPercent(0.8333)).toBe('83 %');
    expect(formatPercent(null)).toBe('—');
    expect(formatHours(135)).toBe('2 h 15 min');
    expect(formatHours(120)).toBe('2 h');
  });

  it('genera un CSV para Excel en español (";", comillas y BOM)', () => {
    const csv = toCsv([
      ['Fecha', 'Nota'],
      ['2026-09-01', 'Dijo "hola"; chau'],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Fecha;Nota\r\n2026-09-01;"Dijo ""hola""; chau"');
  });
});

describe('gráfico de citas', () => {
  it('tiene leyenda con totales y cada barra describe su detalle', () => {
    const { buckets } = statusSeries(
      new Map([['2026-09-28', { ...emptyStatusCounts(), ATENDIDA: 3, NO_ASISTIO: 1 }]]),
      { from: '2026-09-28', to: '2026-09-29' },
    );
    render(
      <TestSessionProvider>
        <StatusChart buckets={buckets} />
      </TestSessionProvider>,
    );
    const legend = screen.getByRole('list', { name: 'Leyenda' });
    expect(legend).toHaveTextContent('Atendidas3');
    expect(legend).toHaveTextContent('No asistió1');
    expect(
      screen.getByRole('img', { name: '28 de septiembre: 4 citas (3 atendidas, 1 no asistió)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '29 de septiembre: 0 citas (sin citas)' }),
    ).toBeInTheDocument();
  });
});
