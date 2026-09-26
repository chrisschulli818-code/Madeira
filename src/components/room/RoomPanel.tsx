/**
 * Painel lateral do modo Ambiente: medidas do cômodo, portas/janelas e lista de móveis
 * (girar, encostar numa parede, posição, altura do piso, editar o móvel).
 */
import { DoorOpen, Home, LayoutGrid, Pencil, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { moveToWall, rotatePlacement, snapPlacement, WALL_LABELS } from '@/engine/roomEngine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ResolvedPlacement, WallSide } from '@/types/woodcraft';
import { FieldRow, NumberInput, Section, SliderField } from '@/components/params/fields';
import { FURNITURE_COLORS } from './roomColors';

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

function PlacementCard({ p, all }: { p: ResolvedPlacement; all: ResolvedPlacement[] }) {
  const room = useProjectStore((s) => s.room);
  const selected = useProjectStore((s) => s.selectedPlacement === p.key);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const setPlacement = useProjectStore((s) => s.setPlacement);
  const setActiveItem = useProjectStore((s) => s.setActiveItem);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const others = all.filter((o) => o.key !== p.key);
  const save = (r: { x: number; z: number; rotation: ResolvedPlacement['rotation'] }, elevation = p.elevation) =>
    setPlacement({ itemId: p.itemId, unit: p.unit, elevation, ...r });

  return (
    <div
      onClick={() => selectPlacement(p.key)}
      className={cn('rounded-lg border bg-background', selected ? 'border-accent ring-1 ring-accent' : 'cursor-pointer border-border hover:border-primary/40')}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="size-3 shrink-0 rounded-sm border border-black/10" style={{ background: FURNITURE_COLORS[p.templateId] }} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
        <span className="shrink-0 text-[11px] text-subtle">{p.wall ? WALL_SHORT[p.wall] : 'solto'}</span>
      </div>
      {selected && (
        <div className="space-y-2.5 border-t border-border px-2.5 pb-3 pt-2.5" onClick={(e) => e.stopPropagation()}>
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
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setActiveItem(p.itemId);
              setViewMode('furniture');
            }}
          >
            <Pencil /> Editar este móvel
          </Button>
        </div>
      )}
    </div>
  );
}

export function RoomPanel() {
  const room = useProjectStore((s) => s.room);
  const setRoom = useProjectStore((s) => s.setRoom);
  const resetPlacements = useProjectStore((s) => s.resetPlacements);
  const { placements } = useResults();

  return (
    <aside className="flex flex-col border-b border-border bg-surface lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <Home className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <input
            value={room.name}
            onChange={(e) => setRoom({ name: e.target.value })}
            aria-label="Nome do ambiente"
            className="w-full rounded border border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border focus:border-primary focus:outline-none"
          />
          <p className="px-1 text-xs leading-snug text-subtle">Posicione os móveis do projeto no cômodo. As medidas são internas (de parede a parede).</p>
        </div>
      </div>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <Section title={`Móveis no ambiente (${placements.length})`} icon={<LayoutGrid />} mobileOpen>
          <div className="space-y-2">
            {placements.map((p) => (
              <PlacementCard key={p.key} p={p} all={placements} />
            ))}
          </div>
          <FieldRow label="Organização automática">
            <Button variant="ghost" size="sm" onClick={() => confirm('Voltar todos os móveis para a posição automática?') && resetPlacements()}>
              Reorganizar
            </Button>
          </FieldRow>
          <p className="text-[11px] leading-snug text-subtle">Para adicionar móveis, use “Adicionar móvel” na barra de móveis; eles entram no ambiente automaticamente.</p>
        </Section>
        <Section title="Medidas do cômodo" icon={<Home />} mobileOpen>
          <SliderField label="Largura (parede do fundo)" value={room.width} min={1000} max={12000} step={50} onChange={(width) => setRoom({ width })} />
          <SliderField label="Profundidade (paredes laterais)" value={room.depth} min={1000} max={12000} step={50} onChange={(depth) => setRoom({ depth })} />
          <SliderField label="Pé-direito" value={room.height} min={2000} max={4000} step={10} onChange={(height) => setRoom({ height })} />
        </Section>
        <Section title={`Portas e janelas (${room.openings.length})`} icon={<DoorOpen />}>
          <OpeningsEditor />
        </Section>
      </div>
    </aside>
  );
}
