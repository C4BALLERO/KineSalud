import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface KeyValueItem {
  label: string;
  value: ReactNode;
}

interface KeyValueListProps {
  items: KeyValueItem[];
  columns?: 1 | 2;
  className?: string;
}

/** Lista de datos etiqueta/valor (fichas de cliente y profesional). */
export function KeyValueList({ items, columns = 2, className }: KeyValueListProps) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-caption text-fg-subtle">{item.label}</dt>
          <dd className="text-body-sm break-words text-fg">
            {item.value ?? <span className="text-fg-subtle">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
