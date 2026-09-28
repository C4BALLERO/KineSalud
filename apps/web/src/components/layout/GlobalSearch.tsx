import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { controlClasses } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Búsqueda global de clientes (nombre, CI o teléfono). Atajo de teclado: "/".
 * Envía al listado de clientes con el término; la búsqueda real se conecta en la Fase 8.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/clientes?q=${encodeURIComponent(q)}` : '/clientes');
  };

  return (
    <form role="search" onSubmit={onSubmit} className={cn('relative w-full max-w-sm', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
      />
      <input
        ref={inputRef}
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Buscar cliente por nombre, CI o teléfono"
        aria-keyshortcuts="/"
        placeholder="Buscar cliente por nombre, CI o teléfono"
        className={cn(
          controlClasses,
          'h-10 border-border-strong bg-canvas pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden',
        )}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm border border-border-strong bg-surface px-1.5 font-mono text-caption text-fg-subtle"
      >
        /
      </kbd>
    </form>
  );
}
