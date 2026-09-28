import { Search, X } from 'lucide-react';
import type { Ref } from 'react';
import { cn } from '@/utils/cn';
import { controlClasses } from './Input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Nombre accesible (el campo no tiene label visible dentro de barras de filtros). */
  label: string;
  placeholder?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className,
  ref,
}: SearchInputProps) {
  return (
    <div role="search" className={cn('relative', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
      />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          controlClasses,
          'h-11 pr-10 pl-9 md:h-10 [&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-muted hover:text-fg"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
