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
  useMyPatients,
  type ClientListItem,
} from '@/features/clients/api/clients';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/utils/cn';
import { formatCi, formatPhone } from '@/utils/format';

const MAX_RESULTS = 8;

/**
 * Buscar y elegir un cliente activo (por nombre, carnet o teléfono). Con
 * `professionalId`, solo entre los pacientes de ese profesional (el rol
 * PROFESIONAL no puede ver a los demás clientes).
 */
export function ClientPicker({
  selectedId,
  onSelect,
  professionalId = null,
}: {
  selectedId: string | null;
  onSelect: (client: ClientListItem) => void;
  professionalId?: string | null;
}) {
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim(), 300);
  const ownPatients = !!professionalId;
  const list = useClientsList(
    { search, status: 'ACTIVO', sort: 'apellido' },
    !ownPatients && search.length >= 2,
  );
  const patients = useMyPatients(professionalId);
  // Sus pacientes se listan desde el inicio; la búsqueda filtra en el navegador.
  const needsText = !ownPatients && search.length < 2;
  const results: { status: 'pending' | 'error' | 'success'; message?: string } = ownPatients
    ? patients.status === 'loading'
      ? { status: 'pending' }
      : patients.status === 'error'
        ? { status: 'error', message: patients.error.message }
        : { status: 'success' }
    : list.status === 'error'
      ? { status: 'error', message: list.error.message }
      : { status: list.status };
  const found = ownPatients
    ? patients.status === 'success'
      ? patients.data
          .filter((c) => c.status === 'ACTIVO')
          .sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))
      : []
    : list.status === 'success'
      ? list.data.pages.flatMap((p) => p.items)
      : [];
  const items = found.filter((c) => matchesAllTerms(c, search)).slice(0, MAX_RESULTS);

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        label="Buscar cliente"
        placeholder="Nombre, apellido, carnet o teléfono"
        value={text}
        onChange={setText}
      />
      {needsText ? (
        <p className="text-body-sm text-fg-muted">Escribe al menos 2 caracteres para buscar.</p>
      ) : results.status === 'pending' ? (
        <ListSkeleton rows={3} label="Buscando clientes…" />
      ) : results.status === 'error' ? (
        <InlineAlert tone="danger" title={results.message ?? ''} />
      ) : items.length === 0 ? (
        <p role="status" className="text-body-sm text-fg-muted">
          {ownPatients && !search
            ? 'Aún no tienes pacientes activos. Registra uno nuevo para agendarle una cita.'
            : `No hay ${ownPatients ? 'pacientes' : 'clientes'} activos que coincidan con “${search}”.`}
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
          {ownPatients ? 'Registrar un paciente nuevo' : 'Registrar un cliente nuevo'}
        </Link>
      </Button>
    </div>
  );
}
