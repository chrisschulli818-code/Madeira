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

function H2({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 flex items-baseline gap-2 border-b-2 border-foreground pb-1 text-lg font-bold">
      <span className="text-primary">{n}.</span> {children}
    </h2>
  );
}

export function PrintReport() {
  const { model, nesting, hardware, tools, materials, sheet } = useResults();
  const projectName = useProjectStore((s) => s.projectName);
  const templateId = useProjectStore((s) => s.templateId);
  const params = useProjectStore((s) => (s.templateId === 'workbench' ? s.workbenchParams : s.cabinetParams[s.templateId]));
  const colorOf = (pieceId?: string) => MATERIAL_COLORS[model.pieces.find((p) => p.id === pieceId)?.material ?? 'carcass'];
  const date = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="hidden bg-white text-[12px] text-black print:block">
      <header className="flex items-end justify-between border-b border-border pb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">WoodCraft Planner</div>
          <h1 className="text-2xl font-bold">{projectName}</h1>
          <div className="text-subtle">{TEMPLATES[templateId].name}</div>
        </div>
        <div className="text-right text-xs text-subtle">{date}</div>
      </header>

      <H2 n={1}>Desenho cotado e especificações</H2>
      <div className="avoid-break grid grid-cols-[3fr_2fr] gap-4">
        <Elevation2D model={model} view="front" className="h-72 w-full" />
        <Elevation2D model={model} view="side" className="h-72 w-full" />
      </div>
      <table className="avoid-break mt-3 w-full">
        <tbody>
          {describeParams(templateId, params).map(([k, v]) => (
            <tr key={k} className="border-b border-border/70">
              <td className="w-1/3 py-1 pr-3 font-medium">{k}</td>
              <td className="py-1">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {model.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-amber-800">
          {model.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="print-break" />
      <H2 n={2}>Lista de corte (para a madeireira)</H2>
      <div className="mb-2">
        <CutListTotals pieces={model.pieces} />
      </div>
      <CutListRows pieces={model.pieces} materials={materials} />
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

      <H2 n={4}>Checklist de ferramentas</H2>
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
