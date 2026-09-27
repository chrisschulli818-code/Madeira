/**
 * Painel lateral do modo Ambiente.
 * - "Cômodo e móveis": lista de móveis, colocar móveis (Meus móveis ou modelos), medidas, portas e janelas.
 * - "Móvel": o móvel selecionado — posição no cômodo e editor completo (medidas, vãos, peças), sem sair do ambiente.
 */
import { Copy, DoorOpen, Home, LayoutGrid, Move, Palette, Pencil, Plus, RotateCcw, RotateCw, Sofa, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { moveToWall, rotatePlacement, snapPlacement, WALL_LABELS } from '@/engine/roomEngine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ResolvedPlacement, WallSide } from '@/types/woodcraft';
import { FieldRow, NumberInput, Section, Segmented, SliderField } from '@/components/params/fields';
import { ItemEditorForms, ItemEditorHeader } from '@/components/params/ParameterPanel';
import { MyFurniture } from '@/components/library/MyFurniture';
import { TEMPLATE_ICONS } from '@/components/layout/ProjectItemsBar';
import { TEMPLATE_LIST } from '@/engine/templates';
import { PROP_CATALOG } from '@/engine/propEngine';
import { FURNITURE_COLORS } from './roomColors';
import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR } from './roomDefaults';

const WALLS: WallSide[] = ['fundo', 'esquerda', 'direita', 'frente'];
const WALL_SHORT: Record<WallSide, string> = { fundo: 'Fundo', esquerda: 'Esquerda', direita: 'Direita', frente: 'Frente' };

