import { describe, expect, it } from 'vitest';
import { compactMoney, niceTicks } from './scale';

describe('niceTicks', () => {
  it('cubre el máximo con pasos redondos', () => {
    expect(niceTicks(10)).toEqual([0, 5, 10]);
    expect(niceTicks(13)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(1_234_500)).toEqual([0, 500_000, 1_000_000, 1_500_000]);
  });

  it('en conteos pequeños no inventa fracciones', () => {
    expect(niceTicks(2)).toEqual([0, 1, 2]);
    expect(niceTicks(1)).toEqual([0, 1]);
  });

  it('sin datos devuelve una escala mínima', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe('compactMoney', () => {
  it('abrevia los montos del eje', () => {
    expect(compactMoney(50_000)).toBe('Bs 500');
    expect(compactMoney(150_000)).toBe('Bs 1,5 mil');
    expect(compactMoney(250_000_000)).toBe('Bs 2,5 M');
  });
});
