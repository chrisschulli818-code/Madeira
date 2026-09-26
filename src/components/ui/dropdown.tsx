import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Menu suspenso simples: fecha com clique fora ou Esc. */
export function Dropdown({
  trigger,
  children,
  align = 'left',
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={cn('absolute z-40 mt-1 w-72 rounded-lg border border-border bg-surface p-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0', className)}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Item de menu com ícone, título e descrição. */
export function MenuItem({ icon, title, description, onSelect }: { icon: ReactNode; title: string; description?: string; onSelect: () => void }) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      className="flex w-full gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-muted [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary"
    >
      {icon}
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {description && <span className="block text-xs text-subtle">{description}</span>}
      </span>
    </button>
  );
}
