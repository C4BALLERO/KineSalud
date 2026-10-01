import { painChange, type SessionNoteView } from '@kinesalud/shared';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { capitalizeFirst, formatDayLong } from '@/utils/format';

/** Variación del dolor en la sesión, con flecha y texto (no solo color). */
export function PainBadge({ note }: { note: Pick<SessionNoteView, 'painBefore' | 'painAfter'> }) {
  if (note.painBefore === null && note.painAfter === null) return null;
  const change = painChange(note);
  if (change === null) {
    const v = note.painBefore ?? note.painAfter;
    return <Badge tone="neutral">EVA {v}</Badge>;
  }
  const Icon = change < 0 ? ArrowDownRight : change > 0 ? ArrowUpRight : ArrowRight;
  return (
    <Badge
      tone={change < 0 ? 'success' : change > 0 ? 'danger' : 'neutral'}
      icon={<Icon aria-hidden="true" />}
    >
      <span className="sr-only">Dolor </span>EVA {note.painBefore} → {note.painAfter}
    </Badge>
  );
}

/** Nota de una sesión: qué se hizo, cómo evolucionó y qué se indicó. */
export function SessionNoteCard({
  note,
  showService,
  editable,
}: {
  note: SessionNoteView;
  showService?: boolean;
  /** Enlace para ver o editar la nota completa. */
  editable?: boolean;
}) {
  const fields: [string, string | null][] = [
    ['Observaciones', note.observations],
    ['Evolución', note.evolution],
    ['Recomendaciones', note.recommendations],
  ];
  return (
    <article className="flex flex-col gap-3 px-4 py-4 md:px-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-body-sm font-semibold text-fg">
            {note.sessionNumber ? `Sesión ${note.sessionNumber}` : 'Sesión'} ·{' '}
            {capitalizeFirst(formatDayLong(note.date))}
          </h4>
          <p className="text-caption text-fg-muted">
            {showService && `${note.serviceName} · `}
            {note.professionalName}
            {note.updatedAt && ' · editada'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PainBadge note={note} />
          {editable && (
            <Link
              to={`/citas/${note.appointmentId}/sesion`}
              className="inline-flex items-center gap-1 text-caption font-semibold text-primary underline-offset-2 hover:underline"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              Ver o editar
            </Link>
          )}
        </div>
      </header>
      <dl className="flex flex-col gap-2 text-body-sm">
        {fields
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
              <dd className="whitespace-pre-line text-fg">{value}</dd>
            </div>
          ))}
      </dl>
    </article>
  );
}
