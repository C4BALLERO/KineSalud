import type { SessionNoteView } from '@kinesalud/shared';
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
 * Leyenda siempre visible, marcadores con anillo y una tabla equivalente para
 * lectores de pantalla.
 */
export function PainChart({ notes }: { notes: SessionNoteView[] }) {
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
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
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
        {SERIES.map((s) => {
          const coords = points
            .map((n, i) => (n[s.key] === null ? null : ([x(i), y(n[s.key]!)] as const)))
            .filter((c): c is readonly [number, number] => c !== null);
          return (
            <g key={s.key}>
              <polyline
                points={coords.map(([cx, cy]) => `${cx},${cy}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((n, i) =>
                n[s.key] === null ? null : (
                  <circle
                    key={n.appointmentId}
                    cx={x(i)}
                    cy={y(n[s.key]!)}
                    r={4.5}
                    fill={s.color}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                  >
                    <title>{`${label(n)} · ${s.label}: ${n[s.key]}`}</title>
                  </circle>
                ),
              )}
            </g>
          );
        })}
      </svg>
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
