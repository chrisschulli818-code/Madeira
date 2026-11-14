/**
 * Barra com os móveis do projeto: selecionar, duplicar, remover e adicionar novos.
 */
import type { ReactNode } from 'react';
import { Archive, BedDouble, Bookmark, Copy, DoorClosed, Laptop, Layers3, Library, PanelTop, PencilRuler, Plus, Sofa, SquareStack, Table2, Trash2, Tv } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { TEMPLATE_LIST, TEMPLATES } from '@/engine/templates';
import { Button } from '@/components/ui/button';
import { Dropdown, MenuItem } from '@/components/ui/dropdown';
import { Segmented } from '@/components/params/fields';
import { cn } from '@/lib/utils';
import { AiAssistant } from '@/components/ai/AiAssistant';
import type { TemplateId } from '@/types/woodcraft';

export const TEMPLATE_ICONS: Record<TemplateId, ReactNode> = {
  'base-cabinet': <Archive />,
  'wall-cabinet': <PanelTop />,
  wardrobe: <DoorClosed />,
  workbench: <Table2 />,
  custom: <PencilRuler />,
  nightstand: <SquareStack />,
  dresser: <Layers3 />,
  bookshelf: <Library />,
  'tv-rack': <Tv />,
  desk: <Laptop />,
  bed: <BedDouble />,
  prop: <Sofa />,
};

function AddItemMenu() {
  const addItem = useProjectStore((s) => s.addItem);
  const library = useProjectStore((s) => s.library);
  const insertItems = useProjectStore((s) => s.insertItems);
  return (
    <Dropdown
      align="right"
      className="sm:left-auto sm:right-0"
      trigger={({ open, toggle }) => (
        <Button variant="outline" size="sm" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
          <Plus /> Adicionar móvel
        </Button>
      )}
    >
      {(close) => (
        <div className="max-h-[70vh] overflow-y-auto">
          {library.length > 0 && (
            <>
              <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">Meus móveis</div>
              {library.map((e) => (
                <MenuItem
                  key={e.id}
                  icon={<Bookmark />}
                  title={e.item.name}
                  description={TEMPLATES[e.item.templateId].name}
                  onSelect={() => {
                    insertItems([e.item]);
                    close();
                  }}
                />
              ))}
              <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">Novo a partir de modelo</div>
            </>
          )}
          {TEMPLATE_LIST.map((t) => (
            <MenuItem
              key={t.id}
              icon={TEMPLATE_ICONS[t.id]}
              title={t.name}
              description={t.description}
              onSelect={() => {
                addItem(t.id);
                close();
              }}
            />
          ))}
        </div>
      )}
    </Dropdown>
  );
}

export function ProjectItemsBar() {
  const items = useProjectStore((s) => s.items);
  const activeItemId = useProjectStore((s) => s.activeItemId);
  const setActiveItem = useProjectStore((s) => s.setActiveItem);
  const duplicateItem = useProjectStore((s) => s.duplicateItem);
  const removeItem = useProjectStore((s) => s.removeItem);
  const viewMode = useProjectStore((s) => s.viewMode);
  const setViewMode = useProjectStore((s) => s.setViewMode);

  return (
    <nav aria-label="Móveis do projeto" className="flex items-center gap-2 border-b border-border bg-surface/70 px-3 py-2">
      <Segmented
        aria-label="Modo"
        className="shrink-0"
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'furniture', label: 'Móvel', title: 'Editar o móvel selecionado' },
          { value: 'room', label: 'Ambiente', title: 'Posicionar todos os móveis no cômodo' },
        ]}
      />
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
        {items.map((item) => {
          const active = item.id === activeItemId;
          return (
            <div
              key={item.id}
              className={cn(
                'flex shrink-0 items-center rounded-md border transition-colors',
                active && viewMode === 'furniture' ? 'border-primary/40 bg-primary-soft text-primary-hover' : 'border-border bg-surface text-subtle hover:text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveItem(item.id);
                  setViewMode('furniture');
                }}
                aria-pressed={active}
                className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-2 text-sm font-medium [&_svg]:size-4"
              >
                {TEMPLATE_ICONS[item.templateId]}
                <span className="max-w-44 truncate">{item.name || 'Sem nome'}</span>
                {item.quantity > 1 && <span className="rounded bg-white/70 px-1 text-[11px] tabular-nums">×{item.quantity}</span>}
              </button>
              {active && viewMode === 'furniture' && (
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
      <AiAssistant />
      <AddItemMenu />
    </nav>
  );
}
