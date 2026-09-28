import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/Skeleton';
import {
  matchesAllTerms,
  useClientsList,
  type ClientListItem,
} from '@/features/clients/api/clients';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/utils/cn';
import { formatCi, formatPhone } from '@/utils/format';

const MAX_RESULTS = 8;

/** Buscar y elegir un cliente activo (por nombre, carnet o teléfono). */
export function ClientPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (client: ClientListItem) => void;
}) {
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim(), 300);
  const results = useClientsList(
    { search, status: 'ACTIVO', sort: 'apellido' },
    search.length >= 2,
  );
  const items =
    results.status === 'success'
      ? results.data.pages
          .flatMap((p) => p.items)
          .filter((c) => matchesAllTerms(c, search))
          .slice(0, MAX_RESULTS)
      : [];

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        label="Buscar cliente"
        placeholder="Nombre, apellido, carnet o teléfono"
        value={text}
        onChange={setText}
      />
      {search.length < 2 ? (
        <p className="text-body-sm text-fg-muted">Escribe al menos 2 caracteres para buscar.</p>
      ) : results.status === 'pending' ? (
        <ListSkeleton rows={3} label="Buscando clientes…" />
      ) : results.status === 'error' ? (
        <InlineAlert tone="danger" title={results.error.message} />
      ) : items.length === 0 ? (
        <p role="status" className="text-body-sm text-fg-muted">
          No hay clientes activos que coincidan con “{search}”.
        </p>
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-md border border-border"
          aria-label="Resultados"
        >
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                aria-pressed={c.id === selectedId}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-muted',
                  c.id === selectedId && 'bg-primary-subtle',
                )}
              >
                <Avatar name={c.fullName} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-fg">{c.fullName}</span>
                  <span className="tabular text-caption text-fg-muted">
                    CI {formatCi(c.ci, c.ciExt)} · {formatPhone(c.phone)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/clientes/nuevo?volver=cita">
          <UserPlus aria-hidden="true" />
          Registrar un cliente nuevo
        </Link>
      </Button>
    </div>
  );
}
