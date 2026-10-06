import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart, type BarDatum } from './BarChart';

const data: BarDatum[] = ['lun', 'mar', 'mié'].map((day, i) => ({
  key: day,
  label: day,
  longLabel: `Día ${day}`,
  segments: [
    { key: 'ok', label: 'Atendidas', value: i + 1, className: 'bg-success' },
    { key: 'no', label: 'No asistió', value: i, className: 'bg-danger' },
  ],
}));

describe('BarChart', () => {
  it('cada barra tiene su nombre completo con el desglose', () => {
    render(<BarChart caption="Citas" data={data} />);
    expect(
      screen.getByRole('img', { name: 'Día mar: 3 (2 atendidas, 1 no asistió)' }),
    ).toBeInTheDocument();
  });

  it('al señalar una barra muestra el tooltip con el desglose y el total', () => {
    const { container } = render(<BarChart caption="Citas" data={data} />);
    fireEvent.pointerEnter(screen.getByRole('img', { name: /Día mié/ }));
    const tooltip = container.querySelector('.kv-tooltip');
    expect(tooltip).toHaveTextContent('Día mié');
    expect(tooltip).toHaveTextContent('Atendidas3');
    expect(tooltip).toHaveTextContent('Total5');
  });

  it('se recorre con las flechas desde una sola parada de tabulación', () => {
    render(<BarChart caption="Citas" data={data} />);
    const bars = screen.getAllByRole('img');
    expect(bars.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    bars[0]!.focus();
    fireEvent.keyDown(bars[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(bars[1]);
    fireEvent.keyDown(bars[1]!, { key: 'End' });
    expect(document.activeElement).toBe(bars[2]);
  });

  it('muestra la línea de referencia con su etiqueta', () => {
    render(<BarChart caption="Citas" data={data} reference={{ value: 3, label: 'Promedio 3' }} />);
    expect(screen.getByText('Promedio 3')).toBeInTheDocument();
  });
});
