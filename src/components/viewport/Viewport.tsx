import { lazy, Suspense, useState } from 'react';
import { AlertTriangle, Box as BoxIcon, Hand, Loader2, Maximize2, Minimize2, PanelLeft, Square } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Elevation2D } from './Elevation2D';
import { Button } from '@/components/ui/button';
import { useExpanded } from '@/hooks/useExpanded';
import { useDragPieces } from '@/hooks/useDragPieces';

// Three.js é pesado: carregado sob demanda para o primeiro render ser rápido.
const Scene3D = lazy(() => import('./Scene3D'));

function Loading() {
  return (
    <div className="grid h-full place-items-center text-subtle">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

/** Viewport com abas 3D / frontal / lateral e realce sincronizado com a lista de corte. */
export function Viewport() {
  const { model } = useResults();
  const hoveredId = useProjectStore((s) => s.hoveredPieceId);
  const selectedId = useProjectStore((s) => s.selectedPieceId);
  const hoverPiece = useProjectStore((s) => s.hoverPiece);
  const selectPiece = useProjectStore((s) => s.selectPiece);
  const [showFronts, setShowFronts] = useState(true);
  const [explode, setExplode] = useState(0);
  const { expanded, toggle } = useExpanded();
  const drag = useDragPieces(explode === 0);
  const canMove = (model.handles?.length ?? 0) > 0;

  const focus = model.pieces.find((p) => p.id === (hoveredId ?? selectedId));
  const common = { model, showFronts, hoveredId, selectedId, onHover: hoverPiece, onSelect: selectPiece };

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs defaultValue="3d" className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
          <TabsList>
            <TabsTrigger value="3d">
              <BoxIcon /> 3D
            </TabsTrigger>
            <TabsTrigger value="front">
              <Square /> Frontal
            </TabsTrigger>
            <TabsTrigger value="side">
              <PanelLeft /> Lateral
            </TabsTrigger>
          </TabsList>
          <label className="flex items-center gap-2 text-xs text-subtle">
            <Switch checked={showFronts} onCheckedChange={setShowFronts} aria-label="Mostrar frentes" /> Frentes
          </label>
          <label className="flex w-40 items-center gap-2 text-xs text-subtle">
            Explodir
            <Slider aria-label="Vista explodida" value={[explode]} min={0} max={1} step={0.05} onValueChange={([v]) => setExplode(v ?? 0)} />
          </label>
          <Button
            variant={expanded ? 'default' : 'outline'}
            size="sm"
            className="ml-auto"
            onClick={() => toggle()}
            title={expanded ? 'Sair da tela expandida (Esc)' : 'Tela expandida: só o editor e o 3D'}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />} {expanded ? 'Sair da tela expandida' : 'Expandir'}
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <TabsContent value="3d" className="absolute inset-0">
            <Suspense fallback={<Loading />}>
              <Scene3D {...common} explode={explode} drag={drag} />
            </Suspense>
          </TabsContent>
          <TabsContent value="front" className="absolute inset-0 p-4">
            <Elevation2D {...common} view="front" className="h-full w-full" drag={drag} />
          </TabsContent>
          <TabsContent value="side" className="absolute inset-0 p-4">
            <Elevation2D {...common} view="side" className="h-full w-full" />
          </TabsContent>

          {canMove && (
            <div className="pointer-events-none absolute right-3 top-3 hidden max-w-64 items-start gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1.5 text-[11px] leading-snug text-subtle shadow-sm sm:flex">
              <Hand className="mt-px size-3.5 shrink-0 text-primary" />
              {explode > 0
                ? 'Feche a vista explodida para arrastar peças.'
                : drag.dragging
                  ? 'Solte para encaixar.'
                  : `Arraste prateleiras e gavetas (no 3D ou na vista frontal) — elas se encaixam sozinhas.${showFronts ? ' Desligue “Frentes” para alcançar o que fica atrás das portas.' : ''}`}
            </div>
          )}
          {model.pieces.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit max-w-[90%] rounded-lg border border-dashed border-border bg-surface/90 px-4 py-3 text-center text-sm text-subtle shadow-sm">
              Tela em branco — adicione peças no painel de parâmetros para começar.
            </div>
          )}
          {focus && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
              <div className="font-semibold">
                {focus.name} <span className="font-normal text-subtle">× {focus.quantity}</span>
              </div>
              <div className="tabular-nums text-subtle">
                {focus.length} × {focus.width} × {focus.thickness} mm
              </div>
            </div>
          )}
          {model.warnings.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 max-h-28 overflow-y-auto rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs text-amber-900 shadow-sm">
              {model.warnings.map((w, i) => (
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
