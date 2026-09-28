import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Clases de la celda (ancho, alineación). */
  className?: string;
  /** Oculta la columna por debajo de lg (datos secundarios). */
  hideBelowLg?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  /** Resumen accesible de la tabla. */
  caption: string;
  /** Representación de cada fila como tarjeta en pantallas pequeñas (< md). */
  renderMobileRow: (row: T) => ReactNode;
  className?: string;
}

/**
 * Tabla responsive: tabla semántica desde md y lista de tarjetas en móvil,
 * para no forzar scroll horizontal. El ordenamiento y la paginación se
 * incorporan con TanStack Table cuando un módulo los necesite (Clientes).
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  caption,
  renderMobileRow,
  className,
}: DataTableProps<T>) {
  return (
    <div className={className}>
      <table className="hidden w-full border-collapse text-left md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-caption font-semibold text-fg-muted first:pl-5 last:pr-5',
                  c.hideBelowLg && 'hidden lg:table-cell',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="transition-colors duration-150 hover:bg-canvas">
              {columns.map((c) => (
                <td
                  key={c.id}
                  className={cn(
                    'px-4 py-3 align-middle text-body-sm text-fg first:pl-5 last:pr-5',
                    c.hideBelowLg && 'hidden lg:table-cell',
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label={caption} className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="px-4 py-3">
            {renderMobileRow(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
