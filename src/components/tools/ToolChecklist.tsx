/**
 * Checklist de ferramentas: essenciais × opcionais/avançadas, com marcação persistida.
 */
import { CheckCircle2, Circle, ShieldCheck, Sparkles } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { cn } from '@/lib/utils';
import type { ToolCategory, ToolRequirement } from '@/types/woodcraft';

const META: Record<ToolCategory, { title: string; icon: React.ReactNode }> = {
  obrigatoria: { title: 'Essenciais', icon: <ShieldCheck className="size-4 text-primary" /> },
  recomendada: { title: 'Opcionais / avançadas', icon: <Sparkles className="size-4 text-accent" /> },
};

function ToolColumn({ category, tools }: { category: ToolCategory; tools: ToolRequirement[] }) {
  const checks = useProjectStore((s) => s.toolChecks);
  const toggle = useProjectStore((s) => s.toggleTool);
  const done = tools.filter((t) => checks[t.id]).length;
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {META[category].icon} {META[category].title}
        <span className="ml-auto text-xs font-normal text-subtle">
          {done}/{tools.length}
        </span>
      </h4>
      <ul className="space-y-1">
        {tools.map((t) => {
          const checked = !!checks[t.id];
          return (
            <li key={t.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(t.id)}
                className="flex w-full gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
              >
                {checked ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> : <Circle className="mt-0.5 size-4 shrink-0 text-subtle" />}
                <span>
                  <span className={cn('block text-sm font-medium', checked && 'text-subtle line-through')}>{t.name}</span>
                  <span className="block text-xs text-subtle">{t.usage}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ToolChecklist() {
  const { tools } = useResults();
  return (
    <div className="grid h-full gap-6 overflow-auto p-4 lg:grid-cols-2">
      <ToolColumn category="obrigatoria" tools={tools.filter((t) => t.category === 'obrigatoria')} />
      <ToolColumn category="recomendada" tools={tools.filter((t) => t.category === 'recomendada')} />
    </div>
  );
}
