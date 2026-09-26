/**
 * Tabela de corte interativa: passar o mouse destaca a peça no viewport e vice-versa.
 * Exporta CSV para a madeireira e dispara a impressão do relatório.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Download, FileDown, Printer } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { cutListToCsv } from '@/engine/exporters';
import { edgeBandingLabel, edgeBandingMeters, pieceArea } from '@/engine/cabinetEngine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MATERIAL_COLORS } from '@/lib/pieceColors';
import { cn, downloadFile, fmt, slugify } from '@/lib/utils';
import type { CutPiece, MaterialRole, MaterialSpec, ProjectPiece } from '@/types/woodcraft';
import { EdgeBandIcon } from './EdgeBandIcon';
import { Segmented } from '@/components/params/fields';
import { useExportPdf } from '@/hooks/useExportPdf';

export function CutListTotals({ pieces }: { pieces: CutPiece[] }) {
  const units = pieces.reduce((n, p) => n + p.quantity, 0);
  const area = pieces.reduce((n, p) => n + pieceArea(p), 0);
  const band = pieces.reduce((n, p) => n + edgeBandingMeters(p), 0);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Badge variant="muted">{pieces.length} tipos · {units} peças</Badge>
      <Badge variant="muted">{fmt(area)} m² de chapa</Badge>
      <Badge variant="muted">{fmt(band)} m de fita (líquido)</Badge>
    </div>
  );
}

/** Tabela "pura" (sem interação) — também usada no relatório impresso. */
export function CutListRows({
  pieces,
  materials,
  showItem = false,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  rowRefs,
}: {
  pieces: Array<CutPiece | ProjectPiece>;
  materials: Record<MaterialRole, MaterialSpec>;
  /** Mostra a coluna "Móvel" (projetos com vários móveis). */
  showItem?: boolean;
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string | null) => void;
  rowRefs?: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-subtle print:static">
        <tr>
          <th className="px-3 py-2 font-medium">Peça</th>
          {showItem && <th className="px-2 py-2 font-medium">Móvel</th>}
          <th className="px-2 py-2 text-right font-medium">Qtd</th>
          <th className="px-2 py-2 text-right font-medium" title="Comprimento no sentido do veio">Compr.</th>
          <th className="px-2 py-2 text-right font-medium">Larg.</th>
          <th className="px-2 py-2 text-right font-medium">Esp.</th>
          <th className="px-2 py-2 font-medium">Fita</th>
          <th className="px-3 py-2 font-medium">Material</th>
        </tr>
      </thead>
      <tbody>
        {pieces.map((p) => {
          const lockedGrain = p.grain === 'length' && materials[p.material].hasGrain;
          return (
            <tr
              key={p.id}
              ref={(el) => {
                if (!rowRefs) return;
                if (el) rowRefs.current.set(p.id, el);
                else rowRefs.current.delete(p.id);
              }}
              onMouseEnter={() => onHover?.(p.id)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onSelect?.(selectedId === p.id ? null : p.id)}
              className={cn(
                'avoid-break border-b border-border/70 transition-colors',
                onHover && 'cursor-pointer hover:bg-primary-soft/60',
                hoveredId === p.id && 'bg-primary-soft',
                selectedId === p.id && 'bg-teal-50 ring-1 ring-inset ring-accent',
              )}
            >
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm border border-black/10" style={{ background: MATERIAL_COLORS[p.material] }} />
                  <span className="font-medium">{p.name}</span>
                  {lockedGrain && <ArrowRightLeft className="size-3 text-subtle" aria-label="Veio no comprimento" />}
                </div>
                {p.notes && <div className="pl-4.5 text-[11px] text-subtle">{p.notes}</div>}
              </td>
              {showItem && <td className="px-2 py-1.5 text-xs text-subtle">{'itemName' in p ? p.itemName : ''}</td>}
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{p.quantity}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{p.length}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{p.width}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{p.thickness}</td>
              <td className="px-2 py-1.5">
                <span className="flex items-center gap-1.5 text-xs text-subtle">
                  <EdgeBandIcon edge={p.edgeBanding} className="print:hidden" />
                  {edgeBandingLabel(p.edgeBanding)}
                </span>
              </td>
              <td className="px-3 py-1.5 text-xs text-subtle">{materials[p.material].label}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function CutListTable() {
  const { pieces: allPieces, materials, active, items } = useResults();
  const projectName = useProjectStore((s) => s.projectName);
  const hoveredId = useProjectStore((s) => s.hoveredPieceId);
  const selectedId = useProjectStore((s) => s.selectedPieceId);
  const hoverPiece = useProjectStore((s) => s.hoverPiece);
  const selectPiece = useProjectStore((s) => s.selectPiece);
  const setActiveItem = useProjectStore((s) => s.setActiveItem);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const { exportPdf, exporting } = useExportPdf();
  const [scope, setScope] = useState<'all' | 'active'>('all');

  const multi = items.length > 1;
  const pieces = multi && scope === 'active' ? allPieces.filter((p) => p.itemId === active.item.id) : allPieces;

  // Peça selecionada no 3D → rola a tabela até a linha correspondente.
  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  /** Clicar numa peça de outro móvel abre esse móvel no viewport. */
  const onSelect = (id: string | null) => {
    const piece = id ? allPieces.find((p) => p.id === id) : undefined;
    if (piece && piece.itemId !== active.item.id) setActiveItem(piece.itemId);
    selectPiece(id);
  };

  const exportCsv = () => downloadFile(`${slugify(projectName)}-lista-de-corte.csv`, cutListToCsv(pieces, materials));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {multi && (
            <Segmented
              aria-label="Peças exibidas"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'all', label: `Projeto (${items.length} móveis)` },
                { value: 'active', label: `Só ${active.item.name}` },
              ]}
            />
          )}
          <CutListTotals pieces={pieces} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
            <FileDown /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CutListRows
          pieces={pieces}
          materials={materials}
          showItem={multi && scope === 'all'}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={hoverPiece}
          onSelect={onSelect}
          rowRefs={rowRefs}
        />
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-subtle">
        Comprimento = sentido do veio. Fita: C = lados do comprimento, L = lados da largura. Medidas finais de corte em mm
        {multi ? '; quantidades já multiplicadas pelos móveis iguais.' : '.'}
      </p>
    </div>
  );
}
