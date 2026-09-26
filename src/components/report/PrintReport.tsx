/**
 * Relatório imprimível (Ctrl+P → "Salvar como PDF").
 * Fica oculto na tela e é o único conteúdo visível na impressão.
 */
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { TEMPLATES } from '@/engine/templates';
import { describeParams } from '@/lib/specs';
import { MATERIAL_COLORS } from '@/lib/pieceColors';
import { Elevation2D } from '@/components/viewport/Elevation2D';
import { CutListRows, CutListTotals } from '@/components/cutlist/CutListTable';
import { NestingSummary } from '@/components/nesting/CuttingPlan';
import { SheetDiagram } from '@/components/nesting/SheetDiagram';
import { HardwareTable } from '@/components/hardware/HardwareSummary';
import type { ReactNode } from 'react';
import { fmt, fmtMoney } from '@/lib/utils';

function H2({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 flex items-baseline gap-2 border-b-2 border-foreground pb-1 text-lg font-bold">
      <span className="text-primary">{n}.</span> {children}
    </h2>
  );
}

export function PrintReport() {
  const { items, pieces, nesting, hardware, tools, budget, materials, sheet } = useResults();
  const projectName = useProjectStore((s) => s.projectName);
  const multi = items.length > 1;
  const colorOf = (pieceId?: string) => MATERIAL_COLORS[pieces.find((p) => p.id === pieceId)?.material ?? 'carcass'];
  const date = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="hidden bg-white text-[12px] text-black print:block">
      <header className="flex items-end justify-between border-b border-border pb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">WoodCraft Planner</div>
          <h1 className="text-2xl font-bold">{projectName}</h1>
          <div className="text-subtle">{multi ? `${items.length} móveis` : TEMPLATES[items[0]!.item.templateId].name}</div>
        </div>
        <div className="text-right text-xs text-subtle">{date}</div>
      </header>

      <H2 n={1}>Desenhos cotados e especificações</H2>
      {items.map(({ item, model }, i) => (
        <section key={item.id} className={i > 0 ? 'print-break' : undefined}>
          <h3 className="mb-2 text-base font-bold">
            {multi ? `Móvel ${i + 1}: ` : ''}
            {item.name} <span className="font-normal text-subtle">— {TEMPLATES[item.templateId].name}{item.quantity > 1 ? `, ${item.quantity} unidades` : ''}</span>
          </h3>
          <div className="avoid-break grid grid-cols-[3fr_2fr] gap-4">
            <Elevation2D model={model} view="front" className="h-64 w-full" />
            <Elevation2D model={model} view="side" className="h-64 w-full" />
          </div>
          <table className="avoid-break mt-3 w-full">
            <tbody>
              {describeParams(item.templateId, item.params).map(([k, v]) => (
                <tr key={k} className="border-b border-border/70">
                  <td className="w-1/3 py-1 pr-3 font-medium">{k}</td>
                  <td className="py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {model.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-amber-800">
              {model.warnings.map((w, j) => (
                <li key={j}>{w}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div className="print-break" />
      <H2 n={2}>Lista de corte (para a madeireira)</H2>
      <div className="mb-2">
        <CutListTotals pieces={pieces} />
      </div>
      <CutListRows pieces={pieces} materials={materials} showItem={multi} />
      <p className="mt-1 text-[10px] text-subtle">Comprimento = sentido do veio. Fita: C = lados do comprimento, L = lados da largura.</p>

      <h3 className="mb-2 mt-5 text-sm font-bold">Plano de corte — chapa {sheet.length} × {sheet.width} mm, kerf {sheet.kerf} mm</h3>
      {nesting.map((g) => (
        <section key={g.materialKey} className="mb-4">
          <div className="mb-2">
            <NestingSummary group={g} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {g.sheets.map((layout) => (
              <figure key={layout.index} className="avoid-break">
                <figcaption className="text-[10px] text-subtle">Chapa {layout.index + 1}</figcaption>
                <SheetDiagram layout={layout} sheet={sheet} color={colorOf(layout.placements[0]?.pieceId)} className="w-full border border-border" />
              </figure>
            ))}
          </div>
        </section>
      ))}

      <div className="print-break" />
      <H2 n={3}>Lista de compras</H2>
      <section className="avoid-break mb-4">
        <h4 className="mb-1.5 text-sm font-semibold text-primary-hover">Chapas</h4>
        <table className="w-full text-sm">
          <tbody>
            {nesting.map((g) => (
              <tr key={g.materialKey} className="border-b border-border/70">
                <td className="w-20 py-1.5 pr-3 text-right font-semibold">
                  {g.sheets.length} <span className="text-xs font-normal text-subtle">un</span>
                </td>
                <td className="py-1.5">
                  {g.materialLabel} {g.thickness} mm — {sheet.length} × {sheet.width} mm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <HardwareTable items={hardware} />

      <H2 n={4}>Orçamento</H2>
      <table className="avoid-break w-full text-sm">
        <tbody>
          {budget.lines.map((l) => (
            <tr key={l.key} className="border-b border-border/70">
              <td className="py-1 pr-3">
                {l.description} {l.detail && <span className="text-xs text-subtle">— {l.detail}</span>}
              </td>
              <td className="py-1 pr-3 text-right tabular-nums">
                {fmt(l.quantity)} {l.unit} × {fmtMoney(l.unitPrice)}
              </td>
              <td className="py-1 text-right font-semibold tabular-nums">{fmtMoney(l.total)}</td>
            </tr>
          ))}
          <tr className="bg-muted font-bold">
            <td className="py-1.5 pr-3" colSpan={2}>Custo total</td>
            <td className="py-1.5 text-right">{fmtMoney(budget.cost)}</td>
          </tr>
          {budget.margin > 0 && (
            <tr className="bg-muted font-bold">
              <td className="py-1.5 pr-3" colSpan={2}>Preço final sugerido (margem {fmtMoney(budget.margin)})</td>
              <td className="py-1.5 text-right">{fmtMoney(budget.price)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <H2 n={5}>Checklist de ferramentas</H2>
      <div className="grid grid-cols-2 gap-6">
        {(['obrigatoria', 'recomendada'] as const).map((cat) => (
          <section key={cat}>
            <h4 className="mb-1.5 text-sm font-semibold">{cat === 'obrigatoria' ? 'Essenciais' : 'Opcionais / avançadas'}</h4>
            <ul className="space-y-1">
              {tools
                .filter((t) => t.category === cat)
                .map((t) => (
                  <li key={t.id} className="avoid-break flex gap-2">
                    <span className="mt-0.5 inline-block size-3 shrink-0 border border-foreground" />
                    <span>
                      <strong>{t.name}</strong> <span className="text-subtle">— {t.usage}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
