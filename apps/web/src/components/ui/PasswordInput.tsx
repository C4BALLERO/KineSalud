import { Eye, EyeOff } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';
import { controlClasses, type InputProps } from './Input';

/**
 * Campo de contraseña con botón mostrar/ocultar y aviso de Bloq Mayús.
 * El aviso se asocia al campo para que también lo anuncien los lectores de pantalla.
 */
export function PasswordInput({
  className,
  onKeyUp,
  id,
  ...props
}: Omit<InputProps, 'type' | 'leadingIcon'>) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const capsId = id ? `${id}-caps` : undefined;
  const describedBy =
    [props['aria-describedby'], capsLock ? capsId : undefined].filter(Boolean).join(' ') ||
    undefined;

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
    onKeyUp?.(e);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          onKeyUp={handleKey}
          aria-describedby={describedBy}
          className={cn(controlClasses, 'h-11 pr-12 pl-3 md:h-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-muted hover:text-fg md:size-8"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {capsLock && (
        <p id={capsId} className="text-caption text-warning">
          Bloq Mayús está activado.
        </p>
      )}
    </div>
  );
}
