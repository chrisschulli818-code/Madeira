/**
 * Editor do móvel livre: lista de painéis com medidas, espessura, posição, função e fita.
 * O painel selecionado no editor é destacado no 3D e vice-versa.
 */
import { useEffect, useRef } from 'react';
import { ArrowRightLeft, Copy, Hammer, Layers, Plus, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { PANEL_KIND_LABELS, PANEL_PRESETS } from '@/engine/customEngine';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AssemblyMethod, CustomPanel, CustomPanelKind, CustomParams, PanelOrientation } from '@/types/woodcraft';
import { FieldRow, NumberInput, Section, Segmented, Stepper } from './fields';

const ORIENTATION_OPTIONS: Array<{ value: PanelOrientation; label: string; title: string }> = [
  { value: 'side', label: 'Em pé, lateral', title: 'Como uma lateral: espessura no eixo X' },
  { value: 'front', label: 'Em pé, frontal', title: 'Como um fundo ou porta: espessura no eixo Z' },
  { value: 'horizontal', label: 'Deitado', title: 'Como base, tampo ou prateleira: espessura no eixo Y' },
];

const ASSEMBLY_OPTIONS: { value: AssemblyMethod; label: string }[] = [
  { value: 'screw', label: 'Parafuso' },
  { value: 'minifix', label: 'Minifix' },
  { value: 'dowel', label: 'Cavilha' },
];

/** Campo numérico compacto com rótulo em cima. */
function Num({ label, value, onChange, min = 0, max = 5000 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="min-w-0 space-y-0.5">
      <span className="block text-[11px] font-medium text-subtle">{label}</span>
      <NumberInput value={value} onChange={onChange} min={min} max={max} aria-label={label} />
    </label>
  );
}

