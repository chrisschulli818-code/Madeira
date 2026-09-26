/**
 * Barra com os móveis do projeto: selecionar, duplicar, remover e adicionar novos.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, Copy, DoorClosed, PanelTop, Plus, Table2, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { TEMPLATE_LIST } from '@/engine/templates';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TemplateId } from '@/types/woodcraft';

export const TEMPLATE_ICONS: Record<TemplateId, ReactNode> = {
  'base-cabinet': <Archive />,
  'wall-cabinet': <PanelTop />,
  wardrobe: <DoorClosed />,
  workbench: <Table2 />,
};

function AddItemMenu() {
  const addItem = useProjectStore((s) => s.addItem);
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
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Plus /> Adicionar móvel
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-border bg-surface p-1 shadow-lg sm:left-0 sm:right-auto">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              type="button"
              onClick={() => {
                addItem(t.id);
                setOpen(false);
              }}
              className="flex w-full gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-muted [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary"
            >
              {TEMPLATE_ICONS[t.id]}
              <span>
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-subtle">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectItemsBar() {
  const items = useProjectStore((s) => s.items);
  const activeItemId = useProjectStore((s) => s.activeItemId);
  const setActiveItem = useProjectStore((s) => s.setActiveItem);
  const duplicateItem = useProjectStore((s) => s.duplicateItem);
  const removeItem = useProjectStore((s) => s.removeItem);

  return (
    <nav aria-label="Móveis do projeto" className="flex items-center gap-2 border-b border-border bg-surface/70 px-3 py-2">
      <span className="hidden shrink-0 text-xs font-medium uppercase tracking-wide text-subtle md:inline">Móveis</span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
        {items.map((item) => {
          const active = item.id === activeItemId;
          return (
            <div
              key={item.id}
              className={cn(
                'flex shrink-0 items-center rounded-md border transition-colors',
                active ? 'border-primary/40 bg-primary-soft text-primary-hover' : 'border-border bg-surface text-subtle hover:text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => setActiveItem(item.id)}
                aria-pressed={active}
                className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-2 text-sm font-medium [&_svg]:size-4"
              >
                {TEMPLATE_ICONS[item.templateId]}
                <span className="max-w-44 truncate">{item.name || 'Sem nome'}</span>
                {item.quantity > 1 && <span className="rounded bg-white/70 px-1 text-[11px] tabular-nums">×{item.quantity}</span>}
              </button>
              {active && (
                <span className="flex items-center pr-1">
                  <button type="button" title="Duplicar móvel" aria-label="Duplicar móvel" onClick={() => duplicateItem(item.id)} className="grid size-6 place-items-center rounded hover:bg-white/70">
                    <Copy className="size-3.5" />
                  </button>
                  {items.length > 1 && (
                    <button
                      type="button"
                      title="Remover móvel"
                      aria-label="Remover móvel"
                      onClick={() => confirm(`Remover "${item.name}" do projeto?`) && removeItem(item.id)}
                      className="grid size-6 place-items-center rounded hover:bg-white/70 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <AddItemMenu />
    </nav>
  );
}
