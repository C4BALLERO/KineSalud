import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import { niceTicks } from './scale';

export interface BarSegment {
  key: string;
  label: string;
  value: number;
  /** Color de la serie (clase de fondo de un token, p. ej. `bg-success`). */
  className: string;
}

export interface BarDatum {
  key: string;
  /** Etiqueta corta del eje X. */
  label: string;
  /** Título del tooltip. */
  longLabel: string;
  /** Una serie = un segmento; varias = barra apilada (con leyenda fuera del gráfico). */
  segments: BarSegment[];
  /** La barra lleva a otra pantalla (p. ej. la agenda de ese día). */
  href?: string;
  /** Marca de "hoy": banda de fondo y etiqueta destacada. */
  highlight?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  /** Nombre accesible del gráfico. */
  caption: string;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  /** Nombre accesible de cada barra (por defecto: título, total y desglose). */
  describe?: (datum: BarDatum, total: number) => string;
  /** Cifra sobre cada barra (solo con pocas barras). */
  showValues?: boolean;
  /** Línea de referencia punteada (p. ej. el promedio). */
  reference?: { value: number; label: string };
  axisLabel?: (datum: BarDatum, index: number) => string;
  /** Alto del área del gráfico (clase de Tailwind). */
  heightClass?: string;
}

const sumOf = (d: BarDatum) => d.segments.reduce((s, x) => s + x.value, 0);
const vars = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * Barras (simples o apiladas) con eje, cuadrícula tenue y tooltip con el
 * desglose. Crecen desde la base al aparecer; al señalar o recorrer con las
 * flechas, la barra activa se destaca y las demás se atenúan.
 * Accesible: cada barra tiene su nombre completo (o es un enlace) y el
 * gráfico se recorre con el teclado (una sola parada de tabulación).
 */
