/**
 * Plano de corte: resumo por material (chapas, aproveitamento, perda) e desenho de cada chapa.
 */
import { AlertTriangle, LayoutGrid } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { Badge } from '@/components/ui/badge';
import { MATERIAL_COLORS } from '@/lib/pieceColors';
import { fmt, fmtPct } from '@/lib/utils';
import type { NestingResult } from '@/types/woodcraft';
import { SheetDiagram } from './SheetDiagram';

export function NestingSummary({ group }: { group: NestingResult }) {
  const waste = 1 - group.utilization;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-1 flex items-center gap-1.5 text-sm font-semibold">
        <LayoutGrid className="size-4 text-primary" />
        {group.materialLabel} · {group.thickness} mm
      </h4>
      <Badge>{group.sheets.length} chapa(s) inteira(s)</Badge>
      <Badge variant="muted">consumo real ≈ {fmt(group.sheetEquivalent)} chapa</Badge>
      <Badge variant="accent">aproveitamento {fmtPct(group.utilization)}</Badge>
      <Badge variant={waste > 0.4 ? 'danger' : 'muted'}>perda {fmtPct(waste)}</Badge>
    </div>
  );
}

export function CuttingPlan() {
  const { nesting, sheet, model } = useResults();
  const hoveredId = useProjectStore((s) => s.hoveredPieceId);
  const hoverPiece = useProjectStore((s) => s.hoverPiece);
  const colorFor = (group: NestingResult) => {
    const firstId = group.sheets[0]?.placements[0]?.pieceId;
    const role = model.pieces.find((p) => p.id === firstId)?.material ?? 'carcass';
    return MATERIAL_COLORS[role];
  };
  const totalSheets = nesting.reduce((n, g) => n + g.sheets.length, 0);

  return (
    <div className="h-full space-y-6 overflow-auto p-4">
      <p className="text-xs text-subtle">
        Chapa {sheet.length} × {sheet.width} mm · kerf {sheet.kerf} mm · refilo {sheet.trim} mm · total de <strong>{totalSheets}</strong> chapa(s). Algoritmo guilhotina
        (cortes de ponta a ponta), compatível com seccionadora e serra circular com guia. Hachurado = sobra/retalho.
      </p>
      {nesting.map((group) => (
        <section key={group.materialKey} className="space-y-3">
          <NestingSummary group={group} />
          {group.unplaced.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-xs text-danger">
              <AlertTriangle className="size-4" />
              Não cabem na chapa: {group.unplaced.map((u) => `${u.label} (${u.length}×${u.width})`).join(', ')}
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {group.sheets.map((layout) => (
              <figure key={layout.index} className="space-y-1">
                <figcaption className="flex justify-between text-xs text-subtle">
                  <span>Chapa {layout.index + 1}</span>
                  <span>{layout.placements.length} peças · {fmtPct(layout.utilization)}</span>
                </figcaption>
                <SheetDiagram layout={layout} sheet={sheet} color={colorFor(group)} hoveredId={hoveredId} onHover={hoverPiece} className="w-full rounded border border-border bg-surface" />
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
