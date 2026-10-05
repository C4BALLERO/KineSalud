import { addDays, toDateKey } from '@kinesalud/shared';
import { LockKeyhole, ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, NoResultsState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useUsers } from '@/features/users/api/users';
import { RoleBadge } from '@/features/users/components/UserBadges';
import { useNow } from '@/hooks/useNow';
import { formatDateTime } from '@/utils/format';
import { AUDIT_PAGE_SIZE, useAuditLogs, type AuditLogItem } from '../api/audit';
import {
  AUDIT_MODULES,
  auditActionLabel,
  auditMetaSummary,
  auditModuleOf,
  isClinicalAccess,
  type AuditModule,
} from '../model';

const ALL = 'todos';

/**
 * Registro de auditoría: quién hizo qué y cuándo, incluido cada acceso a la
 * información clínica. Solo lectura y solo para la administración.
 */
export function AuditPage() {
  const today = toDateKey(useNow());
  const [from, setFrom] = useState(() => addDays(today, -6));
  const [to, setTo] = useState(today);
  const [module, setModule] = useState<AuditModule | typeof ALL>(ALL);
  const [person, setPerson] = useState<string>(ALL);

  // Un rango invertido se corrige en lugar de devolver una lista vacía sin explicación.
  const [rangeFrom, rangeTo] = from <= to ? [from, to] : [to, from];
  const logs = useAuditLogs(rangeFrom, rangeTo);
  const users = useUsers();

  const nameOf = useMemo(() => {
    const names = new Map(
      users.status === 'success' ? users.data.map((u) => [u.uid, u.displayName]) : [],
    );
    return (entry: AuditLogItem) => {
      if (entry.actor.type === 'SYSTEM') return 'Sistema';
      if (entry.actor.type === 'CHATBOT') return 'Asistente virtual';
      return (entry.actor.uid && names.get(entry.actor.uid)) || 'Cuenta eliminada';
    };
  }, [users]);

  const entries = useMemo(() => (logs.status === 'success' ? logs.data : []), [logs]);
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) seen.set(e.actor.uid ?? e.actor.type, nameOf(e));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [entries, nameOf]);

  const filtered = entries.filter(
    (e) =>
      (module === ALL || auditModuleOf(e.action) === module) &&
      (person === ALL || (e.actor.uid ?? e.actor.type) === person),
  );
  const hasFilters = module !== ALL || person !== ALL;
  const clearFilters = () => {
    setModule(ALL);
    setPerson(ALL);
  };

  const action = (e: AuditLogItem) => (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-body-sm font-medium text-fg">
        {isClinicalAccess(e.action) && (
          <LockKeyhole aria-hidden="true" className="size-3.5 shrink-0 text-secondary" />
        )}
        {auditActionLabel(e.action)}
      </span>
      <span className="text-caption text-fg-subtle">{AUDIT_MODULES[auditModuleOf(e.action)]}</span>
    </div>
  );
  const who = (e: AuditLogItem) => (
    <div className="flex flex-col items-start gap-1">
      <span className="text-body-sm text-fg">{nameOf(e)}</span>
      {e.actor.role && <RoleBadge role={e.actor.role} />}
    </div>
  );
  const when = (e: AuditLogItem) => (
    <span className="text-body-sm whitespace-nowrap text-fg-muted tabular-nums">
      {e.at ? formatDateTime(e.at) : 'Registrando…'}
    </span>
  );
  const detail = (e: AuditLogItem) => {
    const summary = auditMetaSummary(e.meta);
    return (
      <div className="flex min-w-0 flex-col gap-0.5 text-caption text-fg-muted">
        <span className="font-mono break-all">
          {e.entity}/{e.entityId}
        </span>
        {summary && <span className="break-words">{summary}</span>}
      </div>
    );
  };

  const columns: Column<AuditLogItem>[] = [
    { id: 'at', header: 'Fecha y hora', cell: when, className: 'w-44' },
    { id: 'who', header: 'Persona', cell: who, className: 'w-52' },
    { id: 'action', header: 'Acción', cell: action },
    { id: 'detail', header: 'Registro', cell: detail, hideBelowLg: true },
  ];

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué y cuándo. Incluye cada consulta a la información clínica (marcada con un candado). Las entradas no se pueden editar ni borrar."
      />

      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:flex-wrap md:items-end md:px-5">
          <div className="grid grid-cols-2 gap-3 md:flex">
            <FormField label="Desde" className="md:w-44">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  max={today}
                  value={from}
                  onChange={(e) => e.target.value && setFrom(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Hasta" className="md:w-44">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  max={today}
                  value={to}
                  onChange={(e) => e.target.value && setTo(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <FormField label="Módulo" className="md:w-56">
              {(p) => (
                <Select
                  {...p}
                  value={module}
                  onChange={(e) => setModule(e.target.value as AuditModule | typeof ALL)}
                >
                  <option value={ALL}>Todos los módulos</option>
                  {(Object.keys(AUDIT_MODULES) as AuditModule[]).map((m) => (
                    <option key={m} value={m}>
                      {AUDIT_MODULES[m]}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Persona" className="md:w-56">
              {(p) => (
                <Select {...p} value={person} onChange={(e) => setPerson(e.target.value)}>
                  <option value={ALL}>Todas las personas</option>
                  {people.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          {logs.status === 'success' && (
            <p aria-live="polite" className="text-body-sm text-fg-muted md:ml-auto md:pb-2.5">
              {filtered.length === entries.length
                ? `${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'}`
                : `${filtered.length} de ${entries.length}`}
            </p>
          )}
        </div>

        {logs.status === 'success' && entries.length >= AUDIT_PAGE_SIZE && (
          <div className="border-b border-border p-4 md:px-5">
            <InlineAlert tone="info" title={`Se muestran las ${AUDIT_PAGE_SIZE} más recientes.`}>
              Acorta el rango de fechas para ver las anteriores.
            </InlineAlert>
          </div>
        )}

        {logs.status === 'loading' && <ListSkeleton rows={6} label="Cargando auditoría…" />}
        {logs.status === 'error' && (
          <ErrorState description={logs.error.message} onRetry={logs.retry} />
        )}
        {logs.status === 'success' &&
          (entries.length === 0 ? (
            <EmptyState
              icon={<ScrollText />}
              title="Sin actividad en estas fechas"
              description="Elige otro rango de fechas."
            />
          ) : filtered.length === 0 ? (
            <NoResultsState onClear={hasFilters ? clearFilters : undefined} />
          ) : (
            <DataTable
              caption="Registro de auditoría"
              rows={filtered}
              columns={columns}
              getRowKey={(e) => e.id}
              renderMobileRow={(e) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    {action(e)}
                    {when(e)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-sm text-fg">{nameOf(e)}</span>
                    {e.actor.role && <RoleBadge role={e.actor.role} />}
                    {e.actor.channel && e.actor.channel !== 'web' && (
                      <Badge>{e.actor.channel}</Badge>
                    )}
                  </div>
                </div>
              )}
            />
          ))}
      </Panel>
    </>
  );
}
