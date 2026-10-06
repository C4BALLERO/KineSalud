import type { SessionNoteView } from '@kinesalud/shared';
import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { formatDayShort } from '@/utils/format';

const W = 600;
const H = 200;
const PAD = { top: 12, right: 16, bottom: 28, left: 28 };

const SERIES = [
  { key: 'painBefore', label: 'Antes de la sesión', color: 'var(--color-chart-1)' },
  { key: 'painAfter', label: 'Después de la sesión', color: 'var(--color-chart-2)' },
] as const;

/**
 * Evolución del dolor (EVA 0–10) sesión a sesión: dos líneas, antes y después.
 * Las líneas se dibujan al aparecer; al señalar (o con las flechas) una guía
 * vertical marca la sesión y un tooltip muestra ambos valores y la mejora.
 * Leyenda siempre visible y una tabla equivalente para lectores de pantalla.
 */
export function PainChart({ notes }: { notes: SessionNoteView[] }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const points = [...notes]
    .filter((n) => n.painBefore !== null || n.painAfter !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) {
    return (
      <p className="text-body-sm text-fg-subtle">
        El gráfico aparece cuando hay al menos dos sesiones con la escala de dolor registrada.
      </p>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / 10) * innerH;
  const label = (n: SessionNoteView) =>
    n.sessionNumber ? `S${n.sessionNumber}` : formatDayShort(n.date);
  const first = points[0]!;
  const last = points.at(-1)!;
  const summary = `Dolor de ${first.painBefore ?? first.painAfter} a ${last.painAfter ?? last.painBefore} en ${points.length} sesiones`;

  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const after = points
    .map((n, i) => (n.painAfter === null ? null : ([x(i), y(n.painAfter)] as const)))
    .filter((c): c is readonly [number, number] => c !== null);
  const area =
    after.length > 1
      ? `M${after[0]![0]},${y(0)} ${after.map(([cx, cy]) => `L${cx},${cy}`).join(' ')} L${after.at(-1)![0]},${y(0)} Z`
      : null;
  const onKeyDown = (e: KeyboardEvent) => {
    const current = active ?? -1;
    const next = e.key === 'ArrowRight' ? current + 1 : e.key === 'ArrowLeft' ? current - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(points.length - 1, Math.max(0, next)));
  };
  const focused = active !== null ? points[active] : undefined;

  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-caption text-fg-muted">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative" onPointerLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0, 5, 10].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--color-fg-muted)"
              >
                {v}
              </text>
            </g>
          ))}
          {points.map((n, i) => (
            <text
              key={n.appointmentId}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-fg-muted)"
            >
              {points.length <= 12 || i % Math.ceil(points.length / 12) === 0 ? label(n) : ''}
            </text>
          ))}
          {area && <path className="kv-area" d={area} fill={`url(#${gradientId})`} />}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={y(0)}
              stroke="var(--color-fg-subtle)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          {SERIES.map((s) => {
            const coords = points
              .map((n, i) => (n[s.key] === null ? null : ([x(i), y(n[s.key]!)] as const)))
              .filter((c): c is readonly [number, number] => c !== null);
            return (
              <g key={s.key}>
                <polyline
                  className="kv-line"
                  pathLength={1}
                  points={coords.map(([cx, cy]) => `${cx},${cy}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((n, i) =>
                  n[s.key] === null ? null : (
                    <circle
                      key={n.appointmentId}
                      className="kv-point"
                      style={{ '--i': i } as CSSProperties}
                      cx={x(i)}
                      cy={y(n[s.key]!)}
                      r={active === i ? 7 : 4.5}
                      fill={s.color}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            );
          })}
          {/* Zonas de captura: una franja vertical por sesión. */}
          {points.map((n, i) => (
            <rect
              key={n.appointmentId}
              x={x(i) - step / 2}
              y={PAD.top}
              width={step}
              height={innerH}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>
        {focused && active !== null && (
          <PainTooltip note={focused} title={label(focused)} left={(x(active) / W) * 100} />
        )}
      </div>
      <table className="sr-only">
        <caption>Escala de dolor por sesión</caption>
        <thead>
          <tr>
            <th scope="col">Sesión</th>
            <th scope="col">Antes</th>
            <th scope="col">Después</th>
          </tr>
        </thead>
        <tbody>
          {points.map((n) => (
            <tr key={n.appointmentId}>
              <th scope="row">{label(n)}</th>
              <td>{n.painBefore ?? '—'}</td>
              <td>{n.painAfter ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function PainTooltip({
  note,
  title,
  left,
}: {
  note: SessionNoteView;
  title: string;
  left: number;
}) {
  const change =
    note.painBefore !== null && note.painAfter !== null ? note.painBefore - note.painAfter : null;
  const toLeft = left > 60;
  return (
    <div
      aria-hidden="true"
      className="kv-tooltip pointer-events-none absolute top-0 z-20 flex min-w-40 flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 shadow-md"
      style={toLeft ? { right: `calc(${100 - left}% + 12px)` } : { left: `calc(${left}% + 12px)` }}
    >
      <p className="text-caption font-semibold text-fg">
        {title} · {formatDayShort(note.date)}
      </p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2 text-caption text-fg-muted">
          <span
            aria-hidden="true"
            className="h-0.5 w-3 rounded-full"
            style={{ background: s.color }}
          />
          <span className="flex-1">{s.label}</span>
          <span className="tabular font-semibold text-fg">{note[s.key] ?? '—'}</span>
        </p>
      ))}
      {change !== null && change !== 0 && (
        <p
          className={
            change > 0
              ? 'border-t border-border pt-1 text-caption font-medium text-success'
              : 'border-t border-border pt-1 text-caption font-medium text-danger'
          }
        >
          {change > 0 ? `Bajó ${change} en la sesión` : `Subió ${-change} en la sesión`}
        </p>
      )}
    </div>
  );
}
