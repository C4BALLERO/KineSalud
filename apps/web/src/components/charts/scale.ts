/**
 * Escala del eje Y: valores "redondos" (1, 2, 2,5 o 5 × 10ⁿ) que cubren el
 * máximo con pocas marcas, para que las líneas de referencia se lean de un vistazo.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  // Conteos y centavos son enteros: el paso también (nada de "2,5 citas").
  const integer = Number.isInteger(max);
  const step =
    [1, 2, 2.5, 5, 10]
      .map((m) => m * power)
      .find((s) => s >= rough && (!integer || Number.isInteger(s))) ?? 10 * power;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Monto en centavos para un eje: "Bs 500", "Bs 1,5 mil", "Bs 2 M". */
export function compactMoney(cents: number): string {
  const bs = cents / 100;
  if (Math.abs(bs) >= 1_000_000) return `Bs ${oneDecimal(bs / 1_000_000)} M`;
  if (Math.abs(bs) >= 1_000) return `Bs ${oneDecimal(bs / 1_000)} mil`;
  return `Bs ${oneDecimal(bs)}`;
}
