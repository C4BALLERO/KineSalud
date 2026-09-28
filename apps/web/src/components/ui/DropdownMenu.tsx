import { DropdownMenu as RadixMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;

export function DropdownMenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'animate-pop z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-md',
          className,
        )}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Si se indica, el ítem es un enlace real (navegación accesible). */
  asLink?: string;
}

export function DropdownMenuItem({
  children,
  icon,
  onSelect,
  destructive,
  disabled,
  asLink,
}: DropdownMenuItemProps) {
  return (
    <RadixMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      asChild={!!asLink}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-body-sm outline-none select-none md:h-9',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        destructive
          ? 'text-danger data-[highlighted]:bg-danger-subtle'
          : 'text-fg data-[highlighted]:bg-surface-muted',
      )}
    >
      {asLink ? (
        <Link to={asLink}>
          {icon}
          {children}
        </Link>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </RadixMenu.Item>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <RadixMenu.Label className="px-2.5 pt-2 pb-1 text-caption text-fg-subtle">
      {children}
    </RadixMenu.Label>
  );
}

export function DropdownMenuSeparator() {
  return <RadixMenu.Separator className="my-1 h-px bg-border" />;
}
