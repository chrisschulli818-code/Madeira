import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Box as BoxIcon, Camera, Crosshair, Download, Hand, Images, LayoutDashboard, Loader2, Maximize2, Minimize2, RotateCw, Trash2, X } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { useRoomDrag } from '@/hooks/useRoomDrag';
import { useExpanded } from '@/hooks/useExpanded';
import { customViewpoint, rotatePlacement, roomViewpoints, type Viewpoint } from '@/engine/roomEngine';
import { materialTone } from '@/lib/pieceColors';
import { slugify } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MaterialRole } from '@/types/woodcraft';
import type { CaptureFn } from './RoomScene3D';
import { RoomPlan2D } from './RoomPlan2D';

const RoomScene3D = lazy(() => import('./RoomScene3D'));

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Galeria das imagens geradas nesta sessão (também vão para o PDF). */
function SnapshotGallery({ onClose }: { onClose: () => void }) {
  const snapshots = useProjectStore((s) => s.snapshots);
  const removeSnapshot = useProjectStore((s) => s.removeSnapshot);
  const roomName = useProjectStore((s) => s.room.name);
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 max-h-[55%] overflow-y-auto rounded-lg border border-border bg-surface/97 p-3 shadow-lg" data-testid="snapshot-gallery">
      <div className="mb-2 flex items-center gap-2">
        <Images className="size-4 text-primary" />
        <span className="text-sm font-semibold">Imagens do ambiente ({snapshots.length})</span>
        <span className="text-[11px] text-subtle">entram no PDF do projeto</span>
        <button type="button" aria-label="Fechar galeria" onClick={onClose} className="ml-auto grid size-7 place-items-center rounded text-subtle hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      {snapshots.length === 0 ? (
        <p className="text-xs text-subtle">Escolha um ponto de vista e clique em “Gerar imagem”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {snapshots.map((snap, i) => (
            <figure key={snap.id} className="overflow-hidden rounded-md border border-border bg-background">
              <img src={snap.dataUrl} alt={snap.label} className="aspect-video w-full object-cover" />
              <figcaption className="flex items-center gap-1 px-1.5 py-1">
                <span className="min-w-0 flex-1 truncate text-[11px]">{snap.label}</span>
                <button
                  type="button"
                  aria-label="Baixar imagem"
                  onClick={() => downloadDataUrl(snap.dataUrl, `${slugify(roomName)}-${i + 1}.png`)}
                  className="grid size-6 place-items-center rounded text-subtle hover:bg-muted hover:text-primary"
                >
                  <Download className="size-3.5" />
                </button>
                <button type="button" aria-label="Remover imagem" onClick={() => removeSnapshot(snap.id)} className="grid size-6 place-items-center rounded text-subtle hover:bg-muted hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const { materials } = useResults();
  const tones = useMemo(
    () => Object.fromEntries((['carcass', 'front', 'back', 'drawer'] as MaterialRole[]).map((r) => [r, materialTone(materials[r].label, r)])) as Record<MaterialRole, string>,
    [materials],
  );

  // Pontos de vista e imagens
  const [tab, setTab] = useState('plan');
  const views = useMemo(() => roomViewpoints(room), [room]);
  const [viewId, setViewId] = useState('');
  const [custom, setCustom] = useState<{ from: { x: number; z: number }; to?: { x: number; z: number } } | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const captureRef = useRef<CaptureFn | null>(null);
  const addSnapshot = useProjectStore((s) => s.addSnapshot);
  const snapshotCount = useProjectStore((s) => s.snapshots.length);

  const viewpoint: Viewpoint | null =
    viewId === 'personalizado' ? (custom?.to ? customViewpoint(room, custom.from, custom.to) : null) : (views.find((v) => v.id === viewId) ?? null);
  const activeView = viewpoint ? { ...viewpoint, nonce } : null;

  const chooseView = (id: string) => {
    setViewId(id);
    setNonce((n) => n + 1);
    if (id === 'personalizado') {
      if (!custom?.to) startPicking();
      return;
    }
    setPicking(null);
    if (id) setTab('3d');
  };

  const startPicking = () => {
    setViewId('personalizado');
    setCustom(null);
    setPicking('from');
    setShowGallery(false);
    setTab('plan');
    selectPlacement(null);
  };

  const onPick = (pt: { x: number; z: number }) => {
    if (picking === 'from') {
      setCustom({ from: pt });
      setPicking('to');
    } else if (picking === 'to' && custom) {
      setCustom({ from: custom.from, to: pt });
      setPicking(null);
      setNonce((n) => n + 1);
      setTab('3d');
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      selectPlacement(null);
      setTab('3d');
      setNonce((n) => n + 1);
      // Espera o 3D carregar e a câmera ir para o ponto de vista.
      for (let i = 0; i < 300 && !captureRef.current; i++) await nextFrame();
      for (let i = 0; i < 6; i++) await nextFrame();
      const shot = captureRef.current?.();
      if (!shot) throw new Error('3D indisponível');
      const label = viewpoint?.label ?? 'Vista livre';
      addSnapshot({ label, ...shot });
      downloadDataUrl(shot.dataUrl, `${slugify(room.name)}-${slugify(label)}.png`);
      setShowGallery(true);
    } catch (err) {
      console.error(err);
      alert('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const rotate = () => {
    if (!current) return;
    const r = rotatePlacement(current, room, placements.filter((p) => p.key !== current.key));
    setPlacement({ itemId: current.itemId, unit: current.unit, elevation: current.elevation, ...r });
  };

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
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
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/60 px-3 py-1.5">
          <Camera className="size-4 shrink-0 text-primary" />
          <select
            value={viewId}
            onChange={(e) => chooseView(e.target.value)}
            aria-label="Ponto de vista"
            className="h-8 min-w-0 max-w-full flex-1 rounded-md border border-border bg-surface px-2 text-xs sm:max-w-72"
          >
            <option value="">Vista livre (gire com o mouse)</option>
            <optgroup label="Dentro do cômodo">
              {views
                .filter((v) => v.inside)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="De fora">
              {views
                .filter((v) => !v.inside)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
            </optgroup>
            <option value="personalizado">Escolher na planta…</option>
          </select>
          <Button variant={picking ? 'default' : 'outline'} size="sm" onClick={startPicking} title="Clique na planta onde fica a câmera e depois para onde ela olha">
            <Crosshair /> {picking ? (picking === 'from' ? 'Clique: onde você está' : 'Clique: para onde olha') : 'Escolher na planta'}
          </Button>
          <Button size="sm" onClick={generate} disabled={busy || picking !== null}>
            {busy ? <Loader2 className="animate-spin" /> : <Camera />} Gerar imagem
          </Button>
          <Button variant={showGallery ? 'default' : 'ghost'} size="sm" onClick={() => setShowGallery((v) => !v)}>
            <Images /> Imagens{snapshotCount > 0 ? ` (${snapshotCount})` : ''}
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <TabsContent value="plan" className="absolute inset-0 p-3">
            <RoomPlan2D
              room={room}
              placements={placements}
              selected={selected}
              onSelect={selectPlacement}
              drag={drag}
              className="h-full w-full"
              picking={picking !== null}
              onPick={onPick}
              camera={
                picking && custom
                  ? { from: custom.from }
                  : viewpoint && viewpoint.id !== 'geral' && viewpoint.id !== 'cima'
                    ? { from: { x: viewpoint.position.x, z: viewpoint.position.z }, to: { x: viewpoint.target.x, z: viewpoint.target.z }, fov: viewpoint.fov }
                    : null
              }
            />
          </TabsContent>
          <TabsContent value="3d" className="absolute inset-0">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-subtle">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              }
            >
              <RoomScene3D
                room={room}
                placements={placements}
                models={models}
                selected={selected}
                onSelect={selectPlacement}
                drag={drag}
                tones={tones}
                viewpoint={activeView}
                captureRef={captureRef}
              />
            </Suspense>
          </TabsContent>
          <div className="pointer-events-none absolute right-3 top-3 hidden max-w-72 items-start gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1.5 text-[11px] leading-snug text-subtle shadow-sm sm:flex">
            <Hand className="mt-px size-3.5 shrink-0 text-primary" />
            {picking === 'from'
              ? 'Clique na planta no lugar onde você ficaria em pé.'
              : picking === 'to'
                ? 'Agora clique para onde você está olhando.'
                : drag.dragging
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
          {showGallery && <SnapshotGallery onClose={() => setShowGallery(false)} />}
          {roomWarnings.length > 0 && !showGallery && (
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
