/**
 * Painel lateral de parâmetros: dimensões, chapas, base, fundo, frentes, montagem, vãos,
 * materiais e configuração da chapa para o plano de corte.
 */
import { Box, Columns3, Hammer, Layers, PanelBottom, RotateCcw, Ruler, Scissors, SquareStack } from 'lucide-react';
import { useProjectStore, useActiveCabinetParams } from '@/store/projectStore';
import { TEMPLATES } from '@/engine/templates';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { AssemblyMethod, CabinetParams, MaterialRole } from '@/types/woodcraft';
import { FieldRow, NumberInput, Section, Segmented, SliderField, ThicknessPicker } from './fields';
import { ColumnEditor } from './ColumnEditor';

const ASSEMBLY_OPTIONS: { value: AssemblyMethod; label: string; title: string }[] = [
  { value: 'screw', label: 'Parafuso', title: 'Parafuso direto (chipboard) com pré-furo' },
  { value: 'minifix', label: 'Minifix', title: 'Minifix + cavilhas (desmontável)' },
  { value: 'dowel', label: 'Cavilha', title: 'Cavilhas coladas' },
];

function CabinetForm({ params }: { params: CabinetParams }) {
  const templateId = useProjectStore((s) => s.templateId);
  const update = useProjectStore((s) => s.updateCabinet);
  const limits = TEMPLATES[templateId].limits;

  return (
    <>
      <Section title="Dimensões externas" icon={<Ruler />}>
        <SliderField label="Largura" value={params.width} min={limits.width[0]} max={limits.width[1]} step={10} onChange={(width) => update({ width })} />
        <SliderField label="Altura" value={params.height} min={limits.height[0]} max={limits.height[1]} step={10} onChange={(height) => update({ height })} hint={params.baseType !== 'none' ? 'Inclui o rodapé/pés; não inclui tampo de pedra.' : undefined} />
        <SliderField label="Profundidade" value={params.depth} min={limits.depth[0]} max={limits.depth[1]} step={10} onChange={(depth) => update({ depth })} hint="Profundidade da caixa, sem as frentes." />
      </Section>

      <Section title="Chapas" icon={<Layers />}>
        <FieldRow label="Caixa">
          <ThicknessPicker value={params.carcassThickness} presets={[15, 18, 25]} onChange={(carcassThickness) => update({ carcassThickness })} />
        </FieldRow>
        <FieldRow label="Frentes">
          <ThicknessPicker value={params.frontThickness} presets={[15, 18]} onChange={(frontThickness) => update({ frontThickness })} />
        </FieldRow>
        <FieldRow label="Fundo">
          <ThicknessPicker
            value={params.backThickness}
            presets={[3, 6]}
            extra={{ label: '= caixa', value: params.carcassThickness }}
            onChange={(backThickness) => update({ backThickness })}
          />
        </FieldRow>
        <FieldRow label="Caixa de gaveta">
          <ThicknessPicker value={params.drawerBoxThickness} presets={[15, 18]} onChange={(drawerBoxThickness) => update({ drawerBoxThickness })} />
        </FieldRow>
      </Section>

      <Section title="Base, tampo e fundo" icon={<PanelBottom />}>
        <FieldRow label="Apoio">
          <Segmented
            aria-label="Apoio"
            value={params.baseType}
            onChange={(baseType) => update({ baseType })}
            options={[
              { value: 'plinth', label: 'Rodapé' },
              { value: 'feet', label: 'Pés' },
              { value: 'none', label: 'Suspenso' },
            ]}
          />
        </FieldRow>
        {params.baseType !== 'none' && (
          <SliderField label={params.baseType === 'plinth' ? 'Altura do rodapé' : 'Altura dos pés'} value={params.plinthHeight} min={0} max={250} step={5} onChange={(plinthHeight) => update({ plinthHeight })} />
        )}
        {params.baseType === 'plinth' && (
          <SliderField label="Recuo do rodapé" value={params.plinthSetback} min={0} max={120} step={5} onChange={(plinthSetback) => update({ plinthSetback })} />
        )}
        <FieldRow label="Tampo da caixa">
          <Segmented
            aria-label="Tampo"
            value={params.topType}
            onChange={(topType) => update({ topType })}
            options={[
              { value: 'full', label: 'Inteiro' },
              { value: 'rails', label: 'Travessas', title: 'Duas travessas de 100 mm (tampo de pedra por cima)' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Fixação do fundo">
          <Segmented
            aria-label="Fundo"
            value={params.backMode}
            onChange={(backMode) => update({ backMode })}
            options={[
              { value: 'overlay', label: 'Pregado' },
              { value: 'groove', label: 'Em rasgo' },
            ]}
          />
        </FieldRow>
      </Section>

      <Section title="Vãos, divisórias e prateleiras" icon={<Columns3 />}>
        <ColumnEditor params={params} showRod={templateId === 'wardrobe'} />
      </Section>

      <Section title="Frentes e montagem" icon={<Hammer />} defaultOpen={false}>
        <SliderField label="Folga entre frentes" value={params.frontGap} min={0} max={6} step={0.5} onChange={(frontGap) => update({ frontGap })} />
        <SliderField
          label="Altura da frente de gaveta"
          value={params.drawerFrontHeight}
          min={100}
          max={400}
          step={5}
          onChange={(drawerFrontHeight) => update({ drawerFrontHeight })}
          hint="Usada quando o vão combina gavetas e porta."
        />
        <FieldRow label="Montagem">
          <Segmented aria-label="Montagem" value={params.assembly} onChange={(assembly) => update({ assembly })} options={ASSEMBLY_OPTIONS} />
        </FieldRow>
      </Section>
    </>
  );
}

function WorkbenchForm() {
  const p = useProjectStore((s) => s.workbenchParams);
  const update = useProjectStore((s) => s.updateWorkbench);
  const limits = TEMPLATES.workbench.limits;
  return (
    <>
      <Section title="Dimensões externas" icon={<Ruler />}>
        <SliderField label="Largura" value={p.width} min={limits.width[0]} max={limits.width[1]} step={10} onChange={(width) => update({ width })} />
        <SliderField label="Altura" value={p.height} min={limits.height[0]} max={limits.height[1]} step={10} onChange={(height) => update({ height })} />
        <SliderField label="Profundidade" value={p.depth} min={limits.depth[0]} max={limits.depth[1]} step={10} onChange={(depth) => update({ depth })} />
      </Section>
      <Section title="Estrutura" icon={<Layers />}>
        <FieldRow label="Tampo">
          <ThicknessPicker value={p.topThickness} presets={[18, 25, 36]} onChange={(topThickness) => update({ topThickness })} />
        </FieldRow>
        <FieldRow label="Painéis">
          <ThicknessPicker value={p.panelThickness} presets={[15, 18, 25]} onChange={(panelThickness) => update({ panelThickness })} />
        </FieldRow>
        <SliderField label="Balanço do tampo" value={p.sideOverhang} min={0} max={200} step={5} onChange={(sideOverhang) => update({ sideOverhang })} />
        <SliderField label="Altura da saia traseira" value={p.apronHeight} min={60} max={300} step={5} onChange={(apronHeight) => update({ apronHeight })} />
        <FieldRow label="Prateleira inferior">
          <Switch checked={p.lowerShelf} onCheckedChange={(lowerShelf) => update({ lowerShelf })} aria-label="Prateleira inferior" />
        </FieldRow>
        {p.lowerShelf && (
          <SliderField label="Altura da prateleira" value={p.lowerShelfHeight} min={50} max={500} step={10} onChange={(lowerShelfHeight) => update({ lowerShelfHeight })} />
        )}
        <FieldRow label="Montagem">
          <Segmented aria-label="Montagem" value={p.assembly} onChange={(assembly) => update({ assembly })} options={ASSEMBLY_OPTIONS} />
        </FieldRow>
      </Section>
    </>
  );
}

const MATERIAL_LABELS: Record<MaterialRole, string> = {
  carcass: 'Caixa',
  front: 'Frentes',
  back: 'Fundos',
  drawer: 'Gavetas',
};

function MaterialsForm() {
  const sheet = useProjectStore((s) => s.sheet);
  const setSheet = useProjectStore((s) => s.setSheet);
  const materials = useProjectStore((s) => s.materials);
  const setMaterial = useProjectStore((s) => s.setMaterial);
  const services = useProjectStore((s) => s.services);
  const setServices = useProjectStore((s) => s.setServices);
  const isWorkbench = useProjectStore((s) => s.templateId === 'workbench');
  const roles: MaterialRole[] = isWorkbench ? ['carcass'] : ['carcass', 'front', 'back', 'drawer'];

  return (
    <>
      <Section title="Materiais" icon={<SquareStack />} defaultOpen={false}>
        <p className="text-[11px] leading-snug text-subtle">
          Materiais com o mesmo nome e espessura dividem as mesmas chapas. Marque “veio” para chapas amadeiradas: as peças não serão giradas no plano de corte.
        </p>
        {roles.map((role) => (
          <div key={role} className="space-y-1">
            <span className="text-xs font-medium text-subtle">{MATERIAL_LABELS[role]}</span>
            <div className="flex items-center gap-2">
              <input
                value={materials[role].label}
                onChange={(e) => setMaterial(role, { label: e.target.value })}
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={`Material ${MATERIAL_LABELS[role]}`}
              />
              <label className="flex items-center gap-1.5 text-xs text-subtle">
                <Switch checked={materials[role].hasGrain} onCheckedChange={(hasGrain) => setMaterial(role, { hasGrain })} aria-label={`Veio ${MATERIAL_LABELS[role]}`} />
                Veio
              </label>
            </div>
          </div>
        ))}
      </Section>
      <Section title="Chapa e serviços" icon={<Scissors />} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-subtle">Comprimento</span>
            <NumberInput value={sheet.length} min={500} max={4000} onChange={(length) => setSheet({ length })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-subtle">Largura</span>
            <NumberInput value={sheet.width} min={300} max={2500} onChange={(width) => setSheet({ width })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-subtle">Kerf (serra)</span>
            <NumberInput value={sheet.kerf} min={0} max={10} step={0.5} onChange={(kerf) => setSheet({ kerf })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-subtle">Refilo</span>
            <NumberInput value={sheet.trim} min={0} max={50} onChange={(trim) => setSheet({ trim })} />
          </label>
        </div>
        <Segmented
          aria-label="Chapas comerciais"
          className="w-full"
          value={`${sheet.length}x${sheet.width}`}
          onChange={(v) => {
            const [length, width] = v.split('x').map(Number);
            setSheet({ length: length!, width: width! });
          }}
          options={[
            { value: '2750x1830', label: '2750×1830' },
            { value: '2750x1850', label: '2750×1850' },
            { value: '2440x1220', label: '2440×1220' },
          ]}
        />
        <FieldRow label="Corte na madeireira">
          <Switch checked={services.outsourcedCutting} onCheckedChange={(outsourcedCutting) => setServices({ outsourcedCutting })} aria-label="Corte na madeireira" />
        </FieldRow>
        <FieldRow label="Fita aplicada na madeireira">
          <Switch checked={services.outsourcedEdgeBanding} onCheckedChange={(outsourcedEdgeBanding) => setServices({ outsourcedEdgeBanding })} aria-label="Fitagem na madeireira" />
        </FieldRow>
      </Section>
    </>
  );
}

export function ParameterPanel() {
  const templateId = useProjectStore((s) => s.templateId);
  const resetTemplate = useProjectStore((s) => s.resetTemplate);
  const cabinet = useActiveCabinetParams();
  const template = TEMPLATES[templateId];

  return (
    <aside className="flex flex-col border-b border-border bg-surface lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <Box className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{template.name}</h2>
          <p className="text-xs leading-snug text-subtle">{template.description}</p>
        </div>
        <Button variant="ghost" size="icon" title="Restaurar padrão do template" aria-label="Restaurar padrão" onClick={resetTemplate}>
          <RotateCcw />
        </Button>
      </div>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {cabinet ? <CabinetForm params={cabinet} /> : <WorkbenchForm />}
        <MaterialsForm />
      </div>
    </aside>
  );
}