function OpeningsEditor() {
  const room = useProjectStore((s) => s.room);
  const addOpening = useProjectStore((s) => s.addOpening);
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const removeOpening = useProjectStore((s) => s.removeOpening);
  return (
    <div className="space-y-2">
      {room.openings.map((o) => (
        <div key={o.id} className="space-y-2 rounded-lg border border-border bg-background p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{o.kind === 'porta' ? 'Porta' : 'Janela'}</span>
            <select
              value={o.wall}
              onChange={(e) => updateOpening(o.id, { wall: e.target.value as WallSide })}
              aria-label="Parede"
              className="h-7 flex-1 rounded-md border border-border bg-surface px-1.5 text-xs"
            >
              {WALLS.map((w) => (
                <option key={w} value={w}>
                  {WALL_LABELS[w]}
                </option>
              ))}
            </select>
            <button type="button" aria-label="Remover abertura" onClick={() => removeOpening(o.id)} className="grid size-7 place-items-center rounded text-subtle hover:bg-muted hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className={cn('grid gap-2', o.kind === 'janela' ? 'grid-cols-4' : 'grid-cols-3')}>
            <label className="space-y-0.5">
              <span className="block text-[11px] text-subtle">Distância</span>
              <NumberInput value={o.offset} min={0} max={20000} onChange={(offset) => updateOpening(o.id, { offset })} />
            </label>
            <label className="space-y-0.5">
              <span className="block text-[11px] text-subtle">Largura</span>
              <NumberInput value={o.width} min={100} max={5000} onChange={(width) => updateOpening(o.id, { width })} />
            </label>
            <label className="space-y-0.5">
              <span className="block text-[11px] text-subtle">Altura</span>
              <NumberInput value={o.height} min={100} max={3000} onChange={(height) => updateOpening(o.id, { height })} />
            </label>
            {o.kind === 'janela' && (
              <label className="space-y-0.5">
                <span className="block text-[11px] text-subtle">Peitoril</span>
                <NumberInput value={o.sill} min={0} max={2500} onChange={(sill) => updateOpening(o.id, { sill })} />
              </label>
            )}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="outline" size="sm" onClick={() => addOpening('porta')}>
          + Porta
        </Button>
        <Button variant="outline" size="sm" onClick={() => addOpening('janela')}>
          + Janela
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-subtle">Distância: da ponta esquerda (paredes do fundo e da frente) ou do fundo (paredes laterais) até a abertura.</p>
    </div>
  );
}

/** Controles de posição do móvel selecionado: girar, encostar na parede, X/Z e altura do piso. */
function PlacementControls({ p, all }: { p: ResolvedPlacement; all: ResolvedPlacement[] }) {
  const room = useProjectStore((s) => s.room);
  const setPlacement = useProjectStore((s) => s.setPlacement);
  const others = all.filter((o) => o.key !== p.key);
  const save = (r: { x: number; z: number; rotation: ResolvedPlacement['rotation'] }, elevation = p.elevation) =>
    setPlacement({ itemId: p.itemId, unit: p.unit, elevation, ...r });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => save(rotatePlacement(p, room, others, -1))}>
          <RotateCcw /> Girar
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => save(rotatePlacement(p, room, others, 1))}>
          <RotateCw /> Girar
        </Button>
      </div>
      <div className="space-y-1">
        <span className="text-xs font-medium text-subtle">Encostar na parede</span>
        <div className="grid grid-cols-4 gap-1">
          {WALLS.map((w) => (
            <Button key={w} variant={p.wall === w ? 'default' : 'outline'} size="sm" className="px-1 text-[11px]" onClick={() => save(moveToWall(p, w, room, others))}>
              {WALL_SHORT[w]}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-0.5">
          <span className="block text-[11px] text-subtle">X</span>
          <NumberInput value={p.x} min={-20000} max={20000} onChange={(x) => save(snapPlacement(p, { x, z: p.z }, room, others, false))} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[11px] text-subtle">Z</span>
          <NumberInput value={p.z} min={-20000} max={20000} onChange={(z) => save(snapPlacement(p, { x: p.x, z }, room, others, false))} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[11px] text-subtle">Do piso</span>
          <NumberInput value={p.elevation} min={0} max={3000} onChange={(elevation) => save({ x: p.x, z: p.z, rotation: p.rotation }, elevation)} />
        </label>
      </div>
    </div>
  );
}

/** Aba "Móvel": posição no cômodo + editor completo do móvel, sem sair do ambiente. */
function SelectedFurniture({ p, all }: { p: ResolvedPlacement; all: ResolvedPlacement[] }) {
  const duplicateItem = useProjectStore((s) => s.duplicateItem);
  const removeItem = useProjectStore((s) => s.removeItem);
  const itemCount = useProjectStore((s) => s.items.length);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);

  return (
    <>
      <ItemEditorHeader />
      <Section title="Posição no cômodo" icon={<Move />} mobileOpen>
        <PlacementControls p={p} all={all} />
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => duplicateItem(p.itemId)} title="Duplicar este móvel">
            <Copy /> Duplicar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewMode('furniture')} title="Abrir no editor com vista frontal e arraste de peças">
            <Pencil /> Editor
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hover:text-danger"
            disabled={itemCount <= 1}
            onClick={() => {
              if (!confirm(`Remover "${p.name}" do projeto?`)) return;
              selectPlacement(null);
              removeItem(p.itemId);
            }}
          >
            <Trash2 /> Remover
          </Button>
        </div>
      </Section>
      <ItemEditorForms />
    </>
  );
}

