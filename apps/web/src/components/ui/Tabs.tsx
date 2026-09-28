import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const Tabs = RadixTabs.Root;

export function TabsList({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <RadixTabs.List
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]',
        className,
      )}
    >
      {children}
    </RadixTabs.List>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  /** Contador opcional, p. ej. número de citas. */
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export function TabsTrigger({ value, children, count, icon, disabled }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        'relative -mb-px inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3',
        'text-body-sm font-medium whitespace-nowrap text-fg-muted transition-colors duration-150',
        'hover:text-fg data-[state=active]:border-primary data-[state=active]:text-primary',
        'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4',
      )}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className="tabular rounded-full bg-surface-muted px-1.5 text-caption text-fg-muted">
          {count}
        </span>
      )}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.Content
      value={value}
      className={cn('pt-5 focus-visible:outline-offset-4', className)}
    >
      {children}
    </RadixTabs.Content>
  );
}
