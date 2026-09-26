import { lazy, Suspense, useMemo } from 'react';
import { AlertTriangle, Box as BoxIcon, Hand, LayoutDashboard, Loader2, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { useRoomDrag } from '@/hooks/useRoomDrag';
import { useExpanded } from '@/hooks/useExpanded';
import { rotatePlacement } from '@/engine/roomEngine';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoomPlan2D } from './RoomPlan2D';

const RoomScene3D = lazy(() => import('./RoomScene3D'));

/** Área principal do modo Ambiente: planta 2D e vista 3D do cômodo com os móveis. */
export function RoomView() {
  const { placements, items, roomWarnings } = useResults();
  const room = useProjectStore((s) => s.room);
  const selected = useProjectStore((s) => s.selectedPlacement);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const setPlacement = useProjectStore((s) => s.setPlacement);
  const drag = useRoomDrag();
  const { expanded, toggle } = useExpanded();
  const models = useMemo(() => new Map(items.map(({ item, model }) => [item.id, model])), [items]);
  const current = placements.find((p) => p.key === selected);

  const rotate = () => {
    if (!current) return;
    const r = rotatePlacement(current, room, placements.filter((p) => p.key !== current.key));
    setPlacement({ itemId: current.itemId, unit: current.unit, elevation: current.elevation, ...r });
  };

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs defaultValue="plan" className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
          <TabsList>
            <TabsTrigger value="plan">
              <LayoutDashboard /> Planta
            </TabsTrigger>
            <TabsTrigger value="3d">
              <BoxIcon /> 3D
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={rotate} disabled={!current} title="Girar o móvel selecionado 90°">
            <RotateCw /> Girar
          </Button>
          <span className="text-xs text-subtle">
            {room.name} · {room.width} × {room.depth} mm · {placements.length} móvel(is)
          </span>
          <Button variant={expanded ? 'default' : 'outline'} size="sm" className="ml-auto" onClick={() => toggle()}>
            {expanded ? <Minimize2 /> : <Maximize2 />} {expanded ? 'Sair da tela expandida' : 'Expandir'}
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <TabsContent value="plan" className="absolute inset-0 p-3">
            <RoomPlan2D room={room} placements={placements} selected={selected} onSelect={selectPlacement} drag={drag} className="h-full w-full" />
          </TabsContent>
          <TabsContent value="3d" className="absolute inset-0">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-subtle">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              }
            >
              <RoomScene3D room={room} placements={placements} models={models} selected={selected} onSelect={selectPlacement} drag={drag} />
            </Suspense>
          </TabsContent>
          <div className="pointer-events-none absolute right-3 top-3 hidden max-w-72 items-start gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1.5 text-[11px] leading-snug text-subtle shadow-sm sm:flex">
            <Hand className="mt-px size-3.5 shrink-0 text-primary" />
            {drag.dragging
              ? 'Solte para posicionar.'
              : 'Arraste os móveis: perto de uma parede eles encostam e giram de costas para ela, e se alinham aos vizinhos.'}
          </div>
          {current && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm">
              <div className="font-semibold">{current.name}</div>
              <div className="tabular-nums text-subtle">
                x {current.x} · z {current.z} · {current.rotation}°{current.elevation > 0 ? ` · a ${current.elevation} mm do piso` : ''}
              </div>
            </div>
          )}
          {roomWarnings.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 max-h-28 overflow-y-auto rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs text-amber-900 shadow-sm">
              {roomWarnings.map((w, i) => (
                <p key={i} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