function RoomSettingsTab() {
  const room = useProjectStore((s) => s.room);
  const setRoom = useProjectStore((s) => s.setRoom);
  const resetPlacements = useProjectStore((s) => s.resetPlacements);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const addItem = useProjectStore((s) => s.addItem);
  const addProp = useProjectStore((s) => s.addProp);
  const { placements } = useResults();

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <Home className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <input
            value={room.name}
            onChange={(e) => setRoom({ name: e.target.value })}
            aria-label="Nome do ambiente"
            className="w-full rounded border border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border focus:border-primary focus:outline-none"
          />
          <p className="px-1 text-xs leading-snug text-subtle">Clique num móvel (na lista, na planta ou no 3D) para posicioná-lo e editar suas medidas aqui mesmo.</p>
        </div>
      </div>
      <Section title={`Móveis no ambiente (${placements.length})`} icon={<LayoutGrid />} mobileOpen>
        <div className="space-y-1.5">
          {placements.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPlacement(p.key)}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left hover:border-primary/40"
            >
              <span className="size-3 shrink-0 rounded-sm border border-black/10" style={{ background: FURNITURE_COLORS[p.templateId] }} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
              <span className="shrink-0 text-[11px] text-subtle">{p.wall ? WALL_SHORT[p.wall] : 'solto'}</span>
              <Pencil className="size-3.5 shrink-0 text-subtle" />
            </button>
          ))}
        </div>
        <FieldRow label="Organização automática">
          <Button variant="ghost" size="sm" onClick={() => confirm('Voltar todos os móveis para a posição automática?') && resetPlacements()}>
            Reorganizar
          </Button>
        </FieldRow>
      </Section>
      <Section title="Colocar móveis no ambiente" icon={<Plus />} mobileOpen>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-subtle">Meus móveis</span>
          <MyFurniture />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-subtle">Novo a partir de modelo</span>
          <div className="grid grid-cols-2 gap-1.5">
            {TEMPLATE_LIST.map((t) => (
              <Button key={t.id} variant="outline" size="sm" className="justify-start [&_svg]:text-primary" onClick={() => addItem(t.id)} title={t.description}>
                {TEMPLATE_ICONS[t.id]}
                <span className="truncate">{t.name}</span>
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[11px] leading-snug text-subtle">O móvel novo vai para um lugar livre junto às paredes e já fica selecionado para você ajustar.</p>
      </Section>
      <Section title="Objetos do ambiente" icon={<Sofa />} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          {PROP_CATALOG.map((prop) => (
            <Button key={prop.type} variant="outline" size="sm" className="justify-start" onClick={() => addProp(prop.type)}>
              <span className="size-3 shrink-0 rounded-sm border border-black/15" style={{ background: prop.color }} />
              <span className="truncate">{prop.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-subtle">Eletrodomésticos, sofá, mesa, TV... Só compõem o cômodo e as imagens: não entram no plano de corte, nas compras nem no orçamento.</p>
      </Section>
      <Section title="Cores do cômodo" icon={<Palette />} defaultOpen={false}>
        <FieldRow label="Paredes">
          <input type="color" aria-label="Cor das paredes" value={room.wallColor ?? DEFAULT_WALL_COLOR} onChange={(e) => setRoom({ wallColor: e.target.value })} className="h-8 w-14 cursor-pointer rounded border border-border bg-surface" />
        </FieldRow>
        <FieldRow label="Piso">
          <input type="color" aria-label="Cor do piso" value={room.floorColor ?? DEFAULT_FLOOR_COLOR} onChange={(e) => setRoom({ floorColor: e.target.value })} className="h-8 w-14 cursor-pointer rounded border border-border bg-surface" />
        </FieldRow>
        <div className="flex flex-wrap gap-1">
          {[
            ['Madeira', '#c9a77c'],
            ['Porcelanato', '#d9d6cf'],
            ['Cimento', '#9d9b96'],
            ['Escuro', '#6b4e36'],
          ].map(([label, color]) => (
            <Button key={label} variant="ghost" size="sm" className="px-2 text-[11px]" onClick={() => setRoom({ floorColor: color })}>
              <span className="size-3 rounded-sm border border-black/15" style={{ background: color }} /> {label}
            </Button>
          ))}
        </div>
      </Section>
      <Section title="Medidas do cômodo" icon={<Home />} defaultOpen={false}>
        <SliderField label="Largura (parede do fundo)" value={room.width} min={1000} max={12000} step={50} onChange={(width) => setRoom({ width })} />
        <SliderField label="Profundidade (paredes laterais)" value={room.depth} min={1000} max={12000} step={50} onChange={(depth) => setRoom({ depth })} />
        <SliderField label="Pé-direito" value={room.height} min={2000} max={4000} step={10} onChange={(height) => setRoom({ height })} />
      </Section>
      <Section title={`Portas e janelas (${room.openings.length})`} icon={<DoorOpen />} defaultOpen={false}>
        <OpeningsEditor />
      </Section>
    </>
  );
}

export function RoomPanel() {
  const selected = useProjectStore((s) => s.selectedPlacement);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const { placements } = useResults();
  const current = placements.find((p) => p.key === selected);

  return (
    <aside className="flex flex-col border-b border-border bg-surface lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Segmented
          aria-label="Painel do ambiente"
          className="flex-1"
          value={current ? 'movel' : 'comodo'}
          onChange={(v) => (v === 'comodo' ? selectPlacement(null) : !current && placements[0] && selectPlacement(placements[0].key))}
          options={[
            { value: 'comodo', label: 'Cômodo e móveis' },
            { value: 'movel', label: current ? `Móvel: ${current.name}` : 'Móvel selecionado' },
          ]}
        />
      </div>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {current ? <SelectedFurniture key={current.key} p={current} all={placements} /> : <RoomSettingsTab />}
      </div>
    </aside>
  );
}
