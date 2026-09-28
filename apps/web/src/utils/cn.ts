import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge debe conocer la escala tipográfica propia; sin esto
 * interpretaría `text-body` como un color y lo eliminaría al combinarlo con `text-fg`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'h1', 'h2', 'h3', 'body', 'body-sm', 'caption', 'overline', 'tab'] },
      ],
    },
  },
});

/** Combina clases condicionales resolviendo conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
