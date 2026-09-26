/**
 * Orçamento: preços editáveis de chapas, insumos e serviços, mão de obra e margem.
 * Preços não informados usam valores de referência (ver engine/pricing.ts).
 */
import { RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { NumberInput } from '@/components/params/fields';
import { Button } from '@/components/ui/button';
import { cn, fmt, fmtMoney } from '@/lib/utils';
import type { BudgetCategory, BudgetLine } from '@/types/woodcraft';

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  chapas: 'Chapas',
  insumos: 'Ferragens e insumos',
  servicos: 'Serviços da madeireira',
  'mao-de-obra': 'Mão de obra',
};

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border px-3 py-2', strong ? 'bg-primary-soft' : 'bg-surface')}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div className={cn('tabular-nums', strong ? 'text-lg font-bold text-primary-hover' : 'text-base font-semibold')}>{fmtMoney(value)}</div>
    </div>
  );
}

export function BudgetPanel() {
  const { budget } = useResults();
  const prices = useProjectStore((s) => s.prices);
  const setPrices = useProjectStore((s) => s.setPrices);
  const setSheetPrice = useProjectStore((s) => s.setSheetPrice);
  const setItemPrice = useProjectStore((s) => s.setItemPrice);

  const setLinePrice = (line: BudgetLine, value: number | null) => {
    if (line.key.startsWith('sheet:')) setSheetPrice(line.key.slice('sheet:'.length), value);
    else if (line.key.startsWith('item:')) setItemPrice(line.key.slice('item:'.length), value);
    else if (line.key === 'service:cutting' && value !== null) setPrices({ cuttingPerSheet: value });
    else if (line.key === 'service:edge-banding' && value !== null) setPrices({ edgeBandingPerMeter: value });
  };

  const categories = (Object.keys(BUDGET_CATEGORY_LABELS) as BudgetCategory[]).filter((c) => c !== 'mao-de-obra');

  return (
    <div className="h-full space-y-4 overflow-auto p-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Chapas" value={budget.subtotals.chapas} />
        <Stat label="Insumos" value={budget.subtotals.insumos} />
        <Stat label="Serviços + mão de obra" value={budget.subtotals.servicos + budget.subtotals['mao-de-obra']} />
        <Stat label={budget.margin > 0 ? 'Preço final' : 'Custo total'} value={budget.price} strong />
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-background p-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-subtle">Mão de obra</span>
          <NumberInput value={prices.labor} min={0} step={10} unit="R$" className="w-32" onChange={(labor) => setPrices({ labor })} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-subtle">Margem / lucro</span>
          <NumberInput value={prices.marginPercent} min={0} max={500} unit="%" className="w-24" onChange={(marginPercent) => setPrices({ marginPercent })} />
        </label>
        <div className="ml-auto text-right text-sm">
          <div className="text-subtle">
            Custo {fmtMoney(budget.cost)} {budget.margin > 0 && <>+ margem {fmtMoney(budget.margin)}</>}
          </div>
          <div className="text-lg font-bold">{fmtMoney(budget.price)}</div>
        </div>
      </div>

      <p className="text-xs text-subtle">
        Os preços em cinza são valores de referência. Digite o preço do seu fornecedor para substituí-los — eles ficam salvos no projeto.
        Serviços da madeireira aparecem quando o corte ou a fitagem estão marcados como terceirizados (em “Chapa e serviços”).
      </p>

      {categories.map((cat) => {
        const lines = budget.lines.filter((l) => l.category === cat);
        if (!lines.length) return null;
        return (
          <section key={cat}>
            <h4 className="mb-1.5 flex items-center justify-between text-sm font-semibold text-primary-hover">
              {BUDGET_CATEGORY_LABELS[cat]}
              <span className="tabular-nums">{fmtMoney(budget.subtotals[cat])}</span>
            </h4>
            <table className="w-full text-sm">
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-border/70">
                    <td className="py-1.5 pr-3">
                      <div className="font-medium">{l.description}</div>
                      {l.detail && <div className="text-xs text-subtle">{l.detail}</div>}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums text-subtle">
                      {fmt(l.quantity)} {l.unit} ×
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center justify-end gap-1">
                        <NumberInput
                          value={l.unitPrice}
                          min={0}
                          step={0.01}
                          unit="R$"
                          className={cn('w-28', !l.custom && l.category !== 'servicos' && '[&_input]:text-subtle')}
                          aria-label={`Preço unitário de ${l.description}`}
                          onChange={(v) => setLinePrice(l, v)}
                        />
                        {l.custom && l.category !== 'servicos' ? (
                          <Button variant="ghost" size="icon" className="size-7" title="Voltar ao preço de referência" aria-label="Voltar ao preço de referência" onClick={() => setLinePrice(l, null)}>
                            <RotateCcw className="size-3.5" />
                          </Button>
                        ) : (
                          <span className="size-7" />
                        )}
                      </div>
                    </td>
                    <td className="w-28 py-1.5 text-right font-semibold tabular-nums">{fmtMoney(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
