/**
 * Resumo de ferragens, fixadores, acabamento e insumos (lista de compras).
 */
import { Download, Nut, Package, Paintbrush, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { Button } from '@/components/ui/button';
import { downloadFile, fmt, slugify } from '@/lib/utils';
import type { HardwareCategory, HardwareItem } from '@/types/woodcraft';

export const CATEGORY_META: Record<HardwareCategory, { label: string; icon: ReactNode }> = {
  fixacao: { label: 'Fixação', icon: <Nut /> },
  ferragem: { label: 'Ferragens', icon: <Wrench /> },
  acabamento: { label: 'Acabamento', icon: <Paintbrush /> },
  insumo: { label: 'Insumos', icon: <Package /> },
};

export function HardwareTable({ items }: { items: HardwareItem[] }) {
  const groups = (Object.keys(CATEGORY_META) as HardwareCategory[])
    .map((cat) => ({ cat, items: items.filter((i) => i.category === cat) }))
    .filter((g) => g.items.length);
  return (
    <div className="space-y-5">
      {groups.map(({ cat, items: list }) => (
        <section key={cat} className="avoid-break">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary-hover [&_svg]:size-4">
            {CATEGORY_META[cat].icon}
            {CATEGORY_META[cat].label}
          </h4>
          <table className="w-full text-sm">
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-b border-border/70 align-top">
                  <td className="w-20 py-1.5 pr-3 text-right font-semibold tabular-nums">
                    {fmt(i.quantity)} <span className="text-xs font-normal text-subtle">{i.unit}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-subtle">{i.specification}</div>
                  </td>
                  <td className="hidden py-1.5 text-xs text-subtle sm:table-cell print:table-cell">{i.application}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export function HardwareSummary() {
  const { hardware } = useResults();
  const projectName = useProjectStore((s) => s.projectName);
  const exportCsv = () => {
    const rows = [['Categoria', 'Item', 'Especificação', 'Quantidade', 'Unidade', 'Aplicação']];
    for (const i of hardware) rows.push([CATEGORY_META[i.category].label, i.name, i.specification, fmt(i.quantity), i.unit, i.application]);
    downloadFile(`${slugify(projectName)}-lista-de-compras.csv`, rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n'));
  };
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-subtle">Quantidades estimadas a partir das junções, portas, gavetas e bordas do projeto (itens miúdos com 10% de sobra).</p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download /> CSV
        </Button>
      </div>
      <HardwareTable items={hardware} />
    </div>
  );
}
