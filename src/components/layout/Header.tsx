import { Archive, DoorClosed, PanelTop, Printer, Table2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { TEMPLATE_LIST } from '@/engine/templates';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TemplateId } from '@/types/woodcraft';

const TEMPLATE_ICONS: Record<TemplateId, ReactNode> = {
  'base-cabinet': <Archive />,
  'wall-cabinet': <PanelTop />,
  wardrobe: <DoorClosed />,
  workbench: <Table2 />,
};

export function Header() {
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const templateId = useProjectStore((s) => s.templateId);
  const setTemplate = useProjectStore((s) => s.setTemplate);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="size-7" />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">WoodCraft Planner</div>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Nome do projeto"
            className="w-40 rounded border border-transparent bg-transparent text-xs text-subtle hover:border-border focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <nav aria-label="Templates" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
        {TEMPLATE_LIST.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            aria-pressed={t.id === templateId}
            title={t.description}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4',
              t.id === templateId ? 'bg-primary-soft text-primary-hover' : 'text-subtle hover:bg-muted hover:text-foreground',
            )}
          >
            {TEMPLATE_ICONS[t.id]}
            {t.name}
          </button>
        ))}
      </nav>

      <Button size="sm" className="ml-auto sm:ml-0" onClick={() => window.print()}>
        <Printer /> Relatório PDF
      </Button>
    </header>
  );
}