function PanelCard({ panel, selected, onSelect }: { panel: CustomPanel; selected: boolean; onSelect: () => void }) {
  const update = useProjectStore((s) => s.updatePanel);
  const duplicate = useProjectStore((s) => s.duplicatePanel);
  const remove = useProjectStore((s) => s.removePanel);
  const set = (patch: Partial<CustomPanel>) => update(panel.id, patch);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  // Medidas visíveis conforme a orientação (a terceira é a espessura).
  const isDrawer = panel.kind === 'gaveta';
  const dims = isDrawer
    ? [['Largura do vão', 'width'], ['Altura da frente', 'height'], ['Profund. do vão', 'depth']]
    : panel.orientation === 'side'
      ? [['Altura (Y)', 'height'], ['Profund. (Z)', 'depth']]
      : panel.orientation === 'front'
        ? [['Largura (X)', 'width'], ['Altura (Y)', 'height']]
        : [['Largura (X)', 'width'], ['Profund. (Z)', 'depth']];
  const summary = dims.map(([, k]) => Math.round(panel[k as 'width' | 'height' | 'depth'])).join(' × ') + ` × ${panel.thickness}`;

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={cn(
        'rounded-lg border bg-background transition-colors',
        selected ? 'border-accent ring-1 ring-accent' : 'cursor-pointer border-border hover:border-primary/40',
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <input
          value={panel.name}
          onChange={(e) => set({ name: e.target.value })}
          aria-label="Nome do painel"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border focus:border-primary focus:outline-none"
        />
        {!selected && <span className="shrink-0 text-xs tabular-nums text-subtle">{summary}</span>}
        <button type="button" title="Duplicar painel" aria-label="Duplicar painel" onClick={(e) => (e.stopPropagation(), duplicate(panel.id))} className="grid size-7 place-items-center rounded text-subtle hover:bg-muted hover:text-foreground">
          <Copy className="size-3.5" />
        </button>
        <button type="button" title="Remover painel" aria-label="Remover painel" onClick={(e) => (e.stopPropagation(), remove(panel.id))} className="grid size-7 place-items-center rounded text-subtle hover:bg-muted hover:text-danger">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {selected && (
        <div className="space-y-3 border-t border-border px-2.5 pb-3 pt-2.5" onClick={(e) => e.stopPropagation()}>
          <FieldRow label="Função">
            <select
              value={panel.kind}
              onChange={(e) => {
                const kind = e.target.value as CustomPanelKind;
                set({
                  kind,
                  ...(kind === 'fundo' ? { edgeBanding: { length: 0, width: 0 }, grainLocked: false } : {}),
                  ...(kind === 'porta' || kind === 'frente' || kind === 'gaveta' ? { edgeBanding: { length: 2, width: 2 } } : {}),
                  ...(kind === 'gaveta' ? { orientation: 'front' as const, height: Math.min(panel.height, 250), thickness: 18 } : {}),
                });
              }}
              aria-label="Função do painel"
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none"
            >
              {(Object.keys(PANEL_KIND_LABELS) as CustomPanelKind[]).map((k) => (
                <option key={k} value={k}>
                  {PANEL_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </FieldRow>
          {isDrawer ? (
            <p className="text-[11px] leading-snug text-subtle">
              Módulo com frente, caixa de gaveta e corrediça telescópica. Arraste no 3D ou na vista frontal: ele encaixa entre as
              laterais e sobre a peça de baixo.
            </p>
          ) : (
            <div className="space-y-1">
              <span className="text-xs font-medium text-subtle">Orientação</span>
              <Segmented aria-label="Orientação" className="w-full" value={panel.orientation} onChange={(orientation) => set({ orientation })} options={ORIENTATION_OPTIONS} />
            </div>
          )}
          <div className={cn('grid gap-2', isDrawer ? 'grid-cols-2' : 'grid-cols-3')}>
            {dims.map(([label, key]) => (
              <Num key={key} label={label!} value={panel[key as 'width' | 'height' | 'depth']} min={1} onChange={(v) => set({ [key as string]: v })} />
            ))}
            <Num label={isDrawer ? 'Espessura da frente' : 'Espessura'} value={panel.thickness} min={1} max={100} onChange={(thickness) => set({ thickness })} />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-subtle">
              {isDrawer ? 'Posição do vão: canto inferior esquerdo traseiro (mm)' : 'Posição do canto inferior esquerdo traseiro (mm)'}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <Num label="X (→)" value={panel.x} min={-5000} onChange={(x) => set({ x })} />
              <Num label="Y (↑)" value={panel.y} min={-5000} onChange={(y) => set({ y })} />
              <Num label="Z (frente)" value={panel.z} min={-5000} onChange={(z) => set({ z })} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-subtle">Fita de borda</span>
            <span className="flex items-center gap-1.5 text-xs text-subtle">
              C <Stepper value={panel.edgeBanding.length} max={2} onChange={(length) => set({ edgeBanding: { ...panel.edgeBanding, length: length as 0 | 1 | 2 } })} aria-label="Fita no comprimento" />
              L <Stepper value={panel.edgeBanding.width} max={2} onChange={(width) => set({ edgeBanding: { ...panel.edgeBanding, width: width as 0 | 1 | 2 } })} aria-label="Fita na largura" />
            </span>
          </div>
          <FieldRow label="Veio travado no comprimento">
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="size-3.5 text-subtle" />
              <Switch checked={panel.grainLocked} onCheckedChange={(grainLocked) => set({ grainLocked })} aria-label="Veio travado" />
            </span>
          </FieldRow>
        </div>
      )}
    </div>
  );
}

export function CustomPanelEditor({ params, itemId }: { params: CustomParams; itemId: string }) {
  const addPanel = useProjectStore((s) => s.addPanel);
  const updateCustom = useProjectStore((s) => s.updateCustom);
  const selectedPieceId = useProjectStore((s) => s.selectedPieceId);
  const selectPiece = useProjectStore((s) => s.selectPiece);
  const { model } = useResults();

  // Painel ↔ peça da lista de corte (painéis iguais formam uma linha com vários ids de origem).
  const pieceOfPanel = new Map(model.pieces.flatMap((piece) => (piece.sourceIds ?? []).map((sid) => [sid, piece.id] as const)));
  const selectedPiece = model.pieces.find((p) => p.id === selectedPieceId);
  const selectedPanels = new Set(selectedPiece?.sourceIds ?? []);

  const add = (preset: (typeof PANEL_PRESETS)[number]['id']) => {
    const created = addPanel(preset);
    // Seleciona o painel novo (o id da peça só existe após o recálculo).
    if (created) requestAnimationFrame(() => selectPiece(`${itemId}/__panel:${created.id}`));
  };

  // Resolve a seleção pendente de painel recém-criado para o id real da peça.
  useEffect(() => {
    const prefix = `${itemId}/__panel:`;
    if (selectedPieceId?.startsWith(prefix)) {
      const pieceId = pieceOfPanel.get(selectedPieceId.slice(prefix.length));
      if (pieceId) selectPiece(pieceId);
    }
  });

  return (
    <>
      <Section title={`Peças do móvel (${params.panels.length})`} icon={<Layers />} mobileOpen>
        {params.panels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background p-4 text-center text-sm text-subtle">
            Tela em branco. Adicione a primeira peça abaixo — cada nova peça é posicionada ao lado ou em cima das anteriores,
            e você ajusta medidas e posição à vontade.
          </div>
        ) : (
          <div className="space-y-2">
            {params.panels.map((panel) => (
              <PanelCard
                key={panel.id}
                panel={panel}
                selected={selectedPanels.has(panel.id)}
                onSelect={() => {
                  const pieceId = pieceOfPanel.get(panel.id);
                  if (pieceId) selectPiece(pieceId);
                }}
              />
            ))}
          </div>
        )}
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-subtle">
            <Plus className="size-3.5" /> Adicionar peça
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {PANEL_PRESETS.map((preset) => (
              <Button key={preset.id} variant="outline" size="sm" title={preset.hint} onClick={() => add(preset.id)}>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[11px] leading-snug text-subtle">
          Arraste as peças no 3D ou na vista frontal: prateleiras e gavetas se encaixam entre as laterais e sobre as peças
          vizinhas. Eixos: X da esquerda para a direita, Y do chão para cima, Z do fundo para a frente. Painéis de estrutura que se encostam
          viram junções automaticamente (parafusos/minifix/cavilhas na lista de compras).
        </p>
      </Section>
      <Section title="Montagem" icon={<Hammer />} defaultOpen={false}>
        <FieldRow label="Método">
          <Segmented aria-label="Montagem" value={params.assembly} onChange={(assembly) => updateCustom({ assembly })} options={ASSEMBLY_OPTIONS} />
        </FieldRow>
      </Section>
    </>
  );
}