export function BarChart({
  data,
  caption,
  formatValue = String,
  formatTick = String,
  describe,
  showValues = false,
  reference,
  axisLabel,
  heightClass = 'h-44',
}: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const totals = data.map(sumOf);
  const ticks = niceTicks(Math.max(0, ...totals, reference?.value ?? 0));
  const top = ticks.at(-1) || 1;
  const pct = (v: number) => (v / top) * 100;
  const every = Math.max(1, Math.ceil(data.length / 12));
  const stacked = data.some((d) => d.segments.length > 1);
  const linked = data.some((d) => d.href);
  // Una sola parada de tabulación: la barra activa (o la primera).
  const focusIndex = active ?? 0;

  const label = (d: BarDatum, total: number) => {
    if (describe) return describe(d, total);
    const parts = d.segments
      .filter((s) => s.value > 0)
      .map((s) => `${formatValue(s.value)} ${s.label.toLowerCase()}`);
    return `${d.longLabel}: ${formatValue(total)}${stacked && parts.length ? ` (${parts.join(', ')})` : ''}`;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: focusIndex + 1,
      ArrowLeft: focusIndex - 1,
      Home: 0,
      End: data.length - 1,
    };
    if (!(e.key in keys) || linked) return;
    e.preventDefault();
    const next = Math.min(data.length - 1, Math.max(0, keys[e.key]!));
    setActive(next);
    items.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <ol aria-hidden="true" className={cn('relative w-12 shrink-0', heightClass)}>
          {ticks.map((t) => (
            <li
              key={t}
              className="tabular absolute right-0 translate-y-1/2 text-caption leading-none text-fg-subtle"
              style={{ bottom: `${pct(t)}%` }}
            >
              {formatTick(t)}
            </li>
          ))}
        </ol>

        {/* Contenedor de "tabindex itinerante": las barras son las que reciben el foco
            y las flechas; aquí solo se escucha el evento que sube desde ellas. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={cn('relative min-w-0 flex-1', heightClass)}
          onPointerLeave={(e) => e.pointerType !== 'touch' && setActive(null)}
          // Las flechas recorren las barras: el evento sube desde la barra enfocada.
          onKeyDown={onKeyDown}
        >
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-x-0 border-t',
                t === 0 ? 'border-border-strong' : 'border-dashed border-border',
              )}
              style={{ bottom: `${pct(t)}%` }}
            />
          ))}

          {reference && reference.value > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dotted border-fg-subtle"
              style={{ bottom: `${pct(reference.value)}%` }}
            >
              <span className="tabular absolute right-0 bottom-1 rounded-sm bg-surface/90 px-1 text-caption text-fg-muted">
                {reference.label}
              </span>
            </div>
          )}

          <ol
            // Al cambiar el período, las barras vuelven a crecer.
            key={data.map((d) => d.key).join('|')}
            aria-label={caption}
            className="relative flex h-full items-end gap-0.5 sm:gap-1.5"
          >
            {data.map((d, i) => {
              const total = totals[i]!;
              const dim = active !== null && active !== i;
              const segments = d.segments.filter((s) => s.value > 0);
              const body: ReactNode = (
                <>
                  {showValues && total > 0 && (
                    <span
                      className="kv-value-label tabular text-caption text-fg-muted"
                      style={vars(i)}
                    >
                      {formatValue(total)}
                    </span>
                  )}
                  <span
                    className="kv-bar flex w-full max-w-10 flex-col-reverse gap-0.5"
                    style={{
                      ...vars(i),
                      height: `${pct(total)}%`,
                      opacity: dim ? 0.38 : 1,
                      filter: active === i ? 'saturate(1.25) brightness(1.05)' : undefined,
                    }}
                  >
                    {segments.map((s, j) => (
                      <span
                        key={s.key}
                        className={cn(
                          'w-full',
                          s.className,
                          j === segments.length - 1 && 'rounded-t-[4px]',
                        )}
                        style={{ flexGrow: s.value, flexBasis: 0, minHeight: 2 }}
                      />
                    ))}
                  </span>
                </>
              );
              const common = {
                ref: (el: HTMLElement | null) => {
                  items.current[i] = el;
                },
                'aria-label': label(d, total),
                onPointerEnter: () => setActive(i),
                onFocus: () => setActive(i),
                onBlur: () => setActive(null),
                className:
                  'flex h-full w-full flex-col items-center justify-end gap-1 rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              };
              return (
                <li
                  key={d.key}
                  className={cn(
                    'relative flex h-full min-w-0 flex-1 justify-center rounded-t-md transition-colors duration-150',
                    d.highlight && 'bg-primary-subtle',
                    active === i && !d.highlight && 'bg-surface-muted',
                  )}
                >
                  {d.href ? (
                    <Link to={d.href} {...common}>
                      {body}
                    </Link>
                  ) : (
                    <span role="img" tabIndex={i === focusIndex ? 0 : -1} {...common}>
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {active !== null && data[active] && (
            <ChartTooltip
              datum={data[active]}
              index={active}
              count={data.length}
              total={totals[active]!}
              stacked={stacked}
              formatValue={formatValue}
            />
          )}
        </div>
      </div>

      <ol aria-hidden="true" className="ml-14 flex gap-0.5 sm:gap-1.5">
        {data.map((d, i) => (
          <li
            key={d.key}
            className={cn(
              'min-w-0 flex-1 truncate text-center text-caption capitalize',
              d.highlight ? 'font-semibold text-primary' : 'text-fg-muted',
            )}
          >
            {axisLabel ? axisLabel(d, i) : i % every === 0 ? d.label : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Desglose junto a la barra activa (del lado con más espacio), sin taparla. */
function ChartTooltip({
  datum,
  index,
  count,
  total,
  stacked,
  formatValue,
}: {
  datum: BarDatum;
  index: number;
  count: number;
  total: number;
  stacked: boolean;
  formatValue: (value: number) => string;
}) {
  const onRight = (index + 0.5) / count < 0.5;
  const position: CSSProperties = onRight
    ? { left: `calc(${((index + 1) / count) * 100}% + 8px)` }
    : { right: `calc(${(1 - index / count) * 100}% + 8px)` };
  return (
    <div
      aria-hidden="true"
      className="kv-tooltip pointer-events-none absolute top-0 z-20 flex min-w-40 flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 shadow-md"
      style={position}
    >
      <p className="text-caption font-semibold text-fg first-letter:uppercase">{datum.longLabel}</p>
      {stacked &&
        datum.segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <p key={s.key} className="flex items-center gap-2 text-caption text-fg-muted">
              <span
                aria-hidden="true"
                className={cn('size-2.5 shrink-0 rounded-[2px]', s.className)}
              />
              <span className="flex-1">{s.label}</span>
              <span className="tabular font-medium text-fg">{formatValue(s.value)}</span>
            </p>
          ))}
      <p
        className={cn(
          'flex items-baseline justify-between gap-4 text-caption',
          stacked && 'mt-0.5 border-t border-border pt-1',
        )}
      >
        <span className="text-fg-muted">Total</span>
        <span className="tabular text-body-sm font-semibold text-fg">{formatValue(total)}</span>
      </p>
    </div>
  );
}
